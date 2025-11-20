const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { getDeviceProfile } = require('./deviceProfiles');
const { appendHistory } = require('./history');

const TICKET_URL = 'https://ticket.astakassel.de';

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

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

  return page;
}

async function performLogin(page, username, password) {
  await page.goto(TICKET_URL, { waitUntil: 'networkidle2' });
  await page.type('#username', username);
  await page.type('#password', password);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);
}

async function downloadHtmlForSession(page) {
  const bodyText = await page.evaluate(() => document.body.textContent || '');

  const ticketTextExists = bodyText.includes('NVV-Semesterticket');
  const privacyTextExists = bodyText.includes('Website of the semester ticket');

  if (ticketTextExists) {
    return page.content();
  }

  if (privacyTextExists) {
    const acceptButton = await page.$('input[type="submit"][value="Accept"]');
    if (acceptButton) {
      await Promise.all([
        acceptButton.click(),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);
      return page.content();
    }
  }

  return null;
}

async function downloadTicketForUser(user, options = {}) {
  const { defaultDeviceProfile = 'desktop_chrome', outputRoot = './downloads', historyPath, db } = options;
  const deviceProfile = getDeviceProfile(user.deviceProfile || defaultDeviceProfile);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--mute-audio']
  });

  let status = 'error';
  let filePath = null;
  let message = '';

  try {
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
    await browser.close();
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
