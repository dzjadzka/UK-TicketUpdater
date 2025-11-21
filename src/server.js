const express = require('express');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { downloadTickets } = require('./downloader');
const { createDatabase } = require('./db');
const { DEFAULT_HISTORY_PATH } = require('./history');
const { validateDeviceProfile } = require('./deviceProfiles');
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
  encrypt,
  getEncryptionKey
} = require('./auth');

const PORT = process.env.PORT || 3000;
const DEFAULT_DB_PATH = process.env.DB_PATH || './data/app.db';
const DEFAULT_OUTPUT = process.env.OUTPUT_ROOT || './downloads';
const DEFAULT_DEVICE = process.env.DEFAULT_DEVICE || 'desktop_chrome';
const ENCRYPTION_KEY = getEncryptionKey();

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
    const db = req.app?.locals?.db;
    if (!db) {
      req.user = decoded;
      return next();
    }

    const user = db.getActiveUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found or deleted' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
      auto_download_enabled: !!user.auto_download_enabled
    };
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
  app.locals.db = db;

  function sanitizeUser(user) {
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
      is_active: !!user.is_active,
      auto_download_enabled: !!user.auto_download_enabled,
      deleted_at: user.deleted_at || null,
      invited_by: user.invited_by || null,
      created_at: user.created_at
    };
  }

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
      const { inviteToken, email, password, locale, autoDownloadEnabled } = req.body;

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
        isActive: 1,
        autoDownloadEnabled
      });

      // Mark invite as used
      db.markInviteTokenUsed(inviteToken, userId);

      // Generate JWT token
      const token = generateToken({ id: userId, email, role: 'user' });

      res.status(201).json({
        message: 'User created successfully',
        token,
        user: sanitizeUser(db.getUserById(userId))
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

      if (!user.password_hash) {
        return res.status(401).json({ error: 'Account needs password reset under new auth scheme' });
      }

      const isValid = await comparePassword(password, user.password_hash);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken({ id: user.id, email: user.email, role: user.role });

      res.json({
        message: 'Login successful',
        token,
        user: sanitizeUser(user)
      });
    } catch (error) {
      console.error('Login failed:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/auth/logout', jwtAuthMiddleware, (req, res) => {
    // JWTs are stateless; client should discard token
    res.json({ message: 'Logged out' });
  });

  app.post('/auth/reset-password', (req, res) => {
    res.status(202).json({ message: 'Password reset flow is not yet implemented. Please contact support.' });
  });

  // Current user routes
  app.get('/me', jwtAuthMiddleware, (req, res) => {
    const user = db.getUserById(req.user.id);
    res.json({ user: sanitizeUser(user) });
  });

  app.patch('/me/auto-download', jwtAuthMiddleware, (req, res) => {
    const { enabled } = req.body;
    if (enabled === undefined || typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    db.setAutoDownload(req.user.id, enabled);
    const updated = db.getUserById(req.user.id);
    res.json({ user: sanitizeUser(updated) });
  });

  app.get('/me/credentials', jwtAuthMiddleware, (req, res) => {
    const credential = db.getUserCredential(req.user.id);
    if (!credential) {
      return res.json({ credential: null });
    }
    res.json({
      credential: {
        uk_number: credential.uk_number,
        has_password: !!credential.uk_password_encrypted,
        last_login_status: credential.last_login_status || null,
        last_login_error: credential.last_login_error || null,
        last_login_at: credential.last_login_at || null,
        updated_at: credential.updated_at
      }
    });
  });

  app.put('/me/credentials', jwtAuthMiddleware, (req, res) => {
    const { ukNumber, ukPassword } = req.body || {};
    if (!ukNumber || !ukPassword) {
      return res.status(400).json({ error: 'ukNumber and ukPassword are required' });
    }

    const encrypted = encrypt(ukPassword, ENCRYPTION_KEY);
    db.upsertUserCredential({
      userId: req.user.id,
      ukNumber,
      ukPasswordEncrypted: encrypted
    });

    res.json({
      message: 'Credentials saved',
      credential: { uk_number: ukNumber, has_password: true }
    });
  });

  app.get('/me/tickets', jwtAuthMiddleware, (req, res) => {
    res.json({ tickets: db.listTicketsByUser(req.user.id) });
  });

  app.delete('/me', jwtAuthMiddleware, (req, res) => {
    db.softDeleteUser(req.user.id);
    res.json({ message: 'Account deleted' });
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
      const includeDeleted = req.query.includeDeleted === 'true';
      const query = (req.query.q || '').toLowerCase();
      const users = includeDeleted ? db.getUsers() : db.listActiveUsers();
      const filtered = query
        ? users.filter((u) => (u.email || '').toLowerCase().includes(query) || (u.id || '').toLowerCase().includes(query))
        : users;
      res.json({ users: filtered.map(sanitizeUser) });
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

  app.delete('/admin/users/:id', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      db.softDeleteUser(id);
      res.json({ message: 'User deleted' });
    } catch (error) {
      console.error('Failed to delete user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  app.get('/admin/users/:id/credentials', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const user = db.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const credential = db.getUserCredential(id);
      if (!credential) {
        return res.json({ user: sanitizeUser(user), credential: null });
      }
      res.json({
        user: sanitizeUser(user),
        credential: {
          uk_number: credential.uk_number,
          has_password: !!credential.uk_password_encrypted,
          last_login_status: credential.last_login_status || null,
          last_login_error: credential.last_login_error || null,
          last_login_at: credential.last_login_at || null,
          updated_at: credential.updated_at
        }
      });
    } catch (error) {
      console.error('Failed to get user credentials:', error);
      res.status(500).json({ error: 'Failed to get user credentials' });
    }
  });

  app.put('/admin/users/:id/credentials', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { ukNumber, ukPassword } = req.body || {};
      const user = db.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (!ukNumber || !ukPassword) {
        return res.status(400).json({ error: 'ukNumber and ukPassword are required' });
      }

      const encrypted = encrypt(ukPassword, ENCRYPTION_KEY);
      db.upsertUserCredential({ userId: id, ukNumber, ukPasswordEncrypted: encrypted });

      res.json({ message: 'Credentials updated', user: sanitizeUser(user) });
    } catch (error) {
      console.error('Failed to update user credentials:', error);
      res.status(500).json({ error: 'Failed to update user credentials' });
    }
  });

  app.get('/admin/users/:id/status', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const user = db.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const credential = db.getUserCredential(id);
      res.json({
        user: sanitizeUser(user),
        status: {
          last_login_status: credential ? credential.last_login_status : null,
          last_login_error: credential ? credential.last_login_error : null,
          last_login_at: credential ? credential.last_login_at : null
        }
      });
    } catch (error) {
      console.error('Failed to get user status:', error);
      res.status(500).json({ error: 'Failed to get user status' });
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
      const encrypted = encrypt(loginPassword, ENCRYPTION_KEY);

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

      const encrypted = loginPassword ? encrypt(loginPassword, ENCRYPTION_KEY) : existing.login_password_encrypted;

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

      // Prepare profile for validation
      const profileToValidate = {
        name,
        user_agent: userAgent,
        viewport_width: viewportWidth,
        viewport_height: viewportHeight,
        locale: locale || 'de-DE',
        timezone: timezone || 'Europe/Berlin',
        proxy_url: proxyUrl || null,
        geolocation_latitude: geolocationLatitude !== undefined ? geolocationLatitude : null,
        geolocation_longitude: geolocationLongitude !== undefined ? geolocationLongitude : null
      };

      // Validate device profile
      const validation = validateDeviceProfile(profileToValidate);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid device profile', details: validation.errors });
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
        geolocationLatitude: geolocationLatitude !== undefined ? geolocationLatitude : null,
        geolocationLongitude: geolocationLongitude !== undefined ? geolocationLongitude : null
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

      // Prepare updated profile for validation
      const updatedProfile = {
        name: name || existing.name,
        user_agent: userAgent || existing.user_agent,
        viewport_width: viewportWidth || existing.viewport_width,
        viewport_height: viewportHeight || existing.viewport_height,
        locale: locale || existing.locale,
        timezone: timezone || existing.timezone,
        proxy_url: proxyUrl !== undefined ? proxyUrl : existing.proxy_url,
        geolocation_latitude: geolocationLatitude !== undefined ? geolocationLatitude : existing.geolocation_latitude,
        geolocation_longitude: geolocationLongitude !== undefined ? geolocationLongitude : existing.geolocation_longitude
      };

      // Validate updated profile
      const validation = validateDeviceProfile(updatedProfile);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid device profile', details: validation.errors });
      }

      db.updateDeviceProfile({
        id,
        userId: req.user.id,
        name: updatedProfile.name,
        userAgent: updatedProfile.user_agent,
        viewportWidth: updatedProfile.viewport_width,
        viewportHeight: updatedProfile.viewport_height,
        locale: updatedProfile.locale,
        timezone: updatedProfile.timezone,
        proxyUrl: updatedProfile.proxy_url,
        geolocationLatitude: updatedProfile.geolocation_latitude,
        geolocationLongitude: updatedProfile.geolocation_longitude
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

  // Protected operational routes (admin-only)
  app.post('/downloads', jwtAuthMiddleware, requireAdmin, async (req, res) => {
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

      const users = Array.isArray(userIds) && userIds.length ? db.getActiveUsersByIds(userIds) : db.listActiveUsers();
      if (!users.length) {
        return res.status(400).json({ error: 'No users available' });
      }

      const results = await downloadTickets(users, {
        defaultDeviceProfile: deviceProfile || DEFAULT_DEVICE,
        outputRoot: path.resolve(outputDir || outputRoot),
        historyPath: DEFAULT_HISTORY_PATH,
        db,
        encryptionKey: ENCRYPTION_KEY
      });
      res.json({ results });
    } catch (error) {
      console.error('Failed to run download via API', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/history', jwtAuthMiddleware, requireAdmin, (req, res) => {
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

  app.get('/tickets/:userId', jwtAuthMiddleware, requireAdmin, (req, res) => {
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

  // Phase 2: Job management endpoints (admin-only)
  const { JobQueue, JobType } = require('./jobs');
  const jobQueue = new JobQueue({
    maxConcurrency: 3,
    maxRetries: 2,
    db,
    encryptionKey: ENCRYPTION_KEY,
    outputRoot: DEFAULT_OUTPUT,
    defaultDeviceProfile: DEFAULT_DEVICE
  });

  app.post('/admin/jobs/check-base-ticket', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { adminUserId } = req.body;

      if (!adminUserId) {
        return res.status(400).json({ error: 'adminUserId is required' });
      }

      // Verify admin user exists and has admin role
      const adminUser = db.getUserById(adminUserId);
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(400).json({ error: 'Invalid admin user' });
      }

      const jobId = jobQueue.enqueue(JobType.CHECK_BASE_TICKET, { adminUserId });
      res.status(202).json({ jobId, message: 'Base ticket check job enqueued' });
    } catch (error) {
      console.error('Failed to enqueue base ticket check job:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/admin/jobs/download-all-users', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const jobId = jobQueue.enqueue(JobType.DOWNLOAD_TICKETS_FOR_ALL_USERS, {
        triggeredBy: req.user.id
      });
      res.status(202).json({ jobId, message: 'Download all users job enqueued' });
    } catch (error) {
      console.error('Failed to enqueue download all users job:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/admin/jobs/download-user', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const jobId = jobQueue.enqueue(JobType.DOWNLOAD_TICKET_FOR_USER, {
        userId,
        triggeredBy: req.user.id
      });
      res.status(202).json({ jobId, message: 'Download user job enqueued' });
    } catch (error) {
      console.error('Failed to enqueue download user job:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/admin/jobs', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { type, status, limit } = req.query;
      const filter = {};

      if (type) {
        filter.type = type;
      }
      if (status) {
        filter.status = status;
      }
      if (limit) {
        filter.limit = Number.parseInt(limit, 10);
      }

      const jobs = jobQueue.listJobs(filter);
      res.json({ jobs });
    } catch (error) {
      console.error('Failed to list jobs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/admin/jobs/:jobId', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { jobId } = req.params;
      const job = jobQueue.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json({ job });
    } catch (error) {
      console.error('Failed to get job:', error);
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

module.exports = { createApp, start, jwtAuthMiddleware, requireAdmin, requestLogger };
