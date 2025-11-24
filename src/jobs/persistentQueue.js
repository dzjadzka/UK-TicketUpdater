const DEFAULT_CONCURRENCY = 2;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_BACKOFF_FACTOR = 2;

function nowIso() {
  return new Date().toISOString();
}

class PersistentJobQueue {
  constructor({ db, concurrency = DEFAULT_CONCURRENCY, logger = console, pollIntervalMs = 250 } = {}) {
    this.db = db;
    this.concurrency = concurrency;
    this.logger = logger || console;
    this.handlers = new Map();
    this.queue = [];
    this.activeCount = 0;
    this.pollIntervalMs = pollIntervalMs;
    this.stopped = false;
    this.idleResolvers = [];
    this.metrics = {
      enqueued: 0,
      completed: 0,
      failed: 0,
      retries: 0,
      lastFailure: null
    };

    this.ensureSchema();
    this.hydrateMetrics();
    this.restorePendingJobs();
    this.startPoller();
  }

  isOpen() {
    return !!this.db?.db?.open;
  }

  ensureSchema() {
    if (!this.isOpen()) {
      return;
    }
    this.db.db.exec(`
      CREATE TABLE IF NOT EXISTS job_queue (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT,
        attempts INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT ${DEFAULT_MAX_RETRIES},
        retry_delay_ms INTEGER DEFAULT ${DEFAULT_RETRY_DELAY_MS},
        backoff_factor REAL DEFAULT ${DEFAULT_BACKOFF_FACTOR},
        status TEXT DEFAULT 'pending',
        available_at TEXT DEFAULT (datetime('now')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_job_queue_status_available ON job_queue(status, available_at);
    `);
  }

  hydrateMetrics() {
    if (!this.isOpen()) {
      return;
    }
    const { enqueued, completed, failed, retries } = this.db.db
      .prepare(
        `SELECT
           COUNT(*) AS enqueued,
           SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
           SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
           SUM(CASE WHEN attempts > 1 THEN attempts - 1 ELSE 0 END) AS retries
         FROM job_queue`
      )
      .get();

    this.metrics.enqueued = enqueued || 0;
    this.metrics.completed = completed || 0;
    this.metrics.failed = failed || 0;
    this.metrics.retries = retries || 0;
  }

  startPoller() {
    this.poller = setInterval(() => {
      if (this.stopped || !this.isOpen()) {
        return;
      }
      this.fetchDueJobs();
      this.process();
    }, this.pollIntervalMs);
    if (typeof this.poller.unref === 'function') {
      this.poller.unref();
    }
  }

  stop() {
    this.stopped = true;
    if (this.poller) {
      clearInterval(this.poller);
      this.poller = null;
    }
    this.queue = [];
  }

  restorePendingJobs() {
    if (!this.isOpen()) {
      return;
    }
    const rows = this.db.db
      .prepare(
        "SELECT * FROM job_queue WHERE status IN ('pending','running') ORDER BY datetime(available_at) ASC, created_at ASC"
      )
      .all();
    rows.forEach((row) => this.queue.push(this.deserializeJob(row)));
    if (rows.length) {
      this.logger.info(`Restored ${rows.length} pending jobs from persistence`);
    }
  }

  fetchDueJobs() {
    if (!this.isOpen()) {
      return;
    }
    const rows = this.db.db
      .prepare(
        "SELECT * FROM job_queue WHERE status = 'pending' AND datetime(available_at) <= datetime('now') ORDER BY datetime(available_at) ASC, created_at ASC LIMIT 50"
      )
      .all();
    rows.forEach((row) => {
      const alreadyQueued = this.queue.find((j) => j.id === row.id);
      if (!alreadyQueued) {
        this.queue.push(this.deserializeJob(row));
      }
    });
  }

  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }

  deserializeJob(row) {
    return {
      id: row.id,
      type: row.type,
      payload: row.payload ? JSON.parse(row.payload) : {},
      attempts: row.attempts || 0,
      maxRetries: row.max_retries || DEFAULT_MAX_RETRIES,
      retryDelayMs: row.retry_delay_ms || DEFAULT_RETRY_DELAY_MS,
      backoffFactor: row.backoff_factor || DEFAULT_BACKOFF_FACTOR
    };
  }

  enqueue(type, payload = {}, options = {}) {
    if (!this.isOpen()) {
      throw new Error('Job queue storage is closed');
    }
    if (!this.handlers.has(type)) {
      throw new Error(`No handler registered for job type ${type}`);
    }
    const crypto = require('crypto');
    const job = {
      id: crypto.randomUUID(),
      type,
      payload,
      attempts: 0,
      maxRetries: options.maxRetries || DEFAULT_MAX_RETRIES,
      retryDelayMs: options.retryDelayMs || DEFAULT_RETRY_DELAY_MS,
      backoffFactor: options.backoffFactor || DEFAULT_BACKOFF_FACTOR
    };

    this.db.db
      .prepare(
        `INSERT INTO job_queue (id, type, payload, attempts, max_retries, retry_delay_ms, backoff_factor, status, available_at)
         VALUES (@id, @type, @payload, @attempts, @maxRetries, @retryDelayMs, @backoffFactor, 'pending', datetime('now'))`
      )
      .run({ ...job, payload: JSON.stringify(payload || {}) });

    this.metrics.enqueued += 1;
    this.queue.push(job);
    this.process();
    return job.id;
  }

  async process() {
    if (this.stopped) {
      return;
    }

    while (this.activeCount < this.concurrency && this.queue.length) {
      const job = this.queue.shift();
      this.activeCount += 1;
      this.markJobRunning(job.id);
      this.runJob(job)
        .catch((error) => {
          this.logger.error(`Job ${job.type} failed unexpectedly`, error);
        })
        .finally(() => {
          this.activeCount -= 1;
          if (!this.queue.length && this.activeCount === 0) {
            this.idleResolvers.forEach((resolve) => resolve());
            this.idleResolvers = [];
          }
          this.process();
        });
    }
  }

  markJobRunning(id) {
    this.db.db
      .prepare("UPDATE job_queue SET status='running', updated_at=@updated_at WHERE id=@id")
      .run({ id, updated_at: nowIso() });
  }

  async runJob(job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      throw new Error(`Missing handler for job type ${job.type}`);
    }

    const startedAt = Date.now();
    try {
      await handler(job.payload, job);
      this.metrics.completed += 1;
      const duration = Date.now() - startedAt;
      this.db.db
        .prepare("UPDATE job_queue SET status='completed', updated_at=@updated_at WHERE id=@id")
        .run({ id: job.id, updated_at: nowIso(), duration_ms: duration });
    } catch (error) {
      job.attempts += 1;
      if (job.attempts <= job.maxRetries) {
        this.metrics.retries += 1;
        const delay = job.retryDelayMs * Math.pow(job.backoffFactor, job.attempts - 1);
        this.logger.warn(
          `Job ${job.type} failed (attempt ${job.attempts}/${job.maxRetries}). Retrying in ${delay}ms: ${error.message}`
        );
        const availableAt = new Date(Date.now() + delay).toISOString();
        this.db.db
          .prepare(
            `UPDATE job_queue
             SET attempts=@attempts, status='pending', available_at=@available_at, updated_at=@updated_at
             WHERE id=@id`
          )
          .run({
            id: job.id,
            attempts: job.attempts,
            available_at: availableAt,
            updated_at: nowIso()
          });
      } else {
        this.metrics.failed += 1;
        this.metrics.lastFailure = { id: job.id, type: job.type, error: error.message, at: nowIso() };
        this.logger.error(`Job ${job.type} exhausted retries: ${error.message}`);
        this.db.db
          .prepare("UPDATE job_queue SET status='failed', updated_at=@updated_at, attempts=@attempts WHERE id=@id")
          .run({ id: job.id, updated_at: nowIso(), attempts: job.attempts });
      }
    }
  }

  async waitForIdle() {
    if (!this.queue.length && this.activeCount === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  getMetrics() {
    const pending = this.db.db.prepare("SELECT COUNT(*) as count FROM job_queue WHERE status='pending'").get().count;
    const running = this.db.db.prepare("SELECT COUNT(*) as count FROM job_queue WHERE status='running'").get().count;
    const failed = this.db.db.prepare("SELECT COUNT(*) as count FROM job_queue WHERE status='failed'").get().count;

    return {
      ...this.metrics,
      pending,
      running,
      failedPersisted: failed,
      backend: 'persistent'
    };
  }
}

module.exports = { PersistentJobQueue };
