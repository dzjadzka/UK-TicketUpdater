import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { parseArgs, getDeviceProfile } from './src/cli.js';
import { appendHistoryEntry } from './src/history.js';
import { launchBrowser } from './src/browser.js';

(async () => {
  const options = parseArgs(process.argv.slice(2));
  const { outputPath, device, product, headless, historyFile } = options;

  appendHistoryEntry(historyFile, { event: 'start', device, product });

  const { browser, executablePath } = await launchBrowser(puppeteer, {
    headless,
    product,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--mute-audio']
  });

  appendHistoryEntry(historyFile, { event: 'launch', executablePath: executablePath || 'default', product });

  const page = await browser.newPage();
  const profile = getDeviceProfile(device);
  if (profile.viewport) {
    await page.setViewport(profile.viewport);
  }
  if (profile.userAgent) {
    await page.setUserAgent(profile.userAgent);
  }

  await page.goto('https://ticket.astakassel.de', { waitUntil: 'networkidle2' });
  await page.type('#username', 'Your-UK-Number');
  await page.type('#password', 'Your-UK-Password');

  await page.waitForSelector('button[type="submit"]');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' })
  ]);

  let html = '';

  try {
    const page2 = await browser.newPage();
    await page2.goto('https://ticket.astakassel.de', { waitUntil: 'networkidle2' });

    const privacyTextExists = await page2.evaluate(() => {
      return document.body.textContent.includes('Website of the semester ticket');
    });

    const ticketTextExists = await page2.evaluate(() => {
      return document.body.textContent.includes('NVV-Semesterticket');
    });

    if (ticketTextExists) {
      html = await page2.content();
    } else if (privacyTextExists) {
      await page2.waitForSelector('input[type="submit"][value="Accept"]');
      await Promise.all([
        page2.click('input[type="submit"][value="Accept"]'),
        page2.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);

      const page3 = await browser.newPage();
      await page3.goto('https://ticket.astakassel.de', { waitUntil: 'networkidle2' });
      html = await page3.content();
    } else {
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

    const directory = path.dirname(outputPath);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(outputPath, html);
    appendHistoryEntry(historyFile, { event: 'saved', path: outputPath, status: 'success' });
  } catch (error) {
    appendHistoryEntry(historyFile, { event: 'error', message: error.message });
    console.error('An error occurred:', error);
  }

  await browser.close();
})();
