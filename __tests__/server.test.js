const request = require('supertest');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

jest.mock('../src/downloader', () => ({
  downloadTickets: jest.fn().mockResolvedValue([])
}));

const { hashPassword } = require('../src/auth');
const { downloadTickets } = require('../src/downloader');

describe('protected operational routes', () => {
  const originalEnv = { ...process.env };
  const testDbPath = path.join(__dirname, '../data/test-app.db');
  const routes = [
    { method: 'post', path: '/downloads' },
    { method: 'get', path: '/history' },
    { method: 'get', path: '/tickets/example-user' }
  ];

  const removeTestDb = () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  };

  const createUser = async (db, { role = 'user', email }) => {
    const password = 'Password123';
    const passwordHash = await hashPassword(password);
    const id = crypto.randomUUID();
    db.createUser({
      id,
      email,
      passwordHash,
      role,
      inviteToken: null,
      invitedBy: null,
      locale: 'en',
      isActive: 1
    });
    return { id, email, password };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret' };
    removeTestDb();
  });

  afterAll(() => {
    process.env = originalEnv;
    removeTestDb();
  });

  it('rejects requests without a JWT', async () => {
    const { createApp } = require('../src/server');
    const { app } = createApp({ dbPath: testDbPath });

    for (const route of routes) {
      const response = await request(app)[route.method](route.path);
      expect(response.status).toBe(401);
      expect(response.body.error.message).toMatch(/missing authentication token/i);
    }
  });

  it('rejects non-admin users with a 403', async () => {
    const { createApp } = require('../src/server');
    const { app, db } = createApp({ dbPath: testDbPath });
    const user = await createUser(db, { role: 'user', email: 'user@example.com' });

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email: user.email, password: user.password });

    const token = loginResponse.body.token;
    expect(token).toBeTruthy();

    for (const route of routes) {
      const response = await request(app)[route.method](route.path).set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
      expect(response.body.error.message).toMatch(/admin access required/i);
    }
  });

  it('allows admin users and invokes route handlers', async () => {
    const { createApp } = require('../src/server');
    const { app, db } = createApp({ dbPath: testDbPath });
    const admin = await createUser(db, { role: 'admin', email: 'admin@example.com' });

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email: admin.email, password: admin.password });

    const token = loginResponse.body.token;
    expect(token).toBeTruthy();

    const downloadResponse = await request(app)
      .post('/downloads')
      .set('Authorization', `Bearer ${token}`);
    expect(downloadTickets).toHaveBeenCalled();
    expect(downloadResponse.status).not.toBe(401);
    expect(downloadResponse.status).not.toBe(403);

    const historyResponse = await request(app)
      .get('/history')
      .set('Authorization', `Bearer ${token}`);
    expect(historyResponse.status).toBe(200);

    const ticketsResponse = await request(app)
      .get(`/tickets/${admin.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(ticketsResponse.status).toBe(200);
  });

  it('returns structured errors for invalid download payloads', async () => {
    const { createApp } = require('../src/server');
    const { app, db } = createApp({ dbPath: testDbPath });
    const admin = await createUser(db, { role: 'admin', email: 'admin-observer@example.com' });

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email: admin.email, password: admin.password });

    const token = loginResponse.body.token;
    const response = await request(app)
      .post('/downloads')
      .set('Authorization', `Bearer ${token}`)
      .send({ userIds: 'not-an-array' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_user_ids');
    expect(response.headers['x-request-id']).toBeTruthy();
  });
});
