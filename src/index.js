const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let activeDb = null;

function parseArgs(argv = process.argv) {
  const args = argv.slice(2);
  const options = {
    db: path.resolve('data/app.db'),
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--db') {
      const next = args[i + 1];
      if (next) {
        options.db = path.resolve(next);
        i += 1;
      }
    } else if (arg.startsWith('--db=')) {
      const [, value] = arg.split('=');
      if (value) {
        options.db = path.resolve(value);
      }
    }
  }

  return options;
}

async function openDatabase(dbPath) {
  const directory = path.dirname(dbPath);
  await fs.promises.mkdir(directory, { recursive: true });
  activeDb = await open({ filename: dbPath, driver: sqlite3.Database });
  return activeDb;
}

async function closeDatabase() {
  if (activeDb) {
    await activeDb.close();
    activeDb = null;
  }
}

async function ensureSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);
}

async function main(argv = process.argv) {
  let db;
  try {
    const { db: dbPath } = parseArgs(argv);
    db = await openDatabase(dbPath);
    await ensureSchema(db);
    const users = await db.all('SELECT id, name FROM users');
    if (users.length === 0) {
      console.log('No users found.');
    } else {
      users.forEach((user) => {
        console.log(`User: ${user.name}`);
      });
    }
  } catch (error) {
    console.error('An error occurred while running the CLI:', error);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  closeDatabase,
};
