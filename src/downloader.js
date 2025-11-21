const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { getDeviceProfile } = require('./deviceProfiles');
const { appendHistory } = require('./history');

// Constants
const TICKET_URL = 'https://ticket.astakassel.de';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const SELECTOR_TIMEOUT = 10000; // 10 seconds
const TICKET_TEXT_MARKER = 'NVV-Semesterticket';
const PRIVACY_TEXT_MARKER = 'Website of the semester ticket';

/**
 * Ensures a directory exists, creating it recursively if needed
 * @param {string} dirPath - The directory path to ensure exists
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Prepares a new browser page with device emulation settings
 * @param {Object} browser - Puppeteer browser instance
 * @param {Object} deviceProfile - Device profile configuration
 * @returns {Promise<Object>} Configured Puppeteer page
 */
async function preparePage(browser, deviceProfile) {
  const page = await browser.newPage();

  if (deviceProfile?.userAgent) {
    await page.setUserAgent(deviceProfile.userAgent);
  }

  if (deviceProfile?.viewport) {
    await page.setViewport(deviceProfile.viewport);
  }

  if (deviceProfile?.locale) {
    await page.setExtraHTTPHeaders({ 'Accept-Language': deviceProfile.locale });
  }

  // Set timezone if provided
  if (deviceProfile?.timezone) {
    await page.emulateTimezone(deviceProfile.timezone);
  }

  // Set geolocation if provided
  if (
    deviceProfile?.geolocation_latitude !== null &&
    deviceProfile?.geolocation_latitude !== undefined &&
    deviceProfile?.geolocation_longitude !== null &&
    deviceProfile?.geolocation_longitude !== undefined
  ) {
    await page.setGeolocation({
      latitude: deviceProfile.geolocation_latitude,
      longitude: deviceProfile.geolocation_longitude
    });
  }

  return page;
}

/**
 * Performs login on the ticket website
 * @param {Object} page - Puppeteer page instance
 * @param {string} username - User's login username
 * @param {string} password - User's login password
 * @throws {Error} If login fails
 */
async function performLogin(page, username, password) {
  try {
    await page.goto(TICKET_URL, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });

    // Wait for the username field to be visible
    await page.waitForSelector('#username', { timeout: SELECTOR_TIMEOUT });
    await page.type('#username', username);

    await page.waitForSelector('#password', { timeout: SELECTOR_TIMEOUT });
    await page.type('#password', password);

    await page.waitForSelector('button[type="submit"]', { timeout: SELECTOR_TIMEOUT });
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT })
    ]);
  } catch (error) {
    throw new Error(`Login failed: ${error.message}`);
  }
}

/**
 * Downloads the ticket HTML from the current session
 * Handles privacy consent if required
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<string|null>} HTML content of the ticket, or null if not found
 * @throws {Error} If download fails
 */
async function downloadHtmlForSession(page) {
  try {
    const bodyText = await page.evaluate(() => document.body.textContent || '');

    const ticketTextExists = bodyText.includes(TICKET_TEXT_MARKER);
    const privacyTextExists = bodyText.includes(PRIVACY_TEXT_MARKER);

    if (ticketTextExists) {
      return page.content();
    }

    if (privacyTextExists) {
      const acceptButton = await page.$('input[type="submit"][value="Accept"]');
      if (acceptButton) {
        await Promise.all([
          acceptButton.click(),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT })
        ]);
        return page.content();
      }
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to download HTML: ${error.message}`);
  }
}

/**
 * Downloads a ticket for a single user
 * @param {Object} user - User object with id, username, password, and optional deviceProfile/outputDir
 * @param {Object} options - Download options
 * @param {string} [options.defaultDeviceProfile='desktop_chrome'] - Default device profile to use
 * @param {string} [options.outputRoot='./downloads'] - Base output directory
 * @param {string} [options.historyPath] - Path to history file
 * @param {Object} [options.db] - Database instance for persistence
 * @returns {Promise<Object>} Result object with status, filePath, deviceProfile, and message
 * @throws {Error} If user object is invalid
 */
async function downloadTicketForUser(user, options = {}) {
  const { defaultDeviceProfile = 'desktop_chrome', outputRoot = './downloads', historyPath, db } = options;

  if (!user || !user.id || !user.username || !user.password) {
    throw new Error('User object must contain id, username, and password');
  }

  // Get device profile - either from DB (if it's a custom profile ID) or from presets
  let deviceProfile;
  const profileIdentifier = user.deviceProfile || user.device_profile || defaultDeviceProfile;

  // Check if db is available and profile identifier looks like a custom profile ID (UUID format)
  if (db && typeof db.getDeviceProfileById === 'function' && profileIdentifier.includes('-')) {
    const customProfile = db.getDeviceProfileById(profileIdentifier, user.id);
    if (customProfile) {
      // Convert DB format to the format expected by preparePage
      deviceProfile = {
        name: customProfile.name,
        userAgent: customProfile.user_agent,
        viewport: {
          width: customProfile.viewport_width,
          height: customProfile.viewport_height
        },
        locale: customProfile.locale,
        timezone: customProfile.timezone,
        proxy_url: customProfile.proxy_url,
        geolocation_latitude: customProfile.geolocation_latitude,
        geolocation_longitude: customProfile.geolocation_longitude
      };
    } else {
      // Fallback to preset if custom profile not found
      deviceProfile = getDeviceProfile(defaultDeviceProfile);
    }
  } else {
    // Use preset device profile
    deviceProfile = getDeviceProfile(profileIdentifier);
  }

  let browser;
  let status = 'error';
  let filePath = null;
  let message = '';

  try {
    // Prepare launch options with optional proxy
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--mute-audio']
    };

    // Add proxy server if configured
    if (deviceProfile?.proxy_url) {
      launchOptions.args.push(`--proxy-server=${deviceProfile.proxy_url}`);
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await preparePage(browser, deviceProfile);
    await performLogin(page, user.username, user.password);

    const html = await downloadHtmlForSession(page);

    if (html) {
      const userDir = path.resolve(user.outputDir || user.output_dir || path.join(outputRoot, user.id));
      ensureDirExists(userDir);
      const filename = `ticket-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
      filePath = path.join(userDir, filename);
      fs.writeFileSync(filePath, html);
      status = 'success';
      message = 'Ticket downloaded';

      if (db && typeof db.recordTicket === 'function') {
        db.recordTicket({ userId: user.id, filePath, status });
      }
    } else {
      message = 'Ticket content not found';
    }
  } catch (error) {
    message = error.message;
    console.error(`Failed to download ticket for ${user.id}:`, error);
  } finally {
    if (browser) {
      await browser.close().catch((err) => {
        console.error(`Failed to close browser for ${user.id}:`, err);
      });
    }
    appendHistory(
      {
        userId: user.id,
        deviceProfile: deviceProfile.name,
        status,
        filePath,
        message
      },
      historyPath,
      db
    );
  }

  return { status, filePath, deviceProfile: deviceProfile.name, message };
}

/**
 * Downloads tickets for multiple users sequentially
 * @param {Array<Object>} users - Array of user objects
 * @param {Object} options - Download options (same as downloadTicketForUser)
 * @returns {Promise<Array<Object>>} Array of result objects
 */
async function downloadTickets(users, options = {}) {
  const results = [];
  for (const user of users) {
    const result = await downloadTicketForUser(user, options);
    results.push(result);
  }
  return results;
}

module.exports = {
  downloadTicketForUser,
  downloadTickets
};
