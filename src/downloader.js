const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const config = require('./config');

async function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function downloadTickets(options) {
  const { userId = 'unknown-user', username, password, outputDir = config.downloadDirectory, filename = `${userId}.html` } = options;

  if (!username || !password) {
    throw new Error('Missing username or password');
  }

  await ensureDirectory(outputDir);
  const filePath = path.resolve(outputDir, filename);

  const browser = await puppeteer.launch({
    product: config.browserProduct,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--mute-audio'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://ticket.astakassel.de', { waitUntil: 'networkidle2' });
    await page.type('#username', username);
    await page.type('#password', password);

    await page.waitForSelector('button[type="submit"]');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    let html = '';
    const ticketPage = await browser.newPage();
    await ticketPage.goto('https://ticket.astakassel.de', { waitUntil: 'networkidle2' });

    const privacyTextExists = await ticketPage.evaluate(() => document.body.textContent.includes('Website of the semester ticket'));
    const ticketTextExists = await ticketPage.evaluate(() => document.body.textContent.includes('NVV-Semesterticket'));

    if (ticketTextExists) {
      html = await ticketPage.content();
    } else if (privacyTextExists) {
      await ticketPage.waitForSelector('input[type="submit"][value="Accept"]');
      await Promise.all([
        ticketPage.click('input[type="submit"][value="Accept"]'),
        ticketPage.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);

      const refreshed = await browser.newPage();
      await refreshed.goto('https://ticket.astakassel.de', { waitUntil: 'networkidle2' });
      html = await refreshed.content();
    } else {
      html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Error</title></head><body><h1>Error</h1><p>Error downloading ticket...</p></body></html>`;
    }

    fs.writeFileSync(filePath, html);

    return {
      status: 'success',
      userId,
      filePath
    };
  } catch (error) {
    return {
      status: 'error',
      userId,
      error: error.message
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  downloadTickets
};
