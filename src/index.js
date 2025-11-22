const path = require('path');
const { downloadTickets } = require('./downloader');
const { createDatabase } = require('./db');
const { getEncryptionKey } = require('./auth');
const { parseArgs } = require('./cli');
const { createRateLimiterFromEnv } = require('./rateLimiter');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputRoot = path.resolve(args.output || './downloads');
  const defaultDeviceProfile = args.device || 'desktop_chrome';
  const dbPath = path.resolve(args.db || './data/app.db');

  if (args.concurrency) {
    process.env.JOB_CONCURRENCY = String(args.concurrency);
  }
  if (args.queueBackend) {
    process.env.JOB_QUEUE_BACKEND = args.queueBackend;
  }

  const db = createDatabase(dbPath);
  const encryptionKey = getEncryptionKey();

  try {
    const rateLimiter = createRateLimiterFromEnv();
    const users = db.listActiveUsers();

    if (!users.length) {
      throw new Error('No users found. Create an admin and register users via invites, then set their credentials.');
    }

    const results = await downloadTickets(users, {
      defaultDeviceProfile,
      outputRoot,
      db,
      encryptionKey,
      rateLimiter
    });

    results.forEach((result, index) => {
      const userId = users[index].id;
      console.log(
        `[${userId}] status=${result.status} device=${result.deviceProfile} file=${result.filePath || 'n/a'} message=${result.message}`
      );
    });
  } finally {
    db.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to download tickets:', error);
    process.exit(1);
  });
}

module.exports = { parseArgs, main };
