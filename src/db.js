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
      login TEXT NOT NULL UNIQUE,
      role TEXT DEFAULT 'user',
      flags TEXT DEFAULT '{}',
      device_profile TEXT,
      output_dir TEXT,
      invite_token TEXT,
      invited_by TEXT,
      locale TEXT DEFAULT 'en',
      is_active INTEGER DEFAULT 1,
      auto_download_enabled INTEGER DEFAULT 0,
      deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      email TEXT,
      password_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS invite_tokens (
      token TEXT PRIMARY KEY,
      created_by TEXT NOT NULL,
      used_by TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_credentials (
      user_id TEXT PRIMARY KEY,
      uk_number TEXT NOT NULL,
      uk_password_encrypted TEXT NOT NULL,
      last_login_status TEXT,
      last_login_error TEXT,
      last_login_at TEXT,
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

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      ticket_version TEXT NOT NULL,
      content_hash TEXT,
      file_path TEXT,
      downloaded_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'success',
      error_message TEXT,
      validation_status TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, ticket_version),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS download_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      device_profile TEXT,
      ticket_version TEXT,
      status TEXT,
      message TEXT,
      error_message TEXT,
      file_path TEXT,
      downloaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS base_ticket_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      base_ticket_hash TEXT,
      effective_from TEXT,
      last_checked_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS job_queue (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT,
      attempts INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      retry_delay_ms INTEGER DEFAULT 1000,
      backoff_factor REAL DEFAULT 2,
      status TEXT DEFAULT 'pending',
      available_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_job_queue_status_available ON job_queue(status, available_at);

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

    CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires ON invite_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id);
    CREATE INDEX IF NOT EXISTS idx_device_profiles_user ON device_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_credentials_user ON user_credentials(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_user_time ON tickets(user_id, downloaded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_history_user_time ON download_history(user_id, downloaded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active, deleted_at);
  `);
}

function createDatabase(dbPath) {
  const resolvedPath = path.resolve(dbPath);
  ensureDirExists(path.dirname(resolvedPath));

  const db = new Database(resolvedPath);
  // Enable foreign key constraints (disabled by default in SQLite)
  db.pragma('foreign_keys = ON');
  initSchema(db);

  const getUsersStmt = db.prepare('SELECT * FROM users ORDER BY id');
  const getActiveUsersStmt = db.prepare(
    'SELECT * FROM users WHERE deleted_at IS NULL AND is_active = 1 ORDER BY created_at DESC'
  );
  const getActiveUsersByIdsStmt = db.prepare(
    'SELECT * FROM users WHERE id IN (SELECT value FROM json_each(@ids)) AND deleted_at IS NULL AND is_active = 1 ORDER BY id'
  );
  const upsertUserStmt = db.prepare(
    `INSERT INTO users (id, login, role, flags, device_profile, output_dir, invite_token, invited_by, locale, created_at, updated_at, email, password_hash, is_active)
    VALUES (@id, @login, @role, @flags, @device_profile, @output_dir, @invite_token, @invited_by, @locale, COALESCE(@created_at, datetime('now')), COALESCE(@updated_at, datetime('now')), @email, @password_hash, COALESCE(@is_active, 1))
    ON CONFLICT(id) DO UPDATE SET
      login=excluded.login,
      role=excluded.role,
      flags=excluded.flags,
      device_profile=COALESCE(excluded.device_profile, users.device_profile),
      output_dir=COALESCE(excluded.output_dir, users.output_dir),
      invite_token=COALESCE(excluded.invite_token, users.invite_token),
      invited_by=COALESCE(excluded.invited_by, users.invited_by),
      locale=COALESCE(excluded.locale, users.locale),
      updated_at=datetime('now'),
      email=COALESCE(excluded.email, users.email),
      password_hash=COALESCE(excluded.password_hash, users.password_hash),
      is_active=COALESCE(excluded.is_active, users.is_active)`
  );
  const getUsersByIdsStmt = db.prepare(
    'SELECT * FROM users WHERE id IN (SELECT value FROM json_each(@ids)) ORDER BY id'
  );
  const recordDownloadAttemptStmt = db.prepare(
    "INSERT INTO download_history (user_id, device_profile, ticket_version, status, message, error_message, file_path, downloaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))"
  );
  const recordTicketStmt = db.prepare(
    `INSERT INTO tickets (user_id, ticket_version, content_hash, file_path, downloaded_at, status, error_message)
    VALUES (@userId, @ticketVersion, @contentHash, @filePath, COALESCE(@downloadedAt, datetime('now')), @status, @errorMessage)
    ON CONFLICT(user_id, ticket_version) DO UPDATE SET
      content_hash=excluded.content_hash,
      file_path=excluded.file_path,
      downloaded_at=excluded.downloaded_at,
      status=excluded.status,
      error_message=excluded.error_message`
  );
  const listHistoryStmt = db.prepare('SELECT * FROM download_history ORDER BY downloaded_at DESC, id DESC LIMIT ?');
  const listTicketsByUserStmt = db.prepare(
    'SELECT * FROM tickets WHERE user_id = ? ORDER BY downloaded_at DESC, id DESC'
  );
  const getTicketByVersionStmt = db.prepare('SELECT * FROM tickets WHERE user_id = ? AND ticket_version = ?');
  const getTicketByHashStmt = db.prepare(
    'SELECT * FROM tickets WHERE user_id = ? AND content_hash = ? ORDER BY downloaded_at DESC LIMIT 1'
  );
  const getLatestTicketStmt = db.prepare(
    'SELECT * FROM tickets WHERE user_id = ? ORDER BY downloaded_at DESC, id DESC LIMIT 1'
  );
  const getHistoryByUserStmt = db.prepare(
    'SELECT * FROM download_history WHERE user_id = ? ORDER BY downloaded_at DESC, id DESC LIMIT ?'
  );
  const aggregateStatsStmt = db.prepare(
    'SELECT status, COUNT(*) AS count FROM download_history WHERE user_id = ? GROUP BY status'
  );
  const getRecentErrorsStmt = db.prepare(
    `SELECT user_id, status, message, error_message, device_profile, downloaded_at
     FROM download_history
     WHERE status IS NULL OR status != 'success'
     ORDER BY downloaded_at DESC, id DESC
     LIMIT ?`
  );
  const getJobSummarySinceStmt = db.prepare(
    `SELECT status, COUNT(*) AS count
     FROM download_history
     WHERE downloaded_at >= datetime('now', @window)
     GROUP BY status`
  );

  const setBaseTicketStateStmt = db.prepare(
    `INSERT INTO base_ticket_state (id, base_ticket_hash, effective_from, last_checked_at, updated_at)
    VALUES (1, @base_ticket_hash, @effective_from, @last_checked_at, COALESCE(@updated_at, datetime('now')))
    ON CONFLICT(id) DO UPDATE SET
      base_ticket_hash=excluded.base_ticket_hash,
      effective_from=excluded.effective_from,
      last_checked_at=excluded.last_checked_at,
      updated_at=datetime('now')`
  );
  const getBaseTicketStateStmt = db.prepare('SELECT * FROM base_ticket_state WHERE id = 1');

  // Auth-related prepared statements
  const getUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL');
  const getUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const getActiveUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = 1');
  const createUserStmt = db.prepare(
    'INSERT INTO users (id, login, email, password_hash, role, invite_token, invited_by, locale, is_active, auto_download_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const updateUserStmt = db.prepare("UPDATE users SET updated_at = datetime('now') WHERE id = ?");
  const disableUserStmt = db.prepare("UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?");
  const setAutoDownloadStmt = db.prepare(
    "UPDATE users SET auto_download_enabled = ?, updated_at = datetime('now') WHERE id = ?"
  );
  const softDeleteUserStmt = db.prepare(
    "UPDATE users SET is_active = 0, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  );

  // Invite token statements
  const createInviteTokenStmt = db.prepare(
    'INSERT INTO invite_tokens (token, created_by, expires_at) VALUES (?, ?, ?)'
  );
  const getInviteTokenStmt = db.prepare('SELECT * FROM invite_tokens WHERE token = ?');
  const markInviteTokenUsedStmt = db.prepare('UPDATE invite_tokens SET used_by = ? WHERE token = ?');
  const listInviteTokensStmt = db.prepare('SELECT * FROM invite_tokens WHERE created_by = ? ORDER BY created_at DESC');
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

  // User credential (UK) statements
  const upsertUserCredentialStmt = db.prepare(
    `INSERT INTO user_credentials (user_id, uk_number, uk_password_encrypted)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       uk_number = excluded.uk_number,
       uk_password_encrypted = excluded.uk_password_encrypted,
       updated_at = datetime('now')`
  );
  const getUserCredentialStmt = db.prepare('SELECT * FROM user_credentials WHERE user_id = ?');
  const updateCredentialStatusStmt = db.prepare(
    `UPDATE user_credentials SET
       last_login_status = ?,
       last_login_error = ?,
       last_login_at = ?,
       updated_at = datetime('now')
     WHERE user_id = ?`
  );

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
    listActiveUsers: () => {
      try {
        return getActiveUsersStmt.all();
      } catch (error) {
        console.error('Failed to get active users from database:', error);
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
    getActiveUsersByIds: (ids) => {
      try {
        if (!Array.isArray(ids)) {
          throw new Error('ids must be an array');
        }
        return getActiveUsersByIdsStmt.all({ ids: JSON.stringify(ids) });
      } catch (error) {
        console.error('Failed to get active users by IDs from database:', error);
        throw error;
      }
    },
    upsertUsers: (users) => {
      if (!Array.isArray(users)) {
        throw new Error('users must be an array');
      }
      const insertMany = db.transaction((items) => {
        items.forEach((user) => {
          if (!user.id || (!user.login && !user.username)) {
            throw new Error('Each user must have id and login');
          }
          upsertUserStmt.run({
            id: user.id,
            login: user.login || user.username,
            role: user.role || 'user',
            flags: JSON.stringify(user.flags || {}),
            device_profile: user.deviceProfile || user.device_profile || null,
            output_dir: user.outputDir || user.output_dir || null,
            invite_token: user.invite_token || user.inviteToken || null,
            invited_by: user.invited_by || user.invitedBy || null,
            locale: user.locale || 'en',
            email: user.email || null,
            password_hash: user.password_hash || null,
            created_at: user.created_at || null,
            updated_at: user.updated_at || null,
            is_active: user.is_active !== undefined ? user.is_active : user.isActive !== undefined ? user.isActive : 1
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
    recordRun: ({ userId, status, ticketVersion, deviceProfile, message, errorMessage, filePath, timestamp }) => {
      try {
        return recordDownloadAttemptStmt.run(
          userId,
          deviceProfile || null,
          ticketVersion || null,
          status,
          message || null,
          errorMessage || null,
          filePath || null,
          timestamp
        );
      } catch (error) {
        console.error('Failed to record run:', error);
        throw error;
      }
    },
    recordTicket: ({
      userId,
      ticketVersion,
      contentHash,
      filePath,
      status = 'success',
      errorMessage = null,
      downloadedAt
    }) => {
      if (!userId || !ticketVersion) {
        throw new Error('userId and ticketVersion are required to record a ticket');
      }
      try {
        return recordTicketStmt.run({
          userId,
          ticketVersion,
          contentHash: contentHash || null,
          filePath: filePath || null,
          status,
          errorMessage,
          downloadedAt
        });
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
    isTicketVersionNew: ({ userId, ticketVersion, contentHash }) => {
      if (!userId) {
        throw new Error('userId is required');
      }
      if (!ticketVersion && !contentHash) {
        throw new Error('ticketVersion or contentHash is required');
      }
      try {
        if (ticketVersion) {
          const existing = getTicketByVersionStmt.get(userId, ticketVersion);
          if (existing) {
            return false;
          }
        }
        if (contentHash) {
          const existingByHash = getTicketByHashStmt.get(userId, contentHash);
          if (existingByHash) {
            return false;
          }
        }
        return true;
      } catch (error) {
        console.error('Failed to determine ticket version status:', error);
        throw error;
      }
    },
    getLatestTicketVersion: (userId) => {
      if (!userId) {
        throw new Error('userId is required');
      }
      try {
        return getLatestTicketStmt.get(userId);
      } catch (error) {
        console.error('Failed to get latest ticket:', error);
        throw error;
      }
    },
    getTicketHistory: (userId, limit = 50) => {
      if (!userId) {
        throw new Error('userId is required');
      }
      try {
        return getHistoryByUserStmt.all(userId, limit);
      } catch (error) {
        console.error('Failed to fetch ticket history:', error);
        throw error;
      }
    },
    getTicketStats: (userId) => {
      if (!userId) {
        throw new Error('userId is required');
      }
      try {
        const rows = aggregateStatsStmt.all(userId);
        return rows.reduce((acc, row) => ({ ...acc, [row.status || 'unknown']: row.count }), { success: 0, error: 0 });
      } catch (error) {
        console.error('Failed to aggregate ticket stats:', error);
        throw error;
      }
    },
    getRecentErrors: (limit = 50) => {
      try {
        return getRecentErrorsStmt.all(limit);
      } catch (error) {
        console.error('Failed to read recent errors:', error);
        throw error;
      }
    },
    summarizeJobsSince: (windowHours = 24) => {
      try {
        const window = `-${Math.max(1, Number(windowHours) || 24)} hours`;
        const rows = getJobSummarySinceStmt.all({ window });
        return rows.reduce((acc, row) => ({ ...acc, [row.status || 'unknown']: row.count }), { success: 0, error: 0 });
      } catch (error) {
        console.error('Failed to summarize jobs:', error);
        throw error;
      }
    },
    setBaseTicketState: ({ baseTicketHash, effectiveFrom, lastCheckedAt }) => {
      try {
        return setBaseTicketStateStmt.run({
          base_ticket_hash: baseTicketHash || null,
          effective_from: effectiveFrom || null,
          last_checked_at: lastCheckedAt || null,
          updated_at: null
        });
      } catch (error) {
        console.error('Failed to persist base ticket state:', error);
        throw error;
      }
    },
    getBaseTicketState: () => {
      try {
        return getBaseTicketStateStmt.get();
      } catch (error) {
        console.error('Failed to read base ticket state:', error);
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
    getActiveUserById: (id) => {
      try {
        if (!id) {
          throw new Error('id is required');
        }
        return getActiveUserByIdStmt.get(id);
      } catch (error) {
        console.error('Failed to get active user by id:', error);
        throw error;
      }
    },
    createUser: ({
      id,
      login,
      email,
      passwordHash,
      role,
      inviteToken,
      invitedBy,
      locale,
      isActive,
      autoDownloadEnabled
    }) => {
      try {
        const resolvedLogin = login || email;
        if (!resolvedLogin) {
          throw new Error('login is required to create a user');
        }
        return createUserStmt.run(
          id,
          resolvedLogin,
          email,
          passwordHash,
          role || 'user',
          inviteToken || null,
          invitedBy || null,
          locale || 'en',
          isActive !== undefined ? isActive : 1,
          autoDownloadEnabled ? 1 : 0
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
    setAutoDownload: (id, enabled) => {
      try {
        return setAutoDownloadStmt.run(enabled ? 1 : 0, id);
      } catch (error) {
        console.error('Failed to update auto download flag:', error);
        throw error;
      }
    },
    softDeleteUser: (id) => {
      try {
        return softDeleteUserStmt.run(id);
      } catch (error) {
        console.error('Failed to soft delete user:', error);
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

    createUserCredential: ({ userId, ukNumber, ukPasswordEncrypted }) => {
      try {
        return upsertUserCredentialStmt.run(userId, ukNumber, ukPasswordEncrypted);
      } catch (error) {
        console.error('Failed to create user credential:', error);
        throw error;
      }
    },
    upsertUserCredential: ({ userId, ukNumber, ukPasswordEncrypted }) => {
      try {
        return upsertUserCredentialStmt.run(userId, ukNumber, ukPasswordEncrypted);
      } catch (error) {
        console.error('Failed to upsert user credential:', error);
        throw error;
      }
    },
    getUserCredential: (userId) => {
      try {
        return getUserCredentialStmt.get(userId);
      } catch (error) {
        console.error('Failed to get user credential:', error);
        throw error;
      }
    },
    updateUserCredentialStatus: ({ userId, status, error: errorMessage, loggedInAt }) => {
      try {
        return updateCredentialStatusStmt.run(status || null, errorMessage || null, loggedInAt || null, userId);
      } catch (error) {
        console.error('Failed to update user credential status:', error);
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
