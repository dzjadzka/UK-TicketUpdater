const request = require('supertest');
const { createApp } = require('../src/server');
const { encrypt } = require('../src/auth');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      goto: jest.fn().mockResolvedValue({}),
      waitForSelector: jest.fn().mockResolvedValue({}),
      type: jest.fn().mockResolvedValue({}),
      click: jest.fn().mockResolvedValue({}),
      content: jest.fn().mockResolvedValue('<html>NVV-Semesterticket</html>'),
      close: jest.fn().mockResolvedValue({})
    }),
    close: jest.fn().mockResolvedValue({})
  })
}));

describe('Job API Endpoints', () => {
  let app;
  let db;
  let adminToken;
  let userToken;
  let tempDir;

  beforeEach(async () => {
    // Create temporary directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-api-test-'));
    const dbPath = path.join(tempDir, 'test.db');

    // Set environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!!';
    process.env.DB_PATH = dbPath;

    // Create app with test database
    const appResult = createApp({ dbPath });
    app = appResult.app;
    db = appResult.db;

    // Create admin user (login required)
    const adminId = 'admin-test-id';
    db.createUser({
      id: adminId,
      login: 'adminlogin',
      email: 'admin@test.com',
      passwordHash: 'hashedPassword',
      role: 'admin',
      isActive: 1,
      autoDownloadEnabled: false
    });

    // Create regular user (login required)
    const userId = 'user-test-id';
    db.createUser({
      id: userId,
      login: 'userlogin',
      email: 'user@test.com',
      passwordHash: 'hashedPassword',
      role: 'user',
      isActive: 1,
      autoDownloadEnabled: false
    });

    // Get tokens
    const adminLoginRes = await request(app).post('/auth/login').send({
      email: 'admin@test.com',
      password: 'Test1234'
    });
    adminToken = adminLoginRes.body.token;

    const userLoginRes = await request(app).post('/auth/login').send({
      email: 'user@test.com',
      password: 'Test1234'
    });
    userToken = userLoginRes.body.token;

    // Add UK credentials for admin
    const encryptedPassword = encrypt('adminPassword', process.env.ENCRYPTION_KEY);
    db.upsertUserCredential({ userId: adminId, ukNumber: '99999', ukPasswordEncrypted: encryptedPassword });
  });

  afterEach(async () => {
    // Wait a bit for any async job processing to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (db && db.db) {
      db.db.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('POST /admin/jobs/check-base-ticket', () => {
    it('should require authentication', async () => {
      const res = await request(app).post('/admin/jobs/check-base-ticket').send({
        adminUserId: 'admin-test-id'
      });

      expect(res.status).toBe(401);
    });

    it('should require admin role', async () => {
      const res = await request(app)
        .post('/admin/jobs/check-base-ticket')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          adminUserId: 'admin-test-id'
        });

      expect(res.status).toBe(403);
    });

    it('should require adminUserId', async () => {
      const res = await request(app)
        .post('/admin/jobs/check-base-ticket')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('adminUserId is required');
    });

    it('should reject invalid admin user', async () => {
      const res = await request(app)
        .post('/admin/jobs/check-base-ticket')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          adminUserId: 'non-existent'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid admin user');
    });

    it('should reject non-admin user as adminUserId', async () => {
      const res = await request(app)
        .post('/admin/jobs/check-base-ticket')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          adminUserId: 'user-test-id'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid admin user');
    });

    it('should successfully enqueue base ticket check job', async () => {
      const res = await request(app)
        .post('/admin/jobs/check-base-ticket')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          adminUserId: 'admin-test-id'
        });

      expect(res.status).toBe(202);
      expect(res.body.jobId).toBeDefined();
      expect(res.body.message).toBe('Base ticket check job enqueued');
    });
  });

  describe('POST /admin/jobs/download-all-users', () => {
    it('should require authentication', async () => {
      const res = await request(app).post('/admin/jobs/download-all-users');

      expect(res.status).toBe(401);
    });

    it('should require admin role', async () => {
      const res = await request(app)
        .post('/admin/jobs/download-all-users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should successfully enqueue download all users job', async () => {
      const res = await request(app)
        .post('/admin/jobs/download-all-users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(202);
      expect(res.body.jobId).toBeDefined();
      expect(res.body.message).toBe('Download all users job enqueued');
    });
  });

  describe('POST /admin/jobs/download-user', () => {
    it('should require authentication', async () => {
      const res = await request(app).post('/admin/jobs/download-user').send({
        userId: 'user-test-id'
      });

      expect(res.status).toBe(401);
    });

    it('should require admin role', async () => {
      const res = await request(app)
        .post('/admin/jobs/download-user')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          userId: 'user-test-id'
        });

      expect(res.status).toBe(403);
    });

    it('should require userId', async () => {
      const res = await request(app)
        .post('/admin/jobs/download-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('userId is required');
    });

    it('should successfully enqueue download user job', async () => {
      const res = await request(app)
        .post('/admin/jobs/download-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: 'user-test-id'
        });

      expect(res.status).toBe(202);
      expect(res.body.jobId).toBeDefined();
      expect(res.body.message).toBe('Download user job enqueued');
    });
  });

  describe('GET /admin/jobs', () => {
    beforeEach(async () => {
      // Enqueue some jobs
      await request(app)
        .post('/admin/jobs/download-all-users')
        .set('Authorization', `Bearer ${adminToken}`);

      await request(app)
        .post('/admin/jobs/check-base-ticket')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ adminUserId: 'admin-test-id' });
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/admin/jobs');

      expect(res.status).toBe(401);
    });

    it('should require admin role', async () => {
      const res = await request(app).get('/admin/jobs').set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should list all jobs', async () => {
      const res = await request(app).get('/admin/jobs').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.jobs).toBeDefined();
      expect(Array.isArray(res.body.jobs)).toBe(true);
      expect(res.body.jobs.length).toBeGreaterThan(0);
    });

    it('should filter jobs by type', async () => {
      const res = await request(app)
        .get('/admin/jobs?type=checkBaseTicket')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.jobs).toBeDefined();
      expect(res.body.jobs.every((job) => job.type === 'checkBaseTicket')).toBe(true);
    });

    it('should filter jobs by status', async () => {
      const res = await request(app)
        .get('/admin/jobs?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.jobs).toBeDefined();
      expect(res.body.jobs.every((job) => job.status === 'pending')).toBe(true);
    });

    it('should limit number of jobs returned', async () => {
      const res = await request(app).get('/admin/jobs?limit=1').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.jobs).toBeDefined();
      expect(res.body.jobs.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /admin/jobs/:jobId', () => {
    let jobId;

    beforeEach(async () => {
      // Enqueue a job
      const res = await request(app)
        .post('/admin/jobs/download-user')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: 'user-test-id' });

      jobId = res.body.jobId;
    });

    it('should require authentication', async () => {
      const res = await request(app).get(`/admin/jobs/${jobId}`);

      expect(res.status).toBe(401);
    });

    it('should require admin role', async () => {
      const res = await request(app).get(`/admin/jobs/${jobId}`).set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent job', async () => {
      const res = await request(app)
        .get('/admin/jobs/non-existent-job-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Job not found');
    });

    it('should return job details', async () => {
      const res = await request(app).get(`/admin/jobs/${jobId}`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.job).toBeDefined();
      expect(res.body.job.id).toBe(jobId);
      expect(res.body.job.type).toBe('downloadTicketForUser');
    });
  });
});
