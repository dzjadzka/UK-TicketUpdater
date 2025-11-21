const TEST_ENCRYPTION_KEY = 'test-secret-key-1234567890123456';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || TEST_ENCRYPTION_KEY;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/server');
const { generateInviteToken, getInviteExpiration, decrypt, getEncryptionKey } = require('../src/auth');

describe('Authentication API', () => {
  let app;
  let db;
  let dbPath;
  let adminToken;
  let inviteToken;

  beforeEach(() => {
    // Create temporary test database
    dbPath = path.join(__dirname, `test-auth-${Date.now()}.db`);
    const result = createApp({ dbPath });
    app = result.app;
    db = result.db;

    // Create admin user for tests
    const adminId = 'admin-001';
    db.db
      .prepare('INSERT INTO users (id, login, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        adminId,
        'admin@example.com',
        'admin@example.com',
        '$2b$10$validHashForTesting12345678901234567890123456789',
        'admin',
        1
      );
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  describe('POST /auth/register', () => {
    beforeEach(() => {
      // Create valid invite token
      inviteToken = generateInviteToken();
      const expiresAt = getInviteExpiration();
      db.createInviteToken({
        token: inviteToken,
        createdBy: 'admin-001',
        expiresAt
      });
    });

    it('should register user with valid invite token', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          inviteToken,
          email: 'newuser@example.com',
          password: 'StrongPassword123',
          locale: 'en'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User created successfully');
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toMatchObject({
        email: 'newuser@example.com',
        role: 'user',
        locale: 'en'
      });
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          inviteToken,
          email: 'invalid-email',
          password: 'StrongPassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          inviteToken,
          email: 'newuser@example.com',
          password: 'weak'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('8 characters');
    });

    it('should reject registration with invalid invite token', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          inviteToken: 'invalid-token',
          email: 'newuser@example.com',
          password: 'StrongPassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid invite token');
    });

    it('should reject registration with used invite token', async () => {
      // Use the token first
      await request(app)
        .post('/auth/register')
        .send({
          inviteToken,
          email: 'first@example.com',
          password: 'StrongPassword123'
        });

      // Try to use it again
      const response = await request(app)
        .post('/auth/register')
        .send({
          inviteToken,
          email: 'second@example.com',
          password: 'StrongPassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already used');
    });

    it('should reject registration with expired invite token', async () => {
      const expiredToken = generateInviteToken();
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      db.createInviteToken({
        token: expiredToken,
        createdBy: 'admin-001',
        expiresAt: pastDate.toISOString()
      });

      const response = await request(app)
        .post('/auth/register')
        .send({
          inviteToken: expiredToken,
          email: 'newuser@example.com',
          password: 'StrongPassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('expired');
    });

    it('should reject duplicate email registration', async () => {
      // First registration
      await request(app)
        .post('/auth/register')
        .send({
          inviteToken,
          email: 'duplicate@example.com',
          password: 'StrongPassword123'
        });

      // Create another invite token
      const newInvite = generateInviteToken();
      db.createInviteToken({
        token: newInvite,
        createdBy: 'admin-001',
        expiresAt: getInviteExpiration()
      });

      // Try to register with same email
      const response = await request(app)
        .post('/auth/register')
        .send({
          inviteToken: newInvite,
          email: 'duplicate@example.com',
          password: 'StrongPassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already registered');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create test user with known password
      const { hashPassword } = require('../src/auth');
      const passwordHash = await hashPassword('TestPassword123');

      db.createUser({
        id: 'test-user-001',
        email: 'testuser@example.com',
        passwordHash,
        role: 'user',
        locale: 'en',
        isActive: 1
      });
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toMatchObject({
        email: 'testuser@example.com',
        role: 'user'
      });
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'WrongPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject login for disabled account', async () => {
      db.disableUser('test-user-001');

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'TestPassword123'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('disabled');
    });
  });

  describe('User self-service', () => {
    let userToken;
    const userId = 'self-user-001';

    beforeEach(async () => {
      const { hashPassword } = require('../src/auth');
      const passwordHash = await hashPassword('TestPassword123');

      db.createUser({
        id: userId,
        email: 'self@example.com',
        passwordHash,
        role: 'user',
        locale: 'en',
        isActive: 1
      });

      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'self@example.com',
          password: 'TestPassword123'
        });

      userToken = loginResponse.body.token;
    });

    it('returns own profile and toggles auto download flag', async () => {
      const meResponse = await request(app).get('/me').set('Authorization', `Bearer ${userToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.email).toBe('self@example.com');
      expect(meResponse.body.data.user.auto_download_enabled).toBe(false);

      const toggleResponse = await request(app)
        .put('/me/credentials')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ autoDownloadEnabled: true, ukNumber: 'UK-123', ukPassword: 'TicketPass123!' });

      expect(toggleResponse.status).toBe(200);
      expect(toggleResponse.body.data.user.auto_download_enabled).toBe(true);
    });

    it('stores UK credentials encrypted for the user', async () => {
      const saveResponse = await request(app)
        .put('/me/credentials')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ukNumber: 'UK-12345', ukPassword: 'TicketPass123!' });

      expect(saveResponse.status).toBe(200);
      expect(saveResponse.body.data.credential.uk_number_masked).toContain('45');

      const stored = db.getUserCredential(userId);
      expect(stored.uk_number).toBe('UK-12345');
      expect(stored.uk_password_encrypted).toBeDefined();
      expect(stored.uk_password_encrypted).not.toBe('TicketPass123!');
      const decrypted = decrypt(stored.uk_password_encrypted, getEncryptionKey());
      expect(decrypted).toBe('TicketPass123!');
    });

    it('prevents non-admin users from accessing admin routes', async () => {
      const response = await request(app).get('/admin/users').set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(403);
    });
  });

  describe('Admin endpoints', () => {
    beforeEach(async () => {
      const { hashPassword } = require('../src/auth');
      const passwordHash = await hashPassword('AdminPassword123');

      // Create admin with proper password
      db.db.prepare("DELETE FROM users WHERE id = 'admin-001'").run();
      db.createUser({
        id: 'admin-001',
        email: 'admin@example.com',
        passwordHash,
        role: 'admin',
        locale: 'en',
        isActive: 1
      });

      // Get admin token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'AdminPassword123'
        });

      adminToken = loginResponse.body.token;
    });

    describe('POST /admin/invites', () => {
      it('should create invite token as admin', async () => {
        const response = await request(app)
          .post('/admin/invites')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ expiresInHours: 24 });

        expect(response.status).toBe(201);
        expect(response.body.data.token).toBeDefined();
        expect(response.body.data.expiresAt).toBeDefined();
      });

      it('should reject invite creation without auth', async () => {
        const response = await request(app)
          .post('/admin/invites')
          .send({ expiresInHours: 24 });

        expect(response.status).toBe(401);
      });
    });

    describe('GET /admin/invites', () => {
      it('should list invite tokens as admin', async () => {
        // Create an invite first
        await request(app)
          .post('/admin/invites')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ expiresInHours: 24 });

        const response = await request(app)
          .get('/admin/invites')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.invites).toBeDefined();
        expect(Array.isArray(response.body.data.invites)).toBe(true);
      });

      it('should reject listing without auth', async () => {
        const response = await request(app)
          .get('/admin/invites');

        expect(response.status).toBe(401);
      });
    });

    describe('GET /admin/users', () => {
      it('should list all users as admin', async () => {
        const response = await request(app)
          .get('/admin/users')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.users).toBeDefined();
        expect(Array.isArray(response.body.data.users)).toBe(true);
        expect(response.body.data.users.length).toBeGreaterThan(0);
        // Should not expose sensitive fields
        expect(response.body.data.users[0].user.password_hash).toBeUndefined();
      });
    });

    describe('PUT /admin/users/:id/disable', () => {
      beforeEach(async () => {
        const { hashPassword } = require('../src/auth');
        const passwordHash = await hashPassword('UserPassword123');

        db.createUser({
          id: 'user-to-disable',
          email: 'disable@example.com',
          passwordHash,
          role: 'user',
          locale: 'en',
          isActive: 1
        });
      });

      it('should disable user as admin', async () => {
        const response = await request(app)
          .put('/admin/users/user-to-disable')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isActive: false });

        expect(response.status).toBe(200);
        expect(response.body.data.user.is_active).toBe(false);

        // Verify user is actually disabled
        const user = db.getUserById('user-to-disable');
        expect(user.is_active).toBe(0);
      });
    });

    it('allows admin to set user UK credentials', async () => {
      const { hashPassword } = require('../src/auth');
      const passwordHash = await hashPassword('UserPassword123');

      db.createUser({
        id: 'user-for-cred',
        email: 'cred@example.com',
        passwordHash,
        role: 'user',
        locale: 'en',
        isActive: 1
      });

      const response = await request(app)
        .put('/admin/users/user-for-cred')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ukNumber: 'UK-999', ukPassword: 'AdminSetPass123!' });

      expect(response.status).toBe(200);
      expect(response.body.data.credential.uk_number_masked).toContain('99');
      const stored = db.getUserCredential('user-for-cred');
      expect(stored.uk_number).toBe('UK-999');
      expect(stored.uk_password_encrypted).toBeDefined();
    });
  });
});
