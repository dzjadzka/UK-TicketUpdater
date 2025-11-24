#!/usr/bin/env node
// Docker entrypoint script that initializes the database and creates a default admin user
// before starting the server.

const crypto = require('crypto');
const { spawn } = require('child_process');
const { createDatabase } = require('../src/db');

async function initializeAdmin(db) {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';

  // Check if any admin exists
  const existingAdmins = db.getUsers().filter((u) => u.role === 'admin' && !u.deleted_at);

  if (existingAdmins.length === 0) {
    console.log(`[entrypoint] No admin found. Creating default admin: ${adminEmail}`);

    // Import auth functions dynamically to avoid issues with encryption key
    const { hashPassword } = require('../src/auth');

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
    console.log(`[entrypoint] Default admin created with login: ${adminEmail}`);
  } else {
    console.log(`[entrypoint] Admin already exists: ${existingAdmins[0].email}`);
  }
}

async function main() {
  const dbPath = process.env.DB_PATH || './data/app.db';

  console.log(`[entrypoint] Initializing database at ${dbPath}`);
  const db = createDatabase(dbPath);

  try {
    await initializeAdmin(db);
  } catch (err) {
    console.error('[entrypoint] Error creating admin:', err.message);
  } finally {
    db.close();
  }

  // Start the server
  console.log('[entrypoint] Starting server...');
  const server = spawn('node', ['src/server.js'], {
    stdio: 'inherit',
    env: process.env
  });

  server.on('error', (err) => {
    console.error('[entrypoint] Failed to start server:', err);
    process.exit(1);
  });

  server.on('close', (code) => {
    process.exit(code);
  });

  // Handle signals for graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[entrypoint] Received SIGTERM, shutting down...');
    server.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    console.log('[entrypoint] Received SIGINT, shutting down...');
    server.kill('SIGINT');
  });
}

main().catch((err) => {
  console.error('[entrypoint] Fatal error:', err);
  process.exit(1);
});
