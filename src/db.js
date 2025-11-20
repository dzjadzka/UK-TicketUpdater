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
      email TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'user',
      device_profile TEXT,
      output_dir TEXT,
      invite_token TEXT,
      invited_by TEXT,
      locale TEXT DEFAULT 'en',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invite_tokens (
      token TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      used_by TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      login_name TEXT NOT NULL,
      login_password_encrypted TEXT NOT NULL,
      label TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS device_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      viewport_width INTEGER NOT NULL,
      viewport_height INTEGER NOT NULL,
      locale TEXT DEFAULT 'de-DE',
      timezone TEXT DEFAULT 'Europe/Berlin',
      proxy_url TEXT,
      geolocation_latitude REAL,
      geolocation_longitude REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
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
      validation_status TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires ON invite_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id);
    CREATE INDEX IF NOT EXISTS idx_device_profiles_user ON device_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
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

  // Auth-related prepared statements
  const getUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const getUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const createUserStmt = db.prepare(
    'INSERT INTO users (id, email, password_hash, role, invite_token, invited_by, locale, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const updateUserStmt = db.prepare("UPDATE users SET updated_at = datetime('now') WHERE id = ?");
  const disableUserStmt = db.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?");

  // Invite token statements
  const createInviteTokenStmt = db.prepare(
    'INSERT INTO invite_tokens (token, created_by, expires_at) VALUES (?, ?, ?)'
  );
  const getInviteTokenStmt = db.prepare('SELECT * FROM invite_tokens WHERE token = ?');
  const markInviteTokenUsedStmt = db.prepare('UPDATE invite_tokens SET used_by = ? WHERE token = ?');
  const listInviteTokensStmt = db.prepare(
    'SELECT * FROM invite_tokens WHERE created_by = ? ORDER BY created_at DESC'
  );
  const deleteInviteTokenStmt = db.prepare('DELETE FROM invite_tokens WHERE token = ?');

  // Credentials statements
  const createCredentialStmt = db.prepare(
    'INSERT INTO credentials (id, user_id, login_name, login_password_encrypted, label) VALUES (?, ?, ?, ?, ?)'
  );
  const getCredentialsByUserStmt = db.prepare('SELECT * FROM credentials WHERE user_id = ? ORDER BY created_at DESC');
  const getCredentialByIdStmt = db.prepare('SELECT * FROM credentials WHERE id = ? AND user_id = ?');
  const updateCredentialStmt = db.prepare(
    "UPDATE credentials SET login_name = ?, login_password_encrypted = ?, label = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  );
  const deleteCredentialStmt = db.prepare('DELETE FROM credentials WHERE id = ? AND user_id = ?');

  // Device profiles statements
  const createDeviceProfileStmt = db.prepare(
    `INSERT INTO device_profiles (id, user_id, name, user_agent, viewport_width, viewport_height, locale, timezone, proxy_url, geolocation_latitude, geolocation_longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const getDeviceProfilesByUserStmt = db.prepare(
    'SELECT * FROM device_profiles WHERE user_id = ? ORDER BY created_at DESC'
  );
  const getDeviceProfileByIdStmt = db.prepare('SELECT * FROM device_profiles WHERE id = ? AND user_id = ?');
  const updateDeviceProfileStmt = db.prepare(
    `UPDATE device_profiles SET name = ?, user_agent = ?, viewport_width = ?, viewport_height = ?, locale = ?, timezone = ?,
     proxy_url = ?, geolocation_latitude = ?, geolocation_longitude = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  );
  const deleteDeviceProfileStmt = db.prepare('DELETE FROM device_profiles WHERE id = ? AND user_id = ?');

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

    // Auth methods
    getUserByEmail: (email) => {
      try {
        if (!email) {
          throw new Error('email is required');
        }
        return getUserByEmailStmt.get(email);
      } catch (error) {
        console.error('Failed to get user by email:', error);
        throw error;
      }
    },
    getUserById: (id) => {
      try {
        if (!id) {
          throw new Error('id is required');
        }
        return getUserByIdStmt.get(id);
      } catch (error) {
        console.error('Failed to get user by id:', error);
        throw error;
      }
    },
    createUser: ({ id, email, passwordHash, role, inviteToken, invitedBy, locale, isActive }) => {
      try {
        return createUserStmt.run(
          id,
          email,
          passwordHash,
          role || 'user',
          inviteToken || null,
          invitedBy || null,
          locale || 'en',
          isActive !== undefined ? isActive : 1
        );
      } catch (error) {
        console.error('Failed to create user:', error);
        throw error;
      }
    },
    updateUser: (id) => {
      try {
        return updateUserStmt.run(id);
      } catch (error) {
        console.error('Failed to update user:', error);
        throw error;
      }
    },
    disableUser: (id) => {
      try {
        return disableUserStmt.run(id);
      } catch (error) {
        console.error('Failed to disable user:', error);
        throw error;
      }
    },

    // Invite token methods
    createInviteToken: ({ token, createdBy, expiresAt }) => {
      try {
        return createInviteTokenStmt.run(token, createdBy, expiresAt);
      } catch (error) {
        console.error('Failed to create invite token:', error);
        throw error;
      }
    },
    getInviteToken: (token) => {
      try {
        return getInviteTokenStmt.get(token);
      } catch (error) {
        console.error('Failed to get invite token:', error);
        throw error;
      }
    },
    markInviteTokenUsed: (token, userId) => {
      try {
        return markInviteTokenUsedStmt.run(userId, token);
      } catch (error) {
        console.error('Failed to mark invite token as used:', error);
        throw error;
      }
    },
    listInviteTokens: (createdBy) => {
      try {
        return listInviteTokensStmt.all(createdBy);
      } catch (error) {
        console.error('Failed to list invite tokens:', error);
        throw error;
      }
    },
    deleteInviteToken: (token) => {
      try {
        return deleteInviteTokenStmt.run(token);
      } catch (error) {
        console.error('Failed to delete invite token:', error);
        throw error;
      }
    },

    // Credential methods
    createCredential: ({ id, userId, loginName, loginPasswordEncrypted, label }) => {
      try {
        return createCredentialStmt.run(id, userId, loginName, loginPasswordEncrypted, label || null);
      } catch (error) {
        console.error('Failed to create credential:', error);
        throw error;
      }
    },
    getCredentialsByUser: (userId) => {
      try {
        return getCredentialsByUserStmt.all(userId);
      } catch (error) {
        console.error('Failed to get credentials by user:', error);
        throw error;
      }
    },
    getCredentialById: (id, userId) => {
      try {
        return getCredentialByIdStmt.get(id, userId);
      } catch (error) {
        console.error('Failed to get credential by id:', error);
        throw error;
      }
    },
    updateCredential: ({ id, userId, loginName, loginPasswordEncrypted, label }) => {
      try {
        return updateCredentialStmt.run(loginName, loginPasswordEncrypted, label || null, id, userId);
      } catch (error) {
        console.error('Failed to update credential:', error);
        throw error;
      }
    },
    deleteCredential: (id, userId) => {
      try {
        return deleteCredentialStmt.run(id, userId);
      } catch (error) {
        console.error('Failed to delete credential:', error);
        throw error;
      }
    },

    // Device profile methods
    createDeviceProfile: ({
      id,
      userId,
      name,
      userAgent,
      viewportWidth,
      viewportHeight,
      locale,
      timezone,
      proxyUrl,
      geolocationLatitude,
      geolocationLongitude
    }) => {
      try {
        return createDeviceProfileStmt.run(
          id,
          userId,
          name,
          userAgent,
          viewportWidth,
          viewportHeight,
          locale || 'de-DE',
          timezone || 'Europe/Berlin',
          proxyUrl || null,
          geolocationLatitude || null,
          geolocationLongitude || null
        );
      } catch (error) {
        console.error('Failed to create device profile:', error);
        throw error;
      }
    },
    getDeviceProfilesByUser: (userId) => {
      try {
        return getDeviceProfilesByUserStmt.all(userId);
      } catch (error) {
        console.error('Failed to get device profiles by user:', error);
        throw error;
      }
    },
    getDeviceProfileById: (id, userId) => {
      try {
        return getDeviceProfileByIdStmt.get(id, userId);
      } catch (error) {
        console.error('Failed to get device profile by id:', error);
        throw error;
      }
    },
    updateDeviceProfile: ({
      id,
      userId,
      name,
      userAgent,
      viewportWidth,
      viewportHeight,
      locale,
      timezone,
      proxyUrl,
      geolocationLatitude,
      geolocationLongitude
    }) => {
      try {
        return updateDeviceProfileStmt.run(
          name,
          userAgent,
          viewportWidth,
          viewportHeight,
          locale,
          timezone,
          proxyUrl || null,
          geolocationLatitude || null,
          geolocationLongitude || null,
          id,
          userId
        );
      } catch (error) {
        console.error('Failed to update device profile:', error);
        throw error;
      }
    },
    deleteDeviceProfile: (id, userId) => {
      try {
        return deleteDeviceProfileStmt.run(id, userId);
      } catch (error) {
        console.error('Failed to delete device profile:', error);
        throw error;
      }
    },
    db
  };
}

module.exports = { createDatabase, ensureDirExists };
