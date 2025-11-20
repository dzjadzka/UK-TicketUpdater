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
    getUsers: () => {
      try {
        return getUsersStmt.all();
      } catch (error) {
        console.error('Failed to get users from database:', error);
        throw error;
      }
    },
    getUsersByIds: (ids) => {
      try {
        if (!Array.isArray(ids)) {
          throw new Error('ids must be an array');
        }
        return getUsersByIdsStmt.all({ ids: JSON.stringify(ids) });
      } catch (error) {
        console.error('Failed to get users by IDs from database:', error);
        throw error;
      }
    },
    upsertUsers: (users) => {
      if (!Array.isArray(users)) {
        throw new Error('users must be an array');
      }
      const insertMany = db.transaction((items) => {
        items.forEach((user) => {
          if (!user.id || !user.username || !user.password) {
            throw new Error('Each user must have id, username, and password');
          }
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
      try {
        insertMany(users);
      } catch (error) {
        console.error('Failed to upsert users:', error);
        throw error;
      }
    },
    recordRun: ({ userId, status, deviceProfile, filePath, message, timestamp }) => {
      try {
        return recordRunStmt.run(userId, status, deviceProfile, filePath, message, timestamp);
      } catch (error) {
        console.error('Failed to record run:', error);
        throw error;
      }
    },
    recordTicket: ({ userId, filePath, status = 'success', createdAt }) => {
      try {
        return recordTicketStmt.run(userId, filePath, status, createdAt);
      } catch (error) {
        console.error('Failed to record ticket:', error);
        throw error;
      }
    },
    listHistory: (limit = 50) => {
      try {
        return listHistoryStmt.all(limit);
      } catch (error) {
        console.error('Failed to list history:', error);
        throw error;
      }
    },
    listTicketsByUser: (userId) => {
      try {
        if (!userId) {
          throw new Error('userId is required');
        }
        return listTicketsByUserStmt.all(userId);
      } catch (error) {
        console.error('Failed to list tickets by user:', error);
        throw error;
      }
    },
    close: () => {
      try {
        db.close();
      } catch (error) {
        console.error('Failed to close database:', error);
        throw error;
      }
    },
    db
  };
}

module.exports = { createDatabase, ensureDirExists };
