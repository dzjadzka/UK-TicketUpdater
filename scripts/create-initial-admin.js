// filepath: /Users/zozo/WebstormProjects/UK-TicketUpdater/scripts/create-initial-admin.js
// Creates the initial admin user if none exists and generates a single invite token.
// Usage:
//   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='StrongPass1' npm run init:admin
// Optional env:
//   DB_PATH (default ./data/app.db)
//   INVITE_EXPIRY_HOURS (override default expiration)

const crypto = require('crypto');
const { createDatabase } = require('../src/db');
const { hashPassword, generateInviteToken, getInviteExpiration } = require('../src/auth');

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123';
  const dbPath = process.env.DB_PATH || './data/app.db';
  const inviteExpiryHours = Number(process.env.INVITE_EXPIRY_HOURS) || undefined;

  const db = createDatabase(dbPath);

  // Check if any admin exists
  const existingAdmins = db.getUsers().filter((u) => u.role === 'admin' && !u.deleted_at);
  let adminUser;

  if (existingAdmins.length === 0) {
    console.log(`No admin found. Creating initial admin: ${adminEmail}`);
    const adminId = crypto.randomUUID();
    const passwordHash = await hashPassword(adminPassword);
    db.createUser({
      id: adminId,
      login: adminEmail,
      email: adminEmail,
      passwordHash,
      role: 'admin',
      inviteToken: null,
      invitedBy: null,
      locale: 'en',
      isActive: 1,
      autoDownloadEnabled: 0
    });
    adminUser = db.getUserById(adminId);
  } else {
    adminUser = existingAdmins[0];
    console.log(`Admin already exists: ${adminUser.email} (id=${adminUser.id})`);
  }

  // Generate invite token
  const token = generateInviteToken();
  const expiresAt = getInviteExpiration(inviteExpiryHours);
  db.createInviteToken({ token, createdBy: adminUser.id, expiresAt });

  console.log('\nInvite token created:');
  console.log(`  Token: ${token}`);
  console.log(`  Created by: ${adminUser.id}`);
  console.log(`  Expires at: ${expiresAt}`);
  console.log('\nUse this token for user registration via POST /auth/register with body:');
  console.log('{ "inviteToken": "TOKEN_HERE", "email": "user@example.com", "password": "StrongPass1" }');

  db.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed to initialize admin:', err);
    process.exit(1);
  });
}

