const path = require('path');
const fs = require('fs');
const { createDatabase } = require('../../src/db');
const { PersistentJobQueue } = require('../../src/jobs/persistentQueue');

function cleanup(dbPath) {
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

describe('PersistentJobQueue', () => {
  const dbPath = path.join(__dirname, 'queue-test.db');
  let db;
  let queue;

  beforeEach(() => {
    cleanup(dbPath);
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    if (queue) {
      queue.stop();
    }
    db.close();
    cleanup(dbPath);
  });

  test('persists and restores pending jobs', async () => {
    queue = new PersistentJobQueue({ db, pollIntervalMs: 10, logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } });
    const handler = jest.fn();
    queue.registerHandler('demo', handler);
    const id = queue.enqueue('demo', { foo: 'bar' });
    await queue.waitForIdle();
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' }, expect.objectContaining({ id }));

    // Recreate queue and ensure completed job stays completed
    const queue2 = new PersistentJobQueue({ db, pollIntervalMs: 10, logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } });
    queue2.registerHandler('demo', handler);
    expect(queue2.getMetrics().completed).toBe(1);
    queue2.stop();
  });

  test('retries with backoff and tracks metrics', async () => {
    queue = new PersistentJobQueue({ db, pollIntervalMs: 10, logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } });
    let attempt = 0;
    queue.registerHandler('flaky', () => {
      attempt += 1;
      if (attempt < 2) {
        throw new Error('fail once');
      }
    });

    queue.enqueue('flaky', {}, { retryDelayMs: 5 });
    await new Promise((resolve) => setTimeout(resolve, 30));
    await queue.waitForIdle();

    const metrics = queue.getMetrics();
    expect(metrics.completed).toBe(1);
    expect(metrics.retries).toBe(1);
    expect(metrics.failedPersisted).toBe(0);
  });
});
