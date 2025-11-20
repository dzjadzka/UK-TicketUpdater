const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/server');
const { generateInviteToken, getInviteExpiration } = require('../src/auth');

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
    db.db.prepare(
      'INSERT INTO users (id, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)'
    ).run(
      adminId,
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
        expect(response.body.token).toBeDefined();
        expect(response.body.expiresAt).toBeDefined();
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
        expect(response.body.invites).toBeDefined();
        expect(Array.isArray(response.body.invites)).toBe(true);
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
        expect(response.body.users).toBeDefined();
        expect(Array.isArray(response.body.users)).toBe(true);
        expect(response.body.users.length).toBeGreaterThan(0);
        // Should not expose sensitive fields
        expect(response.body.users[0].password_hash).toBeUndefined();
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
          .put('/admin/users/user-to-disable/disable')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('disabled');

        // Verify user is actually disabled
        const user = db.getUserById('user-to-disable');
        expect(user.is_active).toBe(0);
      });
    });
  });
});
