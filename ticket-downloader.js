const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { getDeviceProfile, listAvailableProfiles } = require('./src/deviceProfiles');
const { ensureDir, loadConfig, appendHistory, writeJson } = require('./src/storage');

const SOURCE_URL = 'https://ticket.astakassel.de';

function parseGeolocation(rawValue) {
  const [lat, lon] = (rawValue || '')
    .split(',')
    .map((value) => Number(value.trim()));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Geolocation must be provided as "<latitude>,<longitude>".');
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Geolocation coordinates are out of range.');
  }

  return { latitude: lat, longitude: lon };
}

function validateProxy(proxyValue) {
  try {
    const parsed = new URL(proxyValue);
    const allowed = ['http:', 'https:', 'socks4:', 'socks5:'];
    if (!allowed.includes(parsed.protocol)) {
      throw new Error('Unsupported proxy protocol');
    }
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    throw new Error(`Invalid proxy value: ${error.message}`);
  }
}

function parseArgs(argv) {
  const args = { proxy: undefined, geolocation: undefined };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--proxy') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --proxy');
      }
      args.proxy = validateProxy(value);
      i += 1;
    } else if (arg === '--geolocation') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --geolocation');
      }
      args.geolocation = parseGeolocation(value);
      i += 1;
    } else if (arg === '--list-devices') {
      console.log('Available device profiles:');
      listAvailableProfiles().forEach((name) => console.log(` - ${name}`));
      process.exit(0);
    }
  }

  return args;
}

function usage(error) {
  if (error) {
    console.error(error.message);
  }
  console.log('Usage: node ticket-downloader.js [--proxy <url>] [--geolocation <lat,lon>]');
  process.exit(1);
}

async function downloadTicketForUser(options) {
  const {
    credentials,
    output,
    browser,
    proxy,
    geolocation
  } = options;

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--mute-audio'
  ];

  if (proxy) {
    launchArgs.push(`--proxy-server=${proxy}`);
  }

  const downloadStartedAt = new Date().toISOString();
  let browserInstance;
  const metadata = {
    downloadedAt: downloadStartedAt,
    deviceProfile: browser.profileName,
    proxy: proxy || null,
    geolocation: geolocation || null,
    sourceUrl: SOURCE_URL,
    status: 'pending'
  };

  try {
    browserInstance = await puppeteer.launch({
      product: browser.product,
      headless: browser.headless,
      args: launchArgs,
      defaultViewport: browser.deviceProfile.viewport
    });

    const context = await browserInstance.createIncognitoBrowserContext();
    if (geolocation) {
      await context.overridePermissions(SOURCE_URL, ['geolocation']);
    }
    const page = await context.newPage();

    if (geolocation) {
      await page.setGeolocation(geolocation);
    }

    if (browser.deviceProfile) {
      await page.emulate(browser.deviceProfile);
    }

    await page.goto(SOURCE_URL, { waitUntil: 'networkidle2' });

    await page.type('#username', credentials.username);
    await page.type('#password', credentials.password);

    await page.waitForSelector('button[type="submit"]');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    const page2 = await browserInstance.newPage();
    await page2.goto(SOURCE_URL, { waitUntil: 'networkidle2' });

    const privacyTextExists = await page2.evaluate(() => {
      return document.body.textContent.includes('Website of the semester ticket');
    });

    const ticketTextExists = await page2.evaluate(() => {
      return document.body.textContent.includes('NVV-Semesterticket');
    });

    let html = '';
    if (ticketTextExists) {
      html = await page2.content();
    } else if (privacyTextExists) {
      await page2.waitForSelector('input[type="submit"][value="Accept"]');
      await Promise.all([
        page2.click('input[type="submit"][value="Accept"]'),
        page2.waitForNavigation({ waitUntil: 'networkidle2' })
      ]);

      const page3 = await browserInstance.newPage();
      await page3.goto(SOURCE_URL, { waitUntil: 'networkidle2' });
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

    ensureDir(path.resolve(output.directory));
    const filePath = path.resolve(output.directory, output.fileName);
    fs.writeFileSync(filePath, html);
    metadata.status = 'success';
    metadata.outputFile = filePath;

    const metadataPath = `${filePath}.meta.json`;
    writeJson(metadataPath, metadata);
    appendHistory({ ...metadata });
  } catch (error) {
    metadata.status = 'error';
    metadata.error = error.message;
    appendHistory({ ...metadata });
    throw error;
  } finally {
    if (browserInstance) {
      await browserInstance.close();
    }
  }
}

(async () => {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    usage(error);
  }

  const config = loadConfig();
  const proxy = args.proxy !== undefined ? args.proxy : config.network.proxy;
  const geolocation = args.geolocation !== undefined ? args.geolocation : config.browser.geolocation;
  const profileName = config.browser.deviceProfile;
  const deviceProfile = getDeviceProfile(profileName);

  console.log(`Using device profile: ${profileName}`);
  if (proxy) {
    console.log(`Using proxy: ${proxy}`);
  }
  if (geolocation) {
    console.log(`Using geolocation: ${geolocation.latitude},${geolocation.longitude}`);
  }

  try {
    await downloadTicketForUser({
      credentials: config.credentials,
      output: config.output,
      browser: { ...config.browser, profileName, deviceProfile },
      proxy,
      geolocation
    });
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
})();
