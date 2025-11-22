process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-secret-key-1234567890123456';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { hashPassword } = require('../src/auth');

jest.mock('../src/downloader', () => ({
  downloadTickets: jest.fn().mockResolvedValue([])
}));

const { downloadTickets } = require('../src/downloader');
const { createApp } = require('../src/server');

const createTempDbPath = () => path.join(os.tmpdir(), `admin-access-${Date.now()}.db`);

describe('API auth, tickets, and jobs', () => {
  let app;
  let db;
  let dbPath;
  const adminEmail = 'admin@example.com';
  const adminPassword = 'AdminPass123!';
  const userEmail = 'user@example.com';
  const userPassword = 'UserPass123!';

  const loginAndGetToken = async (email, password) => {
    const response = await request(app).post('/auth/login').send({ email, password });
    expect(response.status).toBe(200);
    return response.body.token;
  };

  beforeEach(async () => {
    dbPath = createTempDbPath();
    const result = createApp({ dbPath });
    app = result.app;
    db = result.db;

    const adminPasswordHash = await hashPassword(adminPassword);
    const userPasswordHash = await hashPassword(userPassword);

    db.createUser({
      id: 'admin-1',
      login: adminEmail,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'admin',
      autoDownloadEnabled: true
    });

    db.createUser({
      id: 'user-1',
      login: userEmail,
      email: userEmail,
      passwordHash: userPasswordHash,
      role: 'user',
      autoDownloadEnabled: false
    });
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    jest.clearAllMocks();
  });

  it('enforces admin-only access to privileged routes', async () => {
    const userToken = await loginAndGetToken(userEmail, userPassword);
    const adminToken = await loginAndGetToken(adminEmail, adminPassword);

    const forbidden = await request(app).get('/admin/users').set('Authorization', `Bearer ${userToken}`);
    expect(forbidden.status).toBe(403);

    const allowed = await request(app).get('/admin/users').set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body.data.users)).toBe(true);
    expect(allowed.body.data.users.some((entry) => entry.user.email === userEmail)).toBe(true);
  });

  it('returns the latest ticket versions for a user and keeps history sorted', async () => {
    const userToken = await loginAndGetToken(userEmail, userPassword);
    const adminToken = await loginAndGetToken(adminEmail, adminPassword);

    db.recordTicket({
      userId: 'user-1',
      ticketVersion: 'Winter 24',
      filePath: '/tmp/winter.pdf',
      status: 'success',
      downloadedAt: '2024-12-01T00:00:00Z'
    });

    db.recordTicket({
      userId: 'user-1',
      ticketVersion: 'Winter 24',
      status: 'error',
      errorMessage: 'stale ticket',
      downloadedAt: '2024-12-02T10:00:00Z'
    });

    db.recordTicket({
      userId: 'user-1',
      ticketVersion: 'Spring 25',
      filePath: '/tmp/spring.pdf',
      status: 'success',
      downloadedAt: '2025-03-01T12:00:00Z'
    });

    db.recordRun({
      userId: 'user-1',
      status: 'success',
      ticketVersion: 'Spring 25',
      deviceProfile: 'desktop_chrome',
      message: 'downloaded',
      timestamp: '2025-03-01T12:00:00Z'
    });

    const userTickets = await request(app).get('/me/tickets').set('Authorization', `Bearer ${userToken}`);
    expect(userTickets.status).toBe(200);
    expect(userTickets.body.data.tickets).toHaveLength(2);
    expect(userTickets.body.data.tickets[0]).toMatchObject({ version: 'Spring 25', status: 'success' });
    expect(userTickets.body.data.tickets[1]).toMatchObject({ version: 'Winter 24', status: 'error' });

    const adminTickets = await request(app)
      .get('/tickets/user-1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminTickets.status).toBe(200);
    expect(adminTickets.body.data.tickets.some((ticket) => ticket.ticket_version === 'Winter 24')).toBe(true);

    const historyResponse = await request(app).get('/history').set('Authorization', `Bearer ${adminToken}`);
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.history[0].ticket_version).toBe('Spring 25');
  });

  it('allows admins to trigger job endpoints without hitting external services', async () => {
    const adminToken = await loginAndGetToken(adminEmail, adminPassword);
    downloadTickets.mockResolvedValue([{ userId: 'user-1', status: 'queued' }]);

    const downloadAll = await request(app)
      .post('/admin/jobs/download-all')
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(downloadAll.status).toBe(200);
    expect(downloadTickets).toHaveBeenCalledTimes(1);
    expect(downloadAll.body.data.status).toBe('queued');

    const checkBase = await request(app)
      .post('/admin/jobs/check-base-ticket')
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(checkBase.status).toBe(200);
    expect(checkBase.body.data.state.last_checked_at).toBeTruthy();
  });
});
