const request = require('supertest');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createApp } = require('../src/server');
const { hashPassword } = require('../src/auth');

function removeDb(dbPath) {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

describe('Admin observability endpoints', () => {
  let app;
  let db;
  let dbPath;
  let adminToken;
  let userId;

  beforeEach(async () => {
    dbPath = path.join(__dirname, `observability-${Date.now()}.db`);
    const result = createApp({ dbPath });
    app = result.app;
    db = result.db;

    const passwordHash = await hashPassword('Password123!');
    const adminId = crypto.randomUUID();
    db.createUser({
      id: adminId,
      email: 'admin@example.com',
      passwordHash,
      role: 'admin',
      inviteToken: null,
      invitedBy: null,
      locale: 'en',
      isActive: 1,
      autoDownloadEnabled: true
    });

    userId = crypto.randomUUID();
    db.createUser({
      id: userId,
      email: 'user@example.com',
      passwordHash,
      role: 'user',
      inviteToken: null,
      invitedBy: adminId,
      locale: 'en',
      isActive: 1,
      autoDownloadEnabled: true
    });

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' });
    adminToken = loginResponse.body.token;

    db.recordRun({
      userId,
      status: 'error',
      message: 'Network timeout',
      errorMessage: 'timeout',
      deviceProfile: 'desktop',
      filePath: null,
      timestamp: new Date().toISOString()
    });

    db.recordRun({
      userId,
      status: 'success',
      message: 'Downloaded',
      deviceProfile: 'desktop',
      filePath: '/tmp/ticket.html',
      timestamp: new Date().toISOString()
    });

    db.setBaseTicketState({
      baseTicketHash: 'hash-123',
      effectiveFrom: '2024-01-01T00:00:00Z',
      lastCheckedAt: '2024-01-02T00:00:00Z'
    });
  });

  afterEach(() => {
    db.close();
    removeDb(dbPath);
  });

  it('returns recent errors per user', async () => {
    const response = await request(app)
      .get('/admin/observability/errors')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors.length).toBeGreaterThan(0);
    expect(response.body.errors[0]).toHaveProperty('user_id');
    expect(response.body.errors[0].status).not.toBe('success');
  });

  it('summarizes jobs over the requested window', async () => {
    const response = await request(app)
      .get('/admin/observability/job-summary?hours=48')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.success).toBeGreaterThanOrEqual(1);
    expect(response.body.summary.error).toBeGreaterThanOrEqual(1);
  });

  it('exposes the last base ticket state', async () => {
    const response = await request(app)
      .get('/admin/observability/base-ticket')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.state.base_ticket_hash).toBe('hash-123');
    expect(response.body.state.effective_from).toContain('2024-01-01');
    expect(response.body.state.last_checked_at).toContain('2024-01-02');
  });
});
