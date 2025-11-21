const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { decrypt, getEncryptionKey } = require('../auth');
const { getDeviceProfile } = require('../deviceProfiles');
const { downloadHtmlForSession, performLogin, preparePage } = require('../downloader');

const TICKET_URL = 'https://ticket.astakassel.de';

function getAdminCredentials() {
  const username = process.env.TICKET_ADMIN_USERNAME || process.env.ADMIN_TICKET_USERNAME;
  const password = process.env.TICKET_ADMIN_PASSWORD || process.env.ADMIN_TICKET_PASSWORD;
  if (!username || !password) {
    throw new Error('Missing admin ticket credentials');
  }
  return { username, password };
}

async function fetchBaseTicket() {
  const { username, password } = getAdminCredentials();
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--mute-audio']
  };

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.goto(TICKET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await performLogin(page, username, password);
    const html = await downloadHtmlForSession(page);

    if (!html) {
      throw new Error('Base ticket content not found');
    }

    const hash = crypto.createHash('sha256').update(html).digest('hex');
    return { hash, content: html };
  } finally {
    if (browser) {
      await browser.close().catch((err) => {
        console.error('Failed to close browser after base ticket fetch', err);
      });
    }
  }
}

function computeTicketHashFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function resolveUserCredentials(userId, db, encryptionKey) {
  const record = db.getUserCredential(userId);
  if (!record || !record.uk_password_encrypted) {
    return null;
  }
  const key = encryptionKey || getEncryptionKey();
  const password = decrypt(record.uk_password_encrypted, key);
  return { number: record.uk_number, password };
}

function buildDeviceProfile(user, db, defaultDevice) {
  const profileIdentifier = user.deviceProfile || user.device_profile || defaultDevice;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isCustomProfile = uuidRegex.test(profileIdentifier);

  if (db && typeof db.getDeviceProfileById === 'function' && isCustomProfile) {
    const customProfile = db.getDeviceProfileById(profileIdentifier, user.id);
    if (customProfile) {
      return {
        name: customProfile.name,
        userAgent: customProfile.user_agent,
        viewport: { width: customProfile.viewport_width, height: customProfile.viewport_height },
        locale: customProfile.locale,
        timezone: customProfile.timezone,
        proxy_url: customProfile.proxy_url,
        geolocation_latitude: customProfile.geolocation_latitude,
        geolocation_longitude: customProfile.geolocation_longitude
      };
    }
  }

  return getDeviceProfile(profileIdentifier);
}

function createJobHandlers({
  db,
  queue,
  logger = console,
  encryptionKey,
  defaults = {},
  fetchBaseTicketFn = fetchBaseTicket
}) {
  const defaultOutput = defaults.outputRoot || './downloads';
  const defaultDeviceProfile = defaults.defaultDeviceProfile || 'desktop_chrome';

  async function handleCheckBaseTicket() {
    const now = new Date().toISOString();
    const state = db.getBaseTicketState();
    const { hash } = await fetchBaseTicketFn();

    if (state && state.base_ticket_hash === hash) {
      db.setBaseTicketState({ baseTicketHash: hash, effectiveFrom: state.effective_from, lastCheckedAt: now });
      logger.info('Base ticket unchanged; no user downloads enqueued');
      return;
    }

    db.setBaseTicketState({ baseTicketHash: hash, effectiveFrom: now, lastCheckedAt: now });
    logger.info('Base ticket changed; enqueueing user downloads');
    queue.enqueue('downloadTicketsForAllUsers');
  }

  async function handleDownloadTicketsForAllUsers() {
    const users = db.listActiveUsers();
    users
      .filter((user) => user.auto_download_enabled)
      .forEach((user) => {
        queue.enqueue('downloadTicketForUser', { userId: user.id });
      });
  }

  async function handleDownloadTicketForUser(payload) {
    const userId = payload?.userId;
    if (!userId) {
      throw new Error('userId is required');
    }
    const user = db.getActiveUserById(userId);
    if (!user || !user.is_active) {
      throw new Error('User not found or inactive');
    }
    if (!user.auto_download_enabled) {
      logger.info(`Auto-download disabled for user ${user.id}; skipping`);
      return;
    }

    const creds = resolveUserCredentials(user.id, db, encryptionKey);
    if (!creds) {
      db.updateUserCredentialStatus({
        userId: user.id,
        status: 'error',
        error: 'Missing credentials',
        loggedInAt: new Date().toISOString()
      });
      throw new Error('Missing credentials');
    }

    const profile = buildDeviceProfile(user, db, defaultDeviceProfile);
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--mute-audio']
    };
    if (profile?.proxy_url) {
      launchOptions.args.push(`--proxy-server=${profile.proxy_url}`);
    }

    let browser;
    let status = 'error';
    let filePath = null;
    let errorMessage = null;
    try {
      browser = await puppeteer.launch(launchOptions);
      const page = await preparePage(browser, profile);
      await performLogin(page, creds.number, creds.password);
      const html = await downloadHtmlForSession(page);

      if (!html) {
        throw new Error('Ticket content not found');
      }

      const userDir = path.resolve(user.output_dir || user.outputDir || path.join(defaultOutput, user.id));
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const filename = `ticket-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
      filePath = path.join(userDir, filename);
      fs.writeFileSync(filePath, html);
      status = 'success';

      const contentHash = crypto.createHash('sha256').update(html).digest('hex');
      const ticketVersion = contentHash;
      const isNew = db.isTicketVersionNew({ userId: user.id, ticketVersion, contentHash });
      const finalStatus = isNew ? 'success' : 'duplicate';
      db.recordTicket({
        userId: user.id,
        ticketVersion,
        contentHash,
        filePath,
        status: finalStatus
      });
      db.recordRun({
        userId: user.id,
        status: finalStatus,
        message: isNew ? 'Ticket downloaded' : 'Duplicate ticket detected',
        filePath
      });
      db.updateUserCredentialStatus({ userId: user.id, status: finalStatus, error: null, loggedInAt: new Date().toISOString() });
    } catch (error) {
      errorMessage = error.message;
      logger.error(`Failed to download ticket for user ${userId}: ${errorMessage}`);
      db.recordRun({ userId, status: 'error', message: 'Download failed', errorMessage });
      db.updateUserCredentialStatus({ userId, status: 'error', error: errorMessage, loggedInAt: new Date().toISOString() });
      throw error;
    } finally {
      if (browser) {
        await browser.close().catch((err) => logger.error(`Failed to close browser for ${userId}`, err));
      }
    }

    return { status, filePath, error: errorMessage };
  }

  return {
    checkBaseTicket: handleCheckBaseTicket,
    downloadTicketsForAllUsers: handleDownloadTicketsForAllUsers,
    downloadTicketForUser: handleDownloadTicketForUser
  };
}

module.exports = {
  createJobHandlers,
  fetchBaseTicket,
  computeTicketHashFromFile,
  resolveUserCredentials,
  buildDeviceProfile
};
