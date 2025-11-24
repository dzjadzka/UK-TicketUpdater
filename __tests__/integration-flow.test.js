const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/server');
const { hashPassword } = require('../src/auth');

const TEST_ENCRYPTION_KEY = 'test-secret-key-1234567890123456';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || TEST_ENCRYPTION_KEY;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function createStubHandlers(outputRoot) {
  return ({ db, queue, defaults }) => {
    const resolvedOutput = outputRoot || defaults.outputRoot || path.join(__dirname, 'downloads');

    return {
      checkBaseTicket: async () => {
        queue.enqueue('downloadTicketsForAllUsers');
      },
      downloadTicketsForAllUsers: async () => {
        db.listActiveUsers()
          .filter((user) => user.auto_download_enabled)
          .forEach((user) => {
            queue.enqueue('downloadTicketForUser', { userId: user.id });
          });
      },
      downloadTicketForUser: async ({ userId }) => {
        const user = db.getActiveUserById(userId);
        if (!user) {
          throw new Error('User not found');
        }

        const userDir = path.join(resolvedOutput, user.id);
        fs.mkdirSync(userDir, { recursive: true });
        const filePath = path.join(userDir, 'ticket.html');
        fs.writeFileSync(filePath, '<html>ticket</html>');

        db.recordTicket({
          userId: user.id,
          ticketVersion: 'v1',
          contentHash: `hash-${user.id}`,
          filePath,
          status: 'success'
        });
        db.recordRun({ userId: user.id, status: 'success', message: 'Ticket downloaded', filePath });
      }
    };
  };
}

describe('End-to-end invite/login/download flow', () => {
  let app;
  let db;
  let jobQueue;
  let dbPath;
  let outputRoot;

  beforeEach(async () => {
    dbPath = path.join(__dirname, `integration-${Date.now()}.db`);
    outputRoot = path.join(__dirname, `downloads-${Date.now()}`);
    const result = createApp({
      dbPath,
      outputRoot,
      jobOverrides: { handlerFactory: createStubHandlers(outputRoot), backend: 'persistent' }
    });
    app = result.app;
    db = result.db;
    jobQueue = result.jobQueue;

    const adminId = 'admin-001';
    const passwordHash = await hashPassword('AdminPass123!');
    db.db
      .prepare('INSERT INTO users (id, login, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?)')
      .run(adminId, 'admin@example.com', 'admin@example.com', passwordHash, 'admin', 1);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (outputRoot && fs.existsSync(outputRoot)) {
      fs.rmSync(outputRoot, { recursive: true, force: true });
    }
  });

  it('registers via invite, sets credentials, and records a download', async () => {
    const adminLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'AdminPass123!' });
    const adminToken = adminLogin.body.token;

    const inviteResponse = await request(app)
      .post('/admin/invites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ expiresInHours: 2 });

    const inviteToken = inviteResponse.body.data?.token;
    expect(inviteToken).toBeDefined();

    const registerResponse = await request(app)
      .post('/auth/register')
      .send({ inviteToken, email: 'user1@example.com', password: 'UserPass123!' });

    const userToken = registerResponse.body.token;
    const userId = registerResponse.body.user.id;

    await request(app)
      .put('/me/credentials')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ukNumber: '12345', ukPassword: 'secret', autoDownloadEnabled: true });

    const profileResponse = await request(app)
      .post('/device-profiles')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Test mobile',
        userAgent: 'Mozilla/5.0',
        viewportWidth: 400,
        viewportHeight: 800,
        locale: 'en-US',
        timezone: 'UTC'
      });

    expect(profileResponse.status).toBe(201);

    jobQueue.enqueue('downloadTicketForUser', { userId });
    await jobQueue.waitForIdle();

    const tickets = await request(app).get('/me/tickets').set('Authorization', `Bearer ${userToken}`);

    expect(tickets.status).toBe(200);
    expect(tickets.body.data.tickets.length).toBeGreaterThan(0);
    expect(tickets.body.data.tickets[0].status).toBe('success');
  });
});
