const request = require('supertest');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

jest.mock('../../src/downloader', () => ({
  downloadTickets: jest.fn().mockResolvedValue([{ userId: 'mock', status: 'queued' }])
}));

const { hashPassword } = require('../../src/auth');
const { downloadTickets } = require('../../src/downloader');

const TEST_DB = path.join(__dirname, '../../data/admin-api.db');

const removeDb = () => {
  if (fs.existsSync(TEST_DB)) {
    fs.unlinkSync(TEST_DB);
  }
};

const createUser = async (db, { email, role = 'user', autoDownloadEnabled = false }) => {
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  db.createUser({
    id,
    email,
    login: email,
    passwordHash,
    role,
    inviteToken: null,
    invitedBy: null,
    locale: 'en',
    isActive: 1,
    autoDownloadEnabled
  });
  return { id, email, password };
};

describe('admin & user API integration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    removeDb();
    process.env = { ...originalEnv, JWT_SECRET: 'integration-secret' };
  });

  afterAll(() => {
    process.env = originalEnv;
    removeDb();
  });

  test('forbids non-admin users from admin endpoints', async () => {
    const { createApp } = require('../../src/server');
    const { app, db } = createApp({ dbPath: TEST_DB });
    const user = await createUser(db, { email: 'user@example.com' });

    const login = await request(app).post('/auth/login').send({ email: user.email, password: user.password });
    const token = login.body.token;

    const response = await request(app).get('/admin/users').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ code: 'ADMIN_REQUIRED' });
  });

  test('admin can view users, edit credentials, and trigger jobs', async () => {
    const { createApp } = require('../../src/server');
    const { app, db } = createApp({ dbPath: TEST_DB });
    const admin = await createUser(db, { email: 'admin@example.com', role: 'admin' });
    const user = await createUser(db, { email: 'member@example.com' });

    const login = await request(app).post('/auth/login').send({ email: admin.email, password: admin.password });
    const adminToken = login.body.token;

    const list = await request(app).get('/admin/users').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.users.length).toBeGreaterThanOrEqual(2);

    const update = await request(app)
      .put(`/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ukNumber: '123456789', ukPassword: 'secret', autoDownloadEnabled: true });
    expect(update.status).toBe(200);
    expect(update.body.data.credential.uk_number_masked).toBeDefined();

    const overview = await request(app).get('/admin/overview').set('Authorization', `Bearer ${adminToken}`);
    expect(overview.status).toBe(200);
    expect(overview.body.data.overview.counts.total).toBeGreaterThanOrEqual(2);

    const job = await request(app).post('/admin/jobs/download-all').set('Authorization', `Bearer ${adminToken}`);
    expect(job.status).toBe(200);
    expect(downloadTickets).toHaveBeenCalled();

    const baseJob = await request(app).post('/admin/jobs/check-base-ticket').set('Authorization', `Bearer ${adminToken}`);
    expect(baseJob.status).toBe(200);
    expect(baseJob.body.data.state).toBeTruthy();
  });

  test('user endpoints expose only current user data', async () => {
    const { createApp } = require('../../src/server');
    const { app, db } = createApp({ dbPath: TEST_DB });
    const user = await createUser(db, { email: 'self@example.com', autoDownloadEnabled: false });

    const login = await request(app).post('/auth/login').send({ email: user.email, password: user.password });
    const token = login.body.token;

    const saveCreds = await request(app)
      .put('/me/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({ ukNumber: '987654321', ukPassword: 'user-secret', autoDownloadEnabled: true });
    expect(saveCreds.status).toBe(200);
    expect(saveCreds.body.data.credential.has_password).toBe(true);

    const me = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(user.email);

    const tickets = await request(app).get('/me/tickets').set('Authorization', `Bearer ${token}`);
    expect(tickets.status).toBe(200);
    expect(Array.isArray(tickets.body.data.tickets)).toBe(true);

    const adminAttempt = await request(app).get('/admin/users').set('Authorization', `Bearer ${token}`);
    expect(adminAttempt.status).toBe(403);
  });
});
