const express = require('express');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { downloadTickets } = require('./downloader');
const { createDatabase } = require('./db');
const { DEFAULT_HISTORY_PATH } = require('./history');
const { validateDeviceProfile } = require('./deviceProfiles');
const { logger } = require('./logger');
const { ApiError, asyncHandler, errorHandler } = require('./errors');
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
    return next(ApiError.unauthorized('missing_token', 'Missing authentication token.'));
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
      return next(ApiError.unauthorized('user_not_found', 'User not found or deleted'));
    }

    if (!user.is_active) {
      return next(ApiError.forbidden('account_disabled', 'Account is disabled'));
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
    return next(ApiError.unauthorized('invalid_token', error.message));
  }
}

/**
 * Admin role middleware
 * Requires user to have admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(ApiError.forbidden('admin_required', 'Admin access required.'));
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
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body.error === 'string') {
        const statusCode = res.statusCode || 500;
        body = {
          error: {
            code: statusCode >= 500 ? 'internal_error' : 'bad_request',
            message: body.error,
            request_id: req.requestId
          }
        };
      }
      return originalJson(body);
    };
    next();
  });
  app.use(limiter);

  // Public routes (no auth required)
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Auth routes (no auth middleware)
  app.post('/auth/register', asyncHandler(async (req, res, next) => {
    try {
      const { inviteToken, email, password, locale, autoDownloadEnabled } = req.body;

      // Validate input
      if (!inviteToken || !email || !password) {
        return next(ApiError.badRequest('missing_fields', 'inviteToken, email, and password are required'));
      }

      if (!isValidEmail(email)) {
        return next(ApiError.badRequest('invalid_email', 'Invalid email format'));
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return next(ApiError.badRequest('weak_password', passwordValidation.message));
      }

      // Check invite token
      const invite = db.getInviteToken(inviteToken);
      if (!invite) {
        return next(ApiError.badRequest('invalid_invite', 'Invalid invite token'));
      }

      if (invite.used_by) {
        return next(ApiError.badRequest('invite_used', 'Invite token already used'));
      }

      if (isInviteExpired(invite.expires_at)) {
        return next(ApiError.badRequest('invite_expired', 'Invite token has expired'));
      }

      // Check if email already exists
      const existingUser = db.getUserByEmail(email);
      if (existingUser) {
        return next(ApiError.badRequest('email_exists', 'Email already registered'));
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
      req.logger?.error('registration_failed', { error });
      next(ApiError.internal('registration_failed', 'Registration failed', error));
    }
  }));

  app.post('/auth/login', asyncHandler(async (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(ApiError.badRequest('missing_fields', 'email and password are required'));
      }

      const user = db.getUserByEmail(email);
      if (!user) {
        return next(ApiError.unauthorized('invalid_credentials', 'Invalid credentials'));
      }

      if (!user.is_active) {
        return next(ApiError.forbidden('account_disabled', 'Account is disabled'));
      }

      if (!user.password_hash) {
        return next(ApiError.unauthorized('password_reset_required', 'Account needs password reset under new auth scheme'));
      }

      const isValid = await comparePassword(password, user.password_hash);

      if (!isValid) {
        return next(ApiError.unauthorized('invalid_credentials', 'Invalid credentials'));
      }

      const token = generateToken({ id: user.id, email: user.email, role: user.role });

      res.json({
        message: 'Login successful',
        token,
        user: sanitizeUser(user)
      });
    } catch (error) {
      req.logger?.error('login_failed', { error });
      next(ApiError.internal('login_failed', 'Login failed', error));
    }
  }));

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

  app.delete('/device-profiles/:id', jwtAuthMiddleware, asyncHandler(async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = db.deleteDeviceProfile(id, req.user.id);

      if (result.changes === 0) {
        return next(ApiError.notFound('device_profile_not_found', 'Device profile not found'));
      }

      res.json({ message: 'Device profile deleted' });
    } catch (error) {
      req.logger?.error('device_profile_delete_failed', { error });
      next(ApiError.internal('device_profile_delete_failed', 'Failed to delete device profile', error));
    }
  }));

  // Protected operational routes (admin-only)
  app.post('/downloads', jwtAuthMiddleware, requireAdmin, asyncHandler(async (req, res, next) => {
    try {
      const { userIds, deviceProfile, outputDir } = req.body || {};

      // Validate userIds if provided
      if (userIds !== undefined && !Array.isArray(userIds)) {
        return next(ApiError.badRequest('invalid_user_ids', 'userIds must be an array'));
      }

      // Validate deviceProfile if provided
      if (deviceProfile && typeof deviceProfile !== 'string') {
        return next(ApiError.badRequest('invalid_device_profile', 'deviceProfile must be a string'));
      }

      const users = Array.isArray(userIds) && userIds.length ? db.getActiveUsersByIds(userIds) : db.listActiveUsers();
      if (!users.length) {
        return next(ApiError.badRequest('no_users', 'No users available'));
      }

      const results = await downloadTickets(users, {
        defaultDeviceProfile: deviceProfile || DEFAULT_DEVICE,
        outputRoot: path.resolve(outputDir || outputRoot),
        historyPath: DEFAULT_HISTORY_PATH,
        db,
        encryptionKey: ENCRYPTION_KEY,
        logger: req.logger || logger
      });
      res.json({ results });
    } catch (error) {
      req.logger?.error('download_job_failed', { error });
      next(ApiError.internal('download_job_failed', 'Failed to run download via API', error));
    }
  }));

  app.get('/admin/observability/errors', jwtAuthMiddleware, requireAdmin, asyncHandler(async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
      const errors = db.getRecentErrors(limit);
      res.json({ errors });
    } catch (error) {
      req.logger?.error('observability_errors_failed', { error });
      next(ApiError.internal('observability_errors_failed', 'Failed to load recent errors', error));
    }
  }));

  app.get('/admin/observability/job-summary', jwtAuthMiddleware, requireAdmin, asyncHandler(async (req, res, next) => {
    try {
      const hours = Math.max(1, Number(req.query.hours) || 24);
      const summary = db.summarizeJobsSince(hours);
      res.json({ window_hours: hours, summary });
    } catch (error) {
      req.logger?.error('observability_summary_failed', { error });
      next(ApiError.internal('observability_summary_failed', 'Failed to load job summary', error));
    }
  }));

  app.get('/admin/observability/base-ticket', jwtAuthMiddleware, requireAdmin, (req, res, next) => {
    try {
      const state = db.getBaseTicketState();
      res.json({
        state: {
          base_ticket_hash: state?.base_ticket_hash || null,
          effective_from: state?.effective_from || null,
          last_checked_at: state?.last_checked_at || null,
          updated_at: state?.updated_at || null
        }
      });
    } catch (error) {
      req.logger?.error('observability_base_ticket_failed', { error });
      next(ApiError.internal('observability_base_ticket_failed', 'Failed to read base ticket state', error));
    }
  });

  app.get('/history', jwtAuthMiddleware, requireAdmin, asyncHandler(async (req, res, next) => {
    try {
      const limit = Number.parseInt(req.query.limit, 10) || 50;
      if (limit < 1 || limit > 1000) {
        return next(ApiError.badRequest('invalid_limit', 'limit must be between 1 and 1000'));
      }
      res.json({ history: db.listHistory(limit) });
    } catch (error) {
      req.logger?.error('history_read_failed', { error });
      next(ApiError.internal('history_read_failed', 'Failed to retrieve history', error));
    }
  }));

  app.get('/tickets/:userId', jwtAuthMiddleware, requireAdmin, asyncHandler(async (req, res, next) => {
    try {
      const { userId } = req.params;
      if (!userId || typeof userId !== 'string') {
        return next(ApiError.badRequest('invalid_user_id', 'userId must be a non-empty string'));
      }
      res.json({ tickets: db.listTicketsByUser(userId) });
    } catch (error) {
      req.logger?.error('tickets_read_failed', { error });
      next(ApiError.internal('tickets_read_failed', 'Failed to retrieve tickets', error));
    }
  }));

  app.use(errorHandler);

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
