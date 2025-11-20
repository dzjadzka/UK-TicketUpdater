const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { createConnection } = require('./connection');

const ENCRYPTION_ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function encryptSensitive(data, secret) {
  if (!secret) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.createHash('sha256').update(secret).digest();
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptSensitive(payload, secret) {
  if (!payload || !secret) return null;
  const raw = Buffer.from(payload, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const data = raw.subarray(IV_LENGTH + 16);
  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

async function hashPassword(plain) {
  const saltRounds = 10;
  return bcrypt.hash(plain, saltRounds);
}

function mapUser(row) {
  if (!row) return null;
  const devicePrefs = row.device_preferences ? JSON.parse(row.device_preferences) : undefined;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    devicePreferences: devicePrefs,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    autoLogin: row.auto_login_encrypted,
  };
}

async function createUser({ username, password, role = 'user', devicePreferences, autoLoginData, autoLoginSecret }) {
  const db = createConnection();
  const passwordHash = await hashPassword(password);
  const encryptedLogin = autoLoginData ? encryptSensitive(autoLoginData, autoLoginSecret) : null;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        'INSERT INTO users (username, role, device_preferences) VALUES (?, ?, ?)',
        [username, role, JSON.stringify(devicePreferences || {})],
        function (err) {
          if (err) {
            db.close();
            reject(err);
            return;
          }
          const userId = this.lastID;
          db.run(
            'INSERT INTO credentials (user_id, password_hash, auto_login_encrypted) VALUES (?, ?, ?)',
            [userId, passwordHash, encryptedLogin],
            (credErr) => {
              db.close();
              if (credErr) {
                reject(credErr);
              } else {
                resolve(getUserById(userId, autoLoginSecret));
              }
            }
          );
        }
      );
    });
  });
}

function getUserById(id, autoLoginSecret) {
  const db = createConnection();
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT u.*, c.auto_login_encrypted FROM users u
       LEFT JOIN credentials c ON c.user_id = u.id
       WHERE u.id = ?`,
      [id],
      (err, row) => {
        db.close();
        if (err) return reject(err);
        const user = mapUser(row);
        if (user && user.autoLogin) {
          user.autoLoginDecrypted = decryptSensitive(user.autoLogin, autoLoginSecret);
        }
        resolve(user);
      }
    );
  });
}

function getUserByUsername(username, autoLoginSecret) {
  const db = createConnection();
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT u.*, c.auto_login_encrypted FROM users u
       LEFT JOIN credentials c ON c.user_id = u.id
       WHERE u.username = ?`,
      [username],
      (err, row) => {
        db.close();
        if (err) return reject(err);
        const user = mapUser(row);
        if (user && user.autoLogin) {
          user.autoLoginDecrypted = decryptSensitive(user.autoLogin, autoLoginSecret);
        }
        resolve(user);
      }
    );
  });
}

function getUsers(autoLoginSecret) {
  const db = createConnection();
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT u.*, c.auto_login_encrypted FROM users u
       LEFT JOIN credentials c ON c.user_id = u.id
       ORDER BY u.username`,
      [],
      (err, rows) => {
        db.close();
        if (err) return reject(err);
        const users = rows.map((row) => {
          const user = mapUser(row);
          if (user && user.autoLogin) {
            user.autoLoginDecrypted = decryptSensitive(user.autoLogin, autoLoginSecret);
          }
          return user;
        });
        resolve(users);
      }
    );
  });
}

function upsertCredential(userId, { password, autoLoginData, autoLoginSecret }) {
  const db = createConnection();
  return new Promise(async (resolve, reject) => {
    try {
      const passwordHash = password ? await hashPassword(password) : null;
      const encryptedLogin = autoLoginData ? encryptSensitive(autoLoginData, autoLoginSecret) : null;

      db.serialize(() => {
        if (passwordHash) {
          db.run(
            'UPDATE credentials SET password_hash = ?, auto_login_encrypted = COALESCE(?, auto_login_encrypted) WHERE user_id = ?',
            [passwordHash, encryptedLogin, userId]
          );
        } else if (encryptedLogin) {
          db.run('UPDATE credentials SET auto_login_encrypted = ? WHERE user_id = ?', [encryptedLogin, userId]);
        }
        db.get('SELECT * FROM credentials WHERE user_id = ?', [userId], (err, row) => {
          db.close();
          if (err) return reject(err);
          resolve(row);
        });
      });
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

module.exports = {
  createUser,
  getUsers,
  getUserById,
  getUserByUsername,
  upsertCredential,
  encryptSensitive,
  decryptSensitive,
};
