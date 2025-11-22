const fs = require('fs');
const path = require('path');
const { createDatabase } = require('../../src/db');
const { PersistentJobQueue } = require('../../src/jobs/persistentQueue');

const TEST_ENCRYPTION_KEY = 'test-secret-key-1234567890123456';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || TEST_ENCRYPTION_KEY;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

describe('Persistent job queue resume', () => {
  let dbPath;
  let db;

  beforeEach(() => {
    dbPath = path.join(__dirname, `resume-${Date.now()}.db`);
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('restores pending jobs after a restart', async () => {
    const observed = [];
    const queue1 = new PersistentJobQueue({ db, concurrency: 1, logger: { info: () => {}, error: () => {}, warn: () => {} } });
    queue1.registerHandler('demo', async ({ value }) => {
      observed.push(`run-${value}`);
    });
    queue1.stopped = true; // pause processing
    queue1.enqueue('demo', { value: 1 });
    queue1.stop();

    const queue2 = new PersistentJobQueue({
      db,
      concurrency: 1,
      pollIntervalMs: 1000,
      logger: { info: () => {}, error: () => {}, warn: () => {} }
    });
    queue2.registerHandler('demo', async ({ value }) => {
      observed.push(`restored-${value}`);
    });
    queue2.process();
    await queue2.waitForIdle();
    queue2.stop();

    expect(observed).toContain('restored-1');
  });
});
