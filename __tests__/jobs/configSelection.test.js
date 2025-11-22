const fs = require('fs');
const path = require('path');
const { createDatabase } = require('../../src/db');
const { createJobSystem } = require('../../src/jobs');

describe('Job system backend selection', () => {
  let db;
  let dbPath;

  beforeEach(() => {
    delete process.env.JOB_QUEUE_BACKEND;
    dbPath = path.join(__dirname, `queue-select-${Date.now()}.db`);
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (dbPath && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  it('prefers the persistent backend when a database is available', () => {
    const { backend, queue } = createJobSystem({ db, logger: console, defaults: {} });
    expect(backend).toBe('persistent');
    expect(queue.getMetrics().backend).toBe('persistent');
    queue.stop();
  });
});
