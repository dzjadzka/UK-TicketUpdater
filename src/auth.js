const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SALT_ROUNDS = 10;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const INVITE_TOKEN_EXPIRY_HOURS = 72; // 3 days

// JWT_SECRET is required in production for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  // Only allow default in development/test
  console.warn('WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable for production.');
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a password with a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 * @param {object} user - User object with id, email, role
 * @returns {string} JWT token
 */
function generateToken(user) {
  const secret = JWT_SECRET || 'dev-secret-DO-NOT-USE-IN-PRODUCTION';
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    secret,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  try {
    const secret = JWT_SECRET || 'dev-secret-DO-NOT-USE-IN-PRODUCTION';
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Generate a random invite token
 * @returns {string} Random token
 */
function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get expiration date for invite token
 * @param {number} hours - Hours until expiration
 * @returns {string} ISO date string
 */
function getInviteExpiration(hours = INVITE_TOKEN_EXPIRY_HOURS) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

/**
 * Check if invite token is expired
 * @param {string} expiresAt - ISO date string
 * @returns {boolean} True if expired
 */
function isInviteExpired(expiresAt) {
  return new Date(expiresAt) < new Date();
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password
 * @returns {object} Validation result with isValid and message
 */
function validatePassword(password) {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  return { isValid: true, message: 'Password is valid' };
}

/**
 * Encrypt data using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @param {string} key - Encryption key (must be 32 bytes for AES-256)
 * @returns {string} Encrypted data in format: iv:authTag:encrypted
 */
function encrypt(text, key) {
  // Ensure key is 32 bytes for AES-256
  const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt data using AES-256-GCM
 * @param {string} encryptedData - Encrypted data in format: iv:authTag:encrypted
 * @param {string} key - Encryption key (must be 32 bytes for AES-256)
 * @returns {string} Decrypted plain text
 */
function decrypt(encryptedData, key) {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }

  const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateInviteToken,
  getInviteExpiration,
  isInviteExpired,
  isValidEmail,
  validatePassword,
  encrypt,
  decrypt,
  INVITE_TOKEN_EXPIRY_HOURS
};
