const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'tickets.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      path TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      status TEXT NOT NULL
    )
  `);
});

const run = promisify(db.run.bind(db));
const all = promisify(db.all.bind(db));
const get = promisify(db.get.bind(db));

async function addFile({ userId, filePath, status = 'active', createdAt = new Date().toISOString() }) {
  if (!userId || !filePath) {
    throw new Error('userId and filePath are required to add a file entry');
  }
  const stmt = `INSERT INTO files (userId, path, createdAt, status) VALUES (?, ?, ?, ?)`;
  await run(stmt, [userId, filePath, createdAt, status]);
  const row = await get('SELECT last_insert_rowid() AS id');
  return { id: row.id };
}

async function listFiles({ userId } = {}) {
  if (userId) {
    return all('SELECT * FROM files WHERE userId = ? ORDER BY datetime(createdAt) DESC', [userId]);
  }
  return all('SELECT * FROM files ORDER BY datetime(createdAt) DESC');
}

async function getFileById(id) {
  return get('SELECT * FROM files WHERE id = ?', [id]);
}

async function deleteExpired(ttlHours) {
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) {
    throw new Error('ttlHours must be a positive number');
  }
  const ttlMs = ttlHours * 60 * 60 * 1000;
  const now = Date.now();
  const rows = await all('SELECT * FROM files');
  const expired = rows.filter((row) => now - new Date(row.createdAt).getTime() > ttlMs);

  for (const row of expired) {
    if (fs.existsSync(row.path)) {
      fs.unlinkSync(row.path);
    }
    await run('DELETE FROM files WHERE id = ?', [row.id]);
  }
  return expired.map((row) => row.id);
}

async function deleteFileById(id) {
  const row = await getFileById(id);
  if (row && fs.existsSync(row.path)) {
    fs.unlinkSync(row.path);
  }
  if (row) {
    await run('DELETE FROM files WHERE id = ?', [id]);
  }
  return row;
}

module.exports = {
  addFile,
  listFiles,
  getFileById,
  deleteExpired,
  deleteFileById,
  DB_PATH,
};
