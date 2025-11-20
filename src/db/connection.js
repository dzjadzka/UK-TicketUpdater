const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'database.sqlite');

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createConnection() {
  ensureDataDir();
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.run('PRAGMA journal_mode=WAL;');
    db.run('PRAGMA foreign_keys=ON;');
  });
  return db;
}

module.exports = {
  DB_PATH,
  createConnection,
};
