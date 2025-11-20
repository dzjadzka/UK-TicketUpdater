const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const DEFAULT_PRODUCT = 'firefox';
const DEFAULT_FILENAME = 'ticket.html';

function parseArgs(argv = process.argv) {
  const args = {
    product: DEFAULT_PRODUCT,
    headless: true,
    usersPath: path.resolve(process.cwd(), 'users.json'),
    outputDir: process.cwd(),
    fileName: DEFAULT_FILENAME,
    dbPath: path.resolve(process.cwd(), 'download-history.json')
  };

  const tokens = argv.slice(2);
  tokens.forEach((token) => {
    if (token === '--headful') {
      args.headless = false;
      return;
    }

    const [flag, value] = token.split('=');
    if (!value) {
      return;
    }

    switch (flag) {
      case '--product':
        args.product = value;
        break;
      case '--users':
        args.usersPath = path.resolve(value);
        break;
      case '--output':
        args.outputDir = path.resolve(value);
        break;
      case '--file':
        args.fileName = value;
        break;
      case '--db':
        args.dbPath = path.resolve(value);
        break;
      default:
        break;
    }
  });

  return args;
}

function loadUsers(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Users file not found at ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let users;
  try {
    users = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Users file contains invalid JSON: ${error.message}`);
  }

  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('Users file must contain at least one user object');
  }

  return users.map((user) => {
    if (!user.username || !user.password) {
      throw new Error('Each user requires a username and password');
    }
    return { username: user.username, password: user.password };
  });
}

function readDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    return { history: [] };
  }

  const raw = fs.readFileSync(dbPath, 'utf8');
  try {
    const data = JSON.parse(raw);
    if (!data.history) {
      data.history = [];
    }
    return data;
  } catch (error) {
    throw new Error(`Database file is not valid JSON: ${error.message}`);
  }
}

function writeDb(dbPath, data) {
  fs.writeFileSync(dbPath, `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

function appendHistoryEntry(dbPath, entry) {
  const db = readDb(dbPath);
  const historyEntry = {
    timestamp: new Date().toISOString(),
    ...entry
  };
  db.history.push(historyEntry);
  writeDb(dbPath, db);
  return historyEntry;
}

async function downloadTicketForUser(
  browser,
  user,
  { outputDir, fileName = DEFAULT_FILENAME }
) {
  const outputPath = path.resolve(outputDir, fileName);
  try {
    const page = await browser.newPage();
    await page.goto('https://ticket.astakassel.de', {
      waitUntil: 'networkidle2'
    });
    await page.type('#username', user.username);
    await page.type('#password', user.password);
    await page.waitForSelector('button[type="submit"]');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);
    const html = await page.content();
    fs.writeFileSync(outputPath, html);
    if (typeof page.close === 'function') {
      await page.close();
    }
    return { status: 'success', filePath: outputPath };
  } catch (error) {
    return { status: 'error', error };
  }
}

async function run(argv = process.argv, { launch = puppeteer.launch } = {}) {
  const args = parseArgs(argv);
  const users = loadUsers(args.usersPath);
  const browser = await launch({
    product: args.product,
    headless: args.headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--mute-audio'
    ]
  });

  for (const user of users) {
    const result = await downloadTicketForUser(browser, user, {
      outputDir: args.outputDir,
      fileName: `${user.username}-${args.fileName}`
    });

    appendHistoryEntry(args.dbPath, {
      userId: user.username,
      status: result.status,
      filePath: result.filePath,
      error: result.error ? String(result.error) : undefined
    });
  }

  await browser.close();
}

module.exports = {
  appendHistoryEntry,
  downloadTicketForUser,
  loadUsers,
  parseArgs,
  readDb,
  run,
  writeDb
};
