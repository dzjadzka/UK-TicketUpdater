const fs = require('fs');
const path = require('path');
const { downloadTickets } = require('./downloader');
const { DEFAULT_HISTORY_PATH } = require('./history');
const { createDatabase } = require('./db');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const [key, value] = argv[i].split('=');
    if (key.startsWith('--')) {
      const normalizedKey = key.replace(/^--/, '');
      if (value !== undefined) {
        args[normalizedKey] = value;
      } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args[normalizedKey] = argv[i + 1];
        i += 1;
      } else {
        args[normalizedKey] = true;
      }
    }
  }
  return args;
}

function loadUsers(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Users config not found at ${configPath}. Create it from config/users.sample.json`);
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Users config must be an array of user objects');
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const usersConfigPath = path.resolve(args.users || './config/users.json');
  const outputRoot = path.resolve(args.output || './downloads');
  const defaultDeviceProfile = args.device || 'desktop_chrome';
  const historyPath = path.resolve(args.history || DEFAULT_HISTORY_PATH);
  const dbPath = args.db ? path.resolve(args.db) : null;

  const db = dbPath ? createDatabase(dbPath) : null;

  try {
    let users;
    if (db) {
      users = db.getUsers();
    } else {
      users = loadUsers(usersConfigPath);
    }

    if (!users.length) {
      throw new Error('No users found. Seed users via config/users.json or the database.');
    }

    const results = await downloadTickets(users, { defaultDeviceProfile, outputRoot, historyPath, db });

    results.forEach((result, index) => {
      const userId = users[index].id;
      console.log(`[${userId}] status=${result.status} device=${result.deviceProfile} file=${result.filePath || 'n/a'} message=${result.message}`);
    });
  } finally {
    if (db) {
      db.close();
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to download tickets:', error);
    process.exit(1);
  });
}

module.exports = { parseArgs, loadUsers, main };
