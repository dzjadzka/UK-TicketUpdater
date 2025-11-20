const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      device_profile TEXT,
      output_dir TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      status TEXT,
      device_profile TEXT,
      file_path TEXT,
      message TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      file_path TEXT,
      status TEXT DEFAULT 'success',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function createDatabase(dbPath) {
  const resolvedPath = path.resolve(dbPath);
  ensureDirExists(path.dirname(resolvedPath));

  const db = new Database(resolvedPath);
  initSchema(db);

  const getUsersStmt = db.prepare('SELECT * FROM users ORDER BY id');
  const upsertUserStmt = db.prepare(
    'INSERT INTO users (id, username, password, role, device_profile, output_dir) VALUES (@id, @username, @password, @role, @device_profile, @output_dir)\n    ON CONFLICT(id) DO UPDATE SET username=excluded.username, password=excluded.password, role=excluded.role, device_profile=excluded.device_profile, output_dir=excluded.output_dir'
  );
  const getUsersByIdsStmt = db.prepare(
    'SELECT * FROM users WHERE id IN (SELECT value FROM json_each(@ids)) ORDER BY id'
  );
  const recordRunStmt = db.prepare(
    "INSERT INTO runs (user_id, status, device_profile, file_path, message, timestamp) VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))"
  );
  const recordTicketStmt = db.prepare(
    "INSERT INTO tickets (user_id, file_path, status, created_at) VALUES (?, ?, ?, COALESCE(?, datetime('now')))"
  );
  const listHistoryStmt = db.prepare('SELECT * FROM runs ORDER BY id DESC LIMIT ?');
  const listTicketsByUserStmt = db.prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY id DESC');

  return {
    getUsers: () => getUsersStmt.all(),
    getUsersByIds: (ids) => getUsersByIdsStmt.all({ ids: JSON.stringify(ids) }),
    upsertUsers: (users) => {
      const insertMany = db.transaction((items) => {
        items.forEach((user) => {
          upsertUserStmt.run({
            id: user.id,
            username: user.username,
            password: user.password,
            role: user.role || 'user',
            device_profile: user.deviceProfile || user.device_profile || null,
            output_dir: user.outputDir || user.output_dir || null
          });
        });
      });
      insertMany(users);
    },
    recordRun: ({ userId, status, deviceProfile, filePath, message, timestamp }) =>
      recordRunStmt.run(userId, status, deviceProfile, filePath, message, timestamp),
    recordTicket: ({ userId, filePath, status = 'success', createdAt }) =>
      recordTicketStmt.run(userId, filePath, status, createdAt),
    listHistory: (limit = 50) => listHistoryStmt.all(limit),
    listTicketsByUser: (userId) => listTicketsByUserStmt.all(userId),
    close: () => db.close(),
    db
  };
}

module.exports = { createDatabase, ensureDirExists };
