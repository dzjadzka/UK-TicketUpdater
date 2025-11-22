process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-jwt-secret';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-secret-key-1234567890123456';

const fs = require('fs');
const path = require('path');
const { createApp } = require('../src/server');
const { hashPassword, getInviteExpiration } = require('../src/auth');

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/e2e-test.db');
const OUTPUT_ROOT = process.env.OUTPUT_ROOT || path.join(__dirname, '../downloads/e2e');
const INVITE_TOKEN = process.env.E2E_INVITE_TOKEN || 'e2e-invite-token';

async function bootstrap() {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }

  const { app, db } = createApp({ dbPath: DB_PATH, outputRoot: OUTPUT_ROOT });

  const adminPasswordHash = await hashPassword('AdminPass123!');
  const userPasswordHash = await hashPassword('UserPass123!');

  const adminId = 'admin-e2e';
  const seedUserId = 'seed-user';

  db.createUser({
    id: adminId,
    login: 'admin@example.com',
    email: 'admin@example.com',
    passwordHash: adminPasswordHash,
    role: 'admin',
    autoDownloadEnabled: true
  });

  db.createUser({
    id: seedUserId,
    login: 'seed@example.com',
    email: 'seed@example.com',
    passwordHash: userPasswordHash,
    role: 'user',
    autoDownloadEnabled: false
  });

  db.createInviteToken({ token: INVITE_TOKEN, createdBy: adminId, expiresAt: getInviteExpiration() });

  const server = app.listen(PORT, () => {
    console.log(`E2E API server listening on http://localhost:${PORT}`);
    console.log(`Invite token for tests: ${INVITE_TOKEN}`);
  });

  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap();
