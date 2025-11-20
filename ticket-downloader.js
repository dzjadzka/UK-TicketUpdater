require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { loadUsersFromDatabase } = require('./src/index');
const { logDownload } = require('./src/history');

async function resolveUserConfig() {
  const users = await loadUsersFromDatabase();
  if (!users.length) {
    throw new Error('Keine Benutzer in der Datenbank gefunden. Bitte lege einen Benutzer mit Zugangsdaten an.');
  }

  const [user] = users;
  const autoLogin = user.autoLoginDecrypted || {};
  const username = autoLogin.username || process.env.UK_USERNAME;
  const password = autoLogin.password || process.env.UK_PASSWORD;

  if (!username || !password) {
    throw new Error('Weder verschlüsselte noch Umgebungs-Zugangsdaten vorhanden.');
  }

  const devicePreferences = user.devicePreferences || {};
  const downloadDir = devicePreferences.downloadPath || process.env.DOWNLOAD_PATH || '/tmp';
  const filename = devicePreferences.filename || 'ticket.html';

  return {
    userId: user.id,
    username,
    password,
    device: devicePreferences.device || 'default',
    filePath: path.resolve(downloadDir, filename),
  };
}

async function downloadTicket() {
  const config = await resolveUserConfig();
  const browser = await puppeteer.launch({
    product: 'firefox', // Wichtig: Setzt den Browser auf Firefox
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--mute-audio'
    ]
  });
  const page = await browser.newPage();

  // goto with waitUntil options
  await page.goto('https://ticket.astakassel.de', { waitUntil: 'networkidle2' });

  // enter user credentials
  await page.type('#username', config.username);
  await page.type('#password', config.password);

  // click on login-button
  await page.waitForSelector('button[type="submit"]');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);

  // initialize output variable
  let html = '';

  try {
    // reopen ticket-website
    const page2 = await browser.newPage();
    await page2.goto('https://ticket.astakassel.de', { waitUntil: 'networkidle2' });

    // check if puppeteer got redirected to "privacy policy-site"
    const privacyTextExists = await page2.evaluate(() => {
      return document.body.textContent.includes('Website of the semester ticket');
    });

    // check if puppeteer got redirected to "ticket-site"
    const ticketTextExists = await page2.evaluate(() => {
      return document.body.textContent.includes('NVV-Semesterticket');
    });

    if (ticketTextExists) {
      // download ticket-html
      html = await page2.content();
    } else if (privacyTextExists) {
      // click on accept on "privacy policy-site"
      await page2.waitForSelector('input[type="submit"][value="Accept"]');
      await Promise.all([
        page2.click('input[type="submit"][value="Accept"]'),
        page2.waitForNavigation({ waitUntil: 'networkidle2' }),
      ]);

      // reopen ticket-website
      const page3 = await browser.newPage();
      await page3.goto('https://ticket.astakassel.de', { waitUntil: 'networkidle2' });

      // download ticket-html
      html = await page3.content();
    } else {
      // generate error html
      html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error</title>
        </head>
        <body>
          <h1>Error</h1>
          <p>Error downloading ticket...</p>
        </body>
        </html>
      `;
    }

    fs.writeFileSync(config.filePath, html);
    await logDownload({
      userId: config.userId,
      status: 'success',
      device: config.device,
      filePath: config.filePath,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('An error occurred:', error);
    await logDownload({
      userId: config.userId,
      status: 'failure',
      device: config.device,
      filePath: config.filePath,
      timestamp: new Date(),
    });
  }

  await browser.close();
}

downloadTicket().catch((err) => {
  console.error('Download abgebrochen:', err.message);
});
