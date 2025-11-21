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
const { createJobSystem } = require('./jobs');
const { logger } = require('./logger');

const PORT = process.env.PORT || 3000;
const DEFAULT_DB_PATH = process.env.DB_PATH || './data/app.db';
const DEFAULT_OUTPUT = process.env.OUTPUT_ROOT || './downloads';
const DEFAULT_DEVICE = process.env.DEFAULT_DEVICE || 'desktop_chrome';
const ENCRYPTION_KEY = getEncryptionKey();

function ok(res, data, status = 200) {
  return res.status(status).json({ data, error: null });
}

function fail(res, status, code, message) {
  return res.status(status).json({ data: null, error: { code, message } });
}

// Unified error handler that outputs in {data, error} format
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR');
  const message = err.expose ? err.message : 'Unexpected server error';
  
  logger.error('request_failed', {
    request_id: req?.requestId,
    route: req?.originalUrl,
    method: req?.method,
    user_id: req?.user?.id,
    error: err
  });

  if (res.headersSent) {
    return next(err);
  }

  return fail(res, status, code, message);
}

/**
 * Request logging middleware
 * Adds unique request ID and logs incoming requests
 */
function requestLogger(req, res, next) {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const requestLoggerInstance = logger.child({ request_id: requestId, route: req.path, method: req.method });
  req.logger = requestLoggerInstance;

  const start = Date.now();
  requestLoggerInstance.info('request_started', { ip: req.ip, user_agent: req.get('user-agent') });

  res.on('finish', () => {
    const duration = Date.now() - start;
    requestLoggerInstance.info('request_completed', {
      status: res.statusCode,
      duration_ms: duration,
      user_id: req.user?.id
    });
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
    return fail(res, 401, 'AUTH_MISSING', 'Missing authentication token.');
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
      return fail(res, 401, 'USER_NOT_FOUND', 'User not found or deleted');
    }

    if (!user.is_active) {
      return fail(res, 403, 'ACCOUNT_DISABLED', 'Account is disabled');
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
    return fail(res, 401, 'AUTH_INVALID', error.message);
  }
}

/**
 * Admin role middleware
 * Requires user to have admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return fail(res, 403, 'ADMIN_REQUIRED', 'Admin access required.');
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
  const jobSystem = createJobSystem({
    db,
    defaults: { outputRoot, defaultDeviceProfile: DEFAULT_DEVICE, historyPath: DEFAULT_HISTORY_PATH }
  });
  app.locals.jobQueue = jobSystem.queue;
  app.locals.jobScheduler = jobSystem.scheduler;

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

  function maskUkNumber(ukNumber) {
    if (!ukNumber) {
      return null;
    }
    // For very short numbers, mask all but last 2 characters
    if (ukNumber.length <= 4) {
      return '*'.repeat(Math.max(0, ukNumber.length - 2)) + ukNumber.slice(-2);
    }
    // For longer numbers, show pattern: ***XX##
    const visible = ukNumber.slice(-2);
    return `${'*'.repeat(ukNumber.length - 4)}${ukNumber.slice(-4, -2)}${visible}`;
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
      req.logger?.error('Registration failed:', error);
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
      req.logger?.error('Login failed:', error);
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
  // GET /me - returns the current user's profile
  app.get('/me', jwtAuthMiddleware, (req, res) => {
    const user = db.getUserById(req.user.id);
    return ok(res, { user: sanitizeUser(user) });
  });

  // GET /me/credentials - fetch current user's UK credentials summary
  app.get('/me/credentials', jwtAuthMiddleware, (req, res) => {
    const user = db.getUserById(req.user.id);
    const credential = db.getUserCredential(req.user.id);
    if (!credential) {
      return ok(res, { user: sanitizeUser(user), credential: null });
    }

    return ok(res, {
      user: sanitizeUser(user),
      credential: {
        uk_number_masked: maskUkNumber(credential.uk_number),
        has_password: !!credential.uk_password_encrypted,
        auto_download_enabled: !!user.auto_download_enabled,
        last_login_status: credential.last_login_status || null,
        last_login_error: credential.last_login_error || null,
        last_login_at: credential.last_login_at || null,
        updated_at: credential.updated_at
      }
    });
  });

  // PUT /me/credentials - update UK number/password and auto-download flag
  app.put('/me/credentials', jwtAuthMiddleware, (req, res) => {
    const { ukNumber, ukPassword, autoDownloadEnabled } = req.body || {};
    if (!ukNumber && !ukPassword && autoDownloadEnabled === undefined) {
      return fail(res, 400, 'INVALID_BODY', 'Provide ukNumber, ukPassword, or autoDownloadEnabled');
    }

    if (ukNumber && typeof ukNumber !== 'string') {
      return fail(res, 400, 'INVALID_BODY', 'ukNumber must be a string');
    }

    if (ukPassword && typeof ukPassword !== 'string') {
      return fail(res, 400, 'INVALID_BODY', 'ukPassword must be a string');
    }

    if (autoDownloadEnabled !== undefined && typeof autoDownloadEnabled !== 'boolean') {
      return fail(res, 400, 'INVALID_BODY', 'autoDownloadEnabled must be a boolean');
    }

    const existing = db.getUserCredential(req.user.id);
    if (!existing && (!ukNumber || !ukPassword)) {
      return fail(res, 400, 'INVALID_BODY', 'ukNumber and ukPassword are required for first-time setup');
    }

    if (autoDownloadEnabled !== undefined) {
      db.setAutoDownload(req.user.id, autoDownloadEnabled);
    }

    if (ukNumber || ukPassword) {
      const encrypted = ukPassword ? encrypt(ukPassword, ENCRYPTION_KEY) : existing.uk_password_encrypted;
      db.upsertUserCredential({
        userId: req.user.id,
        ukNumber: ukNumber || existing.uk_number,
        ukPasswordEncrypted: encrypted
      });
    }

    const updatedUser = db.getUserById(req.user.id);
    const updatedCredential = db.getUserCredential(req.user.id);

    return ok(res, {
      message: 'Credentials saved',
      user: sanitizeUser(updatedUser),
      credential: {
        uk_number_masked: maskUkNumber(updatedCredential.uk_number),
        has_password: !!updatedCredential.uk_password_encrypted,
        auto_download_enabled: !!updatedUser.auto_download_enabled,
        updated_at: updatedCredential.updated_at
      }
    });
  });

  // GET /me/tickets - list tickets belonging to the current user
  app.get('/me/tickets', jwtAuthMiddleware, (req, res) => {
    const tickets = db.listTicketsByUser(req.user.id).map((ticket) => ({
      id: ticket.id,
      version: ticket.ticket_version,
      downloaded_at: ticket.downloaded_at,
      status: ticket.status,
      download_url: ticket.file_path || null,
      error_message: ticket.error_message || null
    }));

    return ok(res, { tickets });
  });

  // DELETE /me - soft delete (or anonymize) the current account
  app.delete('/me', jwtAuthMiddleware, (req, res) => {
    db.softDeleteUser(req.user.id);
    return ok(res, { message: 'Account deleted' });
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

      return ok(res, { token, expiresAt }, 201);
    } catch (error) {
      req.logger?.error('Failed to create invite token:', error);
      return fail(res, 500, 'INVITE_CREATE_FAILED', 'Failed to create invite token');
    }
  });

  app.get('/admin/invites', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const tokens = db.listInviteTokens(req.user.id);
      return ok(res, { invites: tokens });
    } catch (error) {
      req.logger?.error('Failed to list invite tokens:', error);
      return fail(res, 500, 'INVITE_LIST_FAILED', 'Failed to list invite tokens');
    }
  });

  app.delete('/admin/invites/:token', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { token } = req.params;
      db.deleteInviteToken(token);
      return ok(res, { message: 'Invite token deleted' });
    } catch (error) {
      req.logger?.error('Failed to delete invite token:', error);
      return fail(res, 500, 'INVITE_DELETE_FAILED', 'Failed to delete invite token');
    }
  });

  // GET /admin/users - list users with optional filtering
  app.get('/admin/users', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const query = (req.query.q || '').toLowerCase();
      const statusFilter = req.query.status || 'active';
      const includeErrors = req.query.errors === 'true';

      const allUsers = db.getUsers();
      const filteredUsers = allUsers.filter((u) => {
        if (statusFilter === 'active' && (!u.is_active || u.deleted_at)) {
          return false;
        }
        if (statusFilter === 'disabled' && u.is_active) {
          return false;
        }
        if (statusFilter === 'deleted' && !u.deleted_at) {
          return false;
        }
        if (query && !((u.email || '').toLowerCase().includes(query) || (u.id || '').toLowerCase().includes(query))) {
          return false;
        }
        return true;
      });

      const users = filteredUsers.map((user) => {
        const credential = db.getUserCredential(user.id);
        const item = { user: sanitizeUser(user), credential_status: null };
        if (credential) {
          item.credential_status = {
            last_login_status: credential.last_login_status || null,
            last_login_error: credential.last_login_error || null,
            last_login_at: credential.last_login_at || null
          };
        }
        if (includeErrors) {
          item.has_error = credential ? credential.last_login_status === 'error' : false;
        }
        return item;
      });

      return ok(res, { users });
    } catch (error) {
      req.logger?.error('Failed to list users:', error);
      return fail(res, 500, 'USER_LIST_FAILED', 'Failed to list users');
    }
  });

  // GET /admin/users/:id - full user detail
  app.get('/admin/users/:id', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const user = db.getUserById(id);
      if (!user) {
        return fail(res, 404, 'USER_NOT_FOUND', 'User not found');
      }

      const credential = db.getUserCredential(id);
      const latestTicket = db.getLatestTicket(id);
      const history = db.getTicketStats(id);

      let credentialDetails = null;
      if (credential) {
        credentialDetails = {
          uk_number_masked: maskUkNumber(credential.uk_number),
          has_password: !!credential.uk_password_encrypted,
          last_login_status: credential.last_login_status || null,
          last_login_error: credential.last_login_error || null,
          last_login_at: credential.last_login_at || null
        };
      }

      let latestTicketDetails = null;
      if (latestTicket) {
        latestTicketDetails = {
          version: latestTicket.ticket_version,
          downloaded_at: latestTicket.downloaded_at,
          status: latestTicket.status,
          download_url: latestTicket.file_path || null
        };
      }

      return ok(res, {
        user: sanitizeUser(user),
        credential: credentialDetails,
        last_ticket: latestTicketDetails,
        ticket_stats: history
      });
    } catch (error) {
      req.logger?.error('Failed to fetch user detail:', error);
      return fail(res, 500, 'USER_DETAIL_FAILED', 'Failed to fetch user detail');
    }
  });

  // PUT /admin/users/:id - update credentials/flags
  app.put('/admin/users/:id', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { ukNumber, ukPassword, autoDownloadEnabled, isActive } = req.body || {};

      const user = db.getUserById(id);
      if (!user) {
        return fail(res, 404, 'USER_NOT_FOUND', 'User not found');
      }

      if (autoDownloadEnabled !== undefined) {
        if (typeof autoDownloadEnabled !== 'boolean') {
          return fail(res, 400, 'INVALID_BODY', 'autoDownloadEnabled must be a boolean');
        }
        db.setAutoDownload(id, autoDownloadEnabled);
      }

      if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') {
          return fail(res, 400, 'INVALID_BODY', 'isActive must be a boolean');
        }
        if (!isActive) {
          db.disableUser(id);
        }
      }

      if (ukNumber || ukPassword) {
        if (!ukNumber || !ukPassword) {
          return fail(res, 400, 'INVALID_BODY', 'ukNumber and ukPassword are required');
        }
        const encrypted = encrypt(ukPassword, ENCRYPTION_KEY);
        db.upsertUserCredential({ userId: id, ukNumber, ukPasswordEncrypted: encrypted });
      }

      const updated = db.getUserById(id);
      const credential = db.getUserCredential(id);
      let credentialDetails = null;
      if (credential) {
        credentialDetails = {
          uk_number_masked: maskUkNumber(credential.uk_number),
          has_password: !!credential.uk_password_encrypted
        };
      }

      return ok(res, {
        user: sanitizeUser(updated),
        credential: credentialDetails
      });
    } catch (error) {
      req.logger?.error('Failed to update user credentials:', error);
      return fail(res, 500, 'USER_UPDATE_FAILED', 'Failed to update user');
    }
  });

  // DELETE /admin/users/:id - soft delete user
  app.delete('/admin/users/:id', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      db.softDeleteUser(id);
      return ok(res, { message: 'User deleted' });
    } catch (error) {
      req.logger?.error('Failed to delete user:', error);
      return fail(res, 500, 'USER_DELETE_FAILED', 'Failed to delete user');
    }
  });

  // POST /admin/jobs/check-base-ticket - trigger base ticket check
  app.post('/admin/jobs/check-base-ticket', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const currentState = db.getBaseTicketState() || {};
      db.setBaseTicketState({
        baseTicketHash: currentState.base_ticket_hash,
        effectiveFrom: currentState.effective_from,
        lastCheckedAt: new Date().toISOString()
      });
      const updated = db.getBaseTicketState();
      return ok(res, { status: 'queued', state: updated });
    } catch (error) {
      req.logger?.error('Failed to enqueue base ticket check:', error);
      return fail(res, 500, 'JOB_ENQUEUE_FAILED', 'Failed to enqueue base ticket check');
    }
  });

  // POST /admin/jobs/download-all - enqueue downloads for all users
  app.post('/admin/jobs/download-all', jwtAuthMiddleware, requireAdmin, async (req, res) => {
    try {
      const users = db.listActiveUsers();
      if (!users.length) {
        return fail(res, 400, 'NO_USERS', 'No active users available');
      }

      const results = await downloadTickets(users, {
        defaultDeviceProfile: DEFAULT_DEVICE,
        outputRoot: path.resolve(outputRoot),
        historyPath: DEFAULT_HISTORY_PATH,
        db,
        encryptionKey: ENCRYPTION_KEY,
        logger: req.logger || logger
      });

      return ok(res, { status: 'queued', results });
    } catch (error) {
      req.logger?.error('Failed to trigger download-all job:', error);
      return fail(res, 500, 'JOB_ENQUEUE_FAILED', 'Failed to enqueue download job');
    }
  });

  // GET /admin/overview - high level stats
  app.get('/admin/overview', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const users = db.getUsers();
      const credentials = users.map((u) => db.getUserCredential(u.id)).filter(Boolean);
      const overview = {
        counts: {
          total: users.length,
          active: users.filter((u) => u.is_active && !u.deleted_at).length,
          disabled: users.filter((u) => !u.is_active && !u.deleted_at).length,
          deleted: users.filter((u) => !!u.deleted_at).length
        },
        login_errors: credentials.filter((c) => c.last_login_status === 'error').length,
        base_ticket_state: db.getBaseTicketState() || null
      };

      return ok(res, { overview });
    } catch (error) {
      req.logger?.error('Failed to load admin overview:', error);
      return fail(res, 500, 'OVERVIEW_FAILED', 'Failed to load overview');
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
      return ok(res, { credentials: sanitized });
    } catch (error) {
      req.logger?.error('Failed to get credentials:', error);
      return fail(res, 500, 'CREDENTIAL_LIST_FAILED', 'Failed to get credentials');
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
      req.logger?.error('Failed to create credential:', error);
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
      req.logger?.error('Failed to update credential:', error);
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
      req.logger?.error('Failed to delete credential:', error);
      res.status(500).json({ error: 'Failed to delete credential' });
    }
  });

  // Device profile management routes (JWT auth required)
  app.get('/device-profiles', jwtAuthMiddleware, (req, res) => {
    try {
      const profiles = db.getDeviceProfilesByUser(req.user.id);
      res.json({ profiles });
    } catch (error) {
      req.logger?.error('Failed to get device profiles:', error);
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
      req.logger?.error('Failed to create device profile:', error);
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
      req.logger?.error('Failed to update device profile:', error);
      res.status(500).json({ error: 'Failed to update device profile' });
    }
  });

  app.delete('/device-profiles/:id', jwtAuthMiddleware, (req, res) => {
    try {
      const { id } = req.params;
      const result = db.deleteDeviceProfile(id, req.user.id);

      if (result.changes === 0) {
        return fail(res, 404, 'PROFILE_NOT_FOUND', 'Device profile not found');
      }

      return ok(res, { message: 'Device profile deleted' });
    } catch (error) {
      req.logger?.error('Failed to delete device profile:', error);
      return fail(res, 500, 'PROFILE_DELETE_FAILED', 'Failed to delete device profile');
    }
  });

  // Protected operational routes (admin-only)
  app.post('/downloads', jwtAuthMiddleware, requireAdmin, async (req, res) => {
    try {
      const { userIds, deviceProfile, outputDir } = req.body || {};

      // Validate userIds if provided
      if (userIds !== undefined && !Array.isArray(userIds)) {
        return fail(res, 400, 'INVALID_BODY', 'userIds must be an array');
      }

      // Validate deviceProfile if provided
      if (deviceProfile && typeof deviceProfile !== 'string') {
        return fail(res, 400, 'INVALID_BODY', 'deviceProfile must be a string');
      }

      const users = Array.isArray(userIds) && userIds.length ? db.getActiveUsersByIds(userIds) : db.listActiveUsers();
      if (!users.length) {
        return fail(res, 400, 'NO_USERS', 'No users available');
      }

      const results = await downloadTickets(users, {
        defaultDeviceProfile: deviceProfile || DEFAULT_DEVICE,
        outputRoot: path.resolve(outputDir || outputRoot),
        historyPath: DEFAULT_HISTORY_PATH,
        db,
        encryptionKey: ENCRYPTION_KEY,
        logger: req.logger || logger
      });
      return ok(res, { results });
    } catch (error) {
      req.logger?.error('Failed to run download via API', error);
      return fail(res, 500, 'DOWNLOAD_FAILED', error.message);
    }
  });

  app.get('/history', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const limit = Number.parseInt(req.query.limit, 10) || 50;
      if (limit < 1 || limit > 1000) {
        return fail(res, 400, 'INVALID_QUERY', 'limit must be between 1 and 1000');
      }
      return ok(res, { history: db.listHistory(limit) });
    } catch (error) {
      req.logger?.error('Failed to retrieve history', error);
      return fail(res, 500, 'HISTORY_FAILED', error.message);
    }
  });

  app.get('/tickets/:userId', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId || typeof userId !== 'string') {
        return fail(res, 400, 'INVALID_PATH', 'userId must be a non-empty string');
      }
      return ok(res, { tickets: db.listTicketsByUser(userId) });
    } catch (error) {
      req.logger?.error('Failed to retrieve tickets', error);
      return fail(res, 500, 'TICKETS_FAILED', error.message);
    }
  });

  // Observability endpoints from PR38
  app.get('/admin/observability/errors', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
      const errors = db.getRecentErrors(limit);
      return ok(res, { errors });
    } catch (error) {
      req.logger?.error('observability_errors_failed', { error });
      return fail(res, 500, 'OBSERVABILITY_ERRORS_FAILED', 'Failed to load recent errors');
    }
  });

  app.get('/admin/observability/job-summary', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const hours = Math.max(1, Number(req.query.hours) || 24);
      const summary = db.summarizeJobsSince(hours);
      return ok(res, { window_hours: hours, summary });
    } catch (error) {
      req.logger?.error('observability_summary_failed', { error });
      return fail(res, 500, 'OBSERVABILITY_SUMMARY_FAILED', 'Failed to load job summary');
    }
  });

  app.get('/admin/observability/base-ticket', jwtAuthMiddleware, requireAdmin, (req, res) => {
    try {
      const state = db.getBaseTicketState();
      return ok(res, {
        state: {
          base_ticket_hash: state?.base_ticket_hash || null,
          effective_from: state?.effective_from || null,
          last_checked_at: state?.last_checked_at || null,
          updated_at: state?.updated_at || null
        }
      });
    } catch (error) {
      req.logger?.error('observability_base_ticket_failed', { error });
      return fail(res, 500, 'OBSERVABILITY_BASE_TICKET_FAILED', 'Failed to read base ticket state');
    }
  });

  app.use(errorHandler);

  return { app, db, jobQueue: jobSystem.queue, jobScheduler: jobSystem.scheduler };
}

function start() {
  const { app, db, jobScheduler } = createApp();
  const server = app.listen(PORT, () => {
    logger.info('server_started', { port: PORT });
  });

  if (jobScheduler && process.env.JOBS_SCHEDULER_ENABLED !== 'false') {
    jobScheduler.start();
  }

  const shutdown = () => {
    server.close(() => {
      if (jobScheduler) {
        jobScheduler.stop();
      }
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
