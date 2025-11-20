const express = require('express');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { downloadTickets } = require('./downloader');
const { createDatabase } = require('./db');
const { DEFAULT_HISTORY_PATH } = require('./history');
const {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateInviteToken,
  getInviteExpiration,
  isInviteExpired,
  isValidEmail,
  validatePassword,
  encrypt
} = require('./auth');

const PORT = process.env.PORT || 3000;
const DEFAULT_DB_PATH = process.env.DB_PATH || './data/app.db';
const DEFAULT_OUTPUT = process.env.OUTPUT_ROOT || './downloads';
const DEFAULT_DEVICE = process.env.DEFAULT_DEVICE || 'desktop_chrome';
const API_TOKEN = process.env.API_TOKEN;
const ALLOW_INSECURE = process.env.ALLOW_INSECURE === 'true';

// ENCRYPTION_KEY is required for credential storage
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY environment variable is required in production');
  }
  // Only allow default in development/test
  console.warn('WARNING: Using default ENCRYPTION_KEY. Set ENCRYPTION_KEY environment variable for production.');
}

/**
 * Request logging middleware
 * Adds unique request ID and logs incoming requests
 */
function requestLogger(req, res, next) {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();
  console.log(`[${requestId}] ${req.method} ${req.path}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${requestId}] ${res.statusCode} ${duration}ms`);
  });

  next();
}

/**
 * Authentication middleware (legacy API token)
 * Validates API token or allows insecure access if configured
 */
function authMiddleware(req, res, next) {
  // If no API_TOKEN is set and ALLOW_INSECURE is not explicitly enabled, reject
  if (!API_TOKEN && !ALLOW_INSECURE) {
    return res.status(401).json({ error: 'API token not configured. Set API_TOKEN or ALLOW_INSECURE=true to bypass.' });
  }

  // If no API_TOKEN but ALLOW_INSECURE is enabled, allow access
  if (!API_TOKEN && ALLOW_INSECURE) {
    return next();
  }

  // Check for authorization header
  const authHeader = req.get('authorization');
  const bearerPrefix = 'bearer ';

  if (!authHeader || !authHeader.toLowerCase().startsWith(bearerPrefix)) {
    return res.status(401).json({ error: 'Missing API token.' });
  }

  const providedToken = authHeader.slice(bearerPrefix.length);

  if (providedToken !== API_TOKEN) {
    return res.status(401).json({ error: 'Invalid API token.' });
  }

  return next();
}

/**
 * JWT authentication middleware
 * Validates JWT token and attaches user to request
 */
function jwtAuthMiddleware(req, res, next) {
  const authHeader = req.get('authorization');
  const bearerPrefix = 'bearer ';

  if (!authHeader || !authHeader.toLowerCase().startsWith(bearerPrefix)) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  const token = authHeader.slice(bearerPrefix.length);

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

/**
 * Admin role middleware
 * Requires user to have admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

/**
 * Creates and configures Express application
 * @param {Object} options - Configuration options
 * @param {string} [options.dbPath] - Path to SQLite database
 * @param {string} [options.outputRoot] - Base output directory for downloads
 * @returns {Object} Object with app and db instances
 */
function createApp({ dbPath = DEFAULT_DB_PATH, outputRoot = DEFAULT_OUTPUT } = {}) {
  const app = express();
  const db = createDatabase(path.resolve(dbPath));

  // Rate limiting to prevent abuse
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  app.use(limiter);

  // Public routes (no auth required)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth routes (no auth middleware)
  app.post('/auth/register', async (req, res) => {
    try {
      const { inviteToken, email, password, locale } = req.body;

      // Validate input
      if (!inviteToken || !email || !password) {
        return res.status(400).json({ error: 'inviteToken, email, and password are required' });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      // Check invite token
      const invite = db.getInviteToken(inviteToken);
      if (!invite) {
        return res.status(400).json({ error: 'Invalid invite token' });
      }

      if (invite.used_by) {
        return res.status(400).json({ error: 'Invite token already used' });
      }

      if (isInviteExpired(invite.expires_at)) {
        return res.status(400).json({ error: 'Invite token has expired' });
      }

      // Check if email already exists
      const existingUser = db.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Create user
      const userId = crypto.randomUUID();
      const passwordHash = await hashPassword(password);

      db.createUser({
        id: userId,
        email,
        passwordHash,
        role: 'user',
        inviteToken,
        invitedBy: invite.created_by,
        locale: locale || 'en',
        isActive: 1
      });

      // Mark invite as used
      db.markInviteTokenUsed(inviteToken, userId);

      // Generate JWT token
      const token = generateToken({ id: userId, email, role: 'user' });

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: { id: userId, email, role: 'user', locale: locale || 'en' }
      });
    } catch (error) {
      console.error('Registration failed:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
      }

      const user = db.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is disabled' });
      }

      // Check if user has password_hash (new system) or password (legacy)
      const passwordHash = user.password_hash || user.password;
      const isValid = await comparePassword(password, passwordHash);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken({ id: user.id, email: user.email, role: user.role });

      res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, email: user.email, role: user.role, locale: user.locale }
      });
    } catch (error) {
      console.error('Login failed:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Admin routes
  app.post('/admin/invites', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { expiresInHours } = req.body;
      const token = generateInviteToken();
      const expiresAt = getInviteExpiration(expiresInHours);

      db.createInviteToken({
        token,
        createdBy: req.user.id,
        expiresAt
      });

      res.status(201).json({ token, expiresAt });
    } catch (error) {
      console.error('Failed to create invite token:', error);
      res.status(500).json({ error: 'Failed to create invite token' });
    }
  });

  app.get('/admin/invites', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const tokens = db.listInviteTokens(req.user.id);
      res.json({ invites: tokens });
    } catch (error) {
      console.error('Failed to list invite tokens:', error);
      res.status(500).json({ error: 'Failed to list invite tokens' });
    }
  });

  app.delete('/admin/invites/:token', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { token } = req.params;
      db.deleteInviteToken(token);
      res.json({ message: 'Invite token deleted' });
    } catch (error) {
      console.error('Failed to delete invite token:', error);
      res.status(500).json({ error: 'Failed to delete invite token' });
    }
  });

  app.get('/admin/users', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const users = db.getUsers();
      // Remove sensitive fields
      const sanitizedUsers = users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        locale: u.locale,
        is_active: u.is_active,
        created_at: u.created_at,
        invited_by: u.invited_by
      }));
      res.json({ users: sanitizedUsers });
    } catch (error) {
      console.error('Failed to list users:', error);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  app.put('/admin/users/:id/disable', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      db.disableUser(id);
      res.json({ message: 'User disabled' });
    } catch (error) {
      console.error('Failed to disable user:', error);
      res.status(500).json({ error: 'Failed to disable user' });
    }
  });

  // Credential management routes (JWT auth required)
  app.get('/credentials', jwtAuthMiddleware, (req, res) => {
    try {
      const credentials = db.getCredentialsByUser(req.user.id);
      // Don't return encrypted passwords
      const sanitized = credentials.map((c) => ({
        id: c.id,
        label: c.label,
        login_name: c.login_name,
        created_at: c.created_at,
        updated_at: c.updated_at
      }));
      res.json({ credentials: sanitized });
    } catch (error) {
      console.error('Failed to get credentials:', error);
      res.status(500).json({ error: 'Failed to get credentials' });
    }
  });

  app.post('/credentials', jwtAuthMiddleware, async (req, res) => {
    try {
      const { loginName, loginPassword, label } = req.body;

      if (!loginName || !loginPassword) {
        return res.status(400).json({ error: 'loginName and loginPassword are required' });
      }

      const id = crypto.randomUUID();
      const encryptionKey = ENCRYPTION_KEY || 'dev-key-DO-NOT-USE-IN-PRODUCTION';
      const encrypted = encrypt(loginPassword, encryptionKey);

      db.createCredential({
        id,
        userId: req.user.id,
        loginName,
        loginPasswordEncrypted: encrypted,
        label: label || null
      });

      res.status(201).json({
        message: 'Credential created',
        credential: { id, loginName, label, created_at: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Failed to create credential:', error);
      res.status(500).json({ error: 'Failed to create credential' });
    }
  });

  app.put('/credentials/:id', jwtAuthMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { loginName, loginPassword, label } = req.body;

      const existing = db.getCredentialById(id, req.user.id);
      if (!existing) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      const encryptionKey = ENCRYPTION_KEY || 'dev-key-DO-NOT-USE-IN-PRODUCTION';
      const encrypted = loginPassword ? encrypt(loginPassword, encryptionKey) : existing.login_password_encrypted;

      db.updateCredential({
        id,
        userId: req.user.id,
        loginName: loginName || existing.login_name,
        loginPasswordEncrypted: encrypted,
        label: label !== undefined ? label : existing.label
      });

      res.json({ message: 'Credential updated' });
    } catch (error) {
      console.error('Failed to update credential:', error);
      res.status(500).json({ error: 'Failed to update credential' });
    }
  });

  app.delete('/credentials/:id', jwtAuthMiddleware, (req, res) => {
    try {
      const { id } = req.params;
      const result = db.deleteCredential(id, req.user.id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      res.json({ message: 'Credential deleted' });
    } catch (error) {
      console.error('Failed to delete credential:', error);
      res.status(500).json({ error: 'Failed to delete credential' });
    }
  });

  // Device profile management routes (JWT auth required)
  app.get('/device-profiles', jwtAuthMiddleware, (req, res) => {
    try {
      const profiles = db.getDeviceProfilesByUser(req.user.id);
      res.json({ profiles });
    } catch (error) {
      console.error('Failed to get device profiles:', error);
      res.status(500).json({ error: 'Failed to get device profiles' });
    }
  });

  app.post('/device-profiles', jwtAuthMiddleware, (req, res) => {
    try {
      const {
        name,
        userAgent,
        viewportWidth,
        viewportHeight,
        locale,
        timezone,
        proxyUrl,
        geolocationLatitude,
        geolocationLongitude
      } = req.body;

      if (!name || !userAgent || !viewportWidth || !viewportHeight) {
        return res
          .status(400)
          .json({ error: 'name, userAgent, viewportWidth, and viewportHeight are required' });
      }

      const id = crypto.randomUUID();
      db.createDeviceProfile({
        id,
        userId: req.user.id,
        name,
        userAgent,
        viewportWidth,
        viewportHeight,
        locale: locale || 'de-DE',
        timezone: timezone || 'Europe/Berlin',
        proxyUrl: proxyUrl || null,
        geolocationLatitude: geolocationLatitude || null,
        geolocationLongitude: geolocationLongitude || null
      });

      res.status(201).json({ message: 'Device profile created', id });
    } catch (error) {
      console.error('Failed to create device profile:', error);
      res.status(500).json({ error: 'Failed to create device profile' });
    }
  });

  app.put('/device-profiles/:id', jwtAuthMiddleware, (req, res) => {
    try {
      const { id } = req.params;
      const {
        name,
        userAgent,
        viewportWidth,
        viewportHeight,
        locale,
        timezone,
        proxyUrl,
        geolocationLatitude,
        geolocationLongitude
      } = req.body;

      const existing = db.getDeviceProfileById(id, req.user.id);
      if (!existing) {
        return res.status(404).json({ error: 'Device profile not found' });
      }

      db.updateDeviceProfile({
        id,
        userId: req.user.id,
        name: name || existing.name,
        userAgent: userAgent || existing.user_agent,
        viewportWidth: viewportWidth || existing.viewport_width,
        viewportHeight: viewportHeight || existing.viewport_height,
        locale: locale || existing.locale,
        timezone: timezone || existing.timezone,
        proxyUrl: proxyUrl !== undefined ? proxyUrl : existing.proxy_url,
        geolocationLatitude: geolocationLatitude !== undefined ? geolocationLatitude : existing.geolocation_latitude,
        geolocationLongitude: geolocationLongitude !== undefined ? geolocationLongitude : existing.geolocation_longitude
      });

      res.json({ message: 'Device profile updated' });
    } catch (error) {
      console.error('Failed to update device profile:', error);
      res.status(500).json({ error: 'Failed to update device profile' });
    }
  });

  app.delete('/device-profiles/:id', jwtAuthMiddleware, (req, res) => {
    try {
      const { id } = req.params;
      const result = db.deleteDeviceProfile(id, req.user.id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Device profile not found' });
      }

      res.json({ message: 'Device profile deleted' });
    } catch (error) {
      console.error('Failed to delete device profile:', error);
      res.status(500).json({ error: 'Failed to delete device profile' });
    }
  });

  // Legacy routes (old API token auth)
  app.use(authMiddleware);

  app.post('/downloads', async (req, res) => {
    try {
      const { userIds, deviceProfile, outputDir } = req.body || {};

      // Validate userIds if provided
      if (userIds !== undefined && !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'userIds must be an array' });
      }

      // Validate deviceProfile if provided
      if (deviceProfile && typeof deviceProfile !== 'string') {
        return res.status(400).json({ error: 'deviceProfile must be a string' });
      }

      const users = Array.isArray(userIds) && userIds.length ? db.getUsersByIds(userIds) : db.getUsers();
      if (!users.length) {
        return res.status(400).json({ error: 'No users available' });
      }

      const results = await downloadTickets(users, {
        defaultDeviceProfile: deviceProfile || DEFAULT_DEVICE,
        outputRoot: path.resolve(outputDir || outputRoot),
        historyPath: DEFAULT_HISTORY_PATH,
        db
      });
      res.json({ results });
    } catch (error) {
      console.error('Failed to run download via API', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/history', (req, res) => {
    try {
      const limit = Number.parseInt(req.query.limit, 10) || 50;
      if (limit < 1 || limit > 1000) {
        return res.status(400).json({ error: 'limit must be between 1 and 1000' });
      }
      res.json({ history: db.listHistory(limit) });
    } catch (error) {
      console.error('Failed to retrieve history', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/tickets/:userId', (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId must be a non-empty string' });
      }
      res.json({ tickets: db.listTicketsByUser(userId) });
    } catch (error) {
      console.error('Failed to retrieve tickets', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error', err);
    res.status(500).json({ error: 'Unexpected server error' });
    next();
  });

  return { app, db };
}

function start() {
  const { app, db } = createApp();
  const server = app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start, authMiddleware, jwtAuthMiddleware, requireAdmin, requestLogger };
