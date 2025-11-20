import fs from 'fs';
import { expect, test } from 'vitest';
import puppeteer from 'puppeteer';
import { launchBrowser } from '../src/browser.js';
import { getDeviceProfile } from '../src/cli.js';

const chromiumPath =
  process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH || '/usr/bin/google-chrome-stable';
process.env.PUPPETEER_SKIP_DOWNLOAD = '1';
process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath;

const executableAvailable = fs.existsSync(chromiumPath);

const smokeTest = executableAvailable ? test : test.skip;

smokeTest('launches chromium and renders a data URL', async () => {
  const { browser, executablePath } = await launchBrowser(puppeteer, {
    headless: true,
    product: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  expect(executablePath).toBeDefined();
  const page = await browser.newPage();
  const profile = getDeviceProfile('mobile');
  await page.setViewport(profile.viewport);
  await page.setUserAgent(profile.userAgent);

  const targetHtml = '<h1>Ticket smoke</h1>';
  await page.goto(`data:text/html,${targetHtml}`);

  const content = await page.content();
  expect(content).toContain('Ticket smoke');
  await browser.close();
}, 20000);
