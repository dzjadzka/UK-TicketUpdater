const DEFAULT_CONCURRENCY = 2;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const DEFAULT_BACKOFF_FACTOR = 2;

class JobQueue {
  constructor({ concurrency = DEFAULT_CONCURRENCY, logger = console } = {}) {
    this.concurrency = concurrency;
    this.logger = logger || console;
    this.handlers = new Map();
    this.queue = [];
    this.activeCount = 0;
    this.stopped = false;
    this.deadLetters = [];
    this.idleResolvers = [];
  }

  registerHandler(type, handler) {
    this.handlers.set(type, handler);
  }

  enqueue(type, payload = {}, options = {}) {
    if (!this.handlers.has(type)) {
      throw new Error(`No handler registered for job type ${type}`);
    }
    const job = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      attempts: 0,
      maxRetries: options.maxRetries || DEFAULT_MAX_RETRIES,
      retryDelayMs: options.retryDelayMs || DEFAULT_RETRY_DELAY_MS,
      backoffFactor: options.backoffFactor || DEFAULT_BACKOFF_FACTOR
    };
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

  async runJob(job) {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      throw new Error(`Missing handler for job type ${job.type}`);
    }

    try {
      await handler(job.payload, job);
    } catch (error) {
      job.attempts += 1;
      if (job.attempts <= job.maxRetries) {
        const delay = job.retryDelayMs * Math.pow(job.backoffFactor, job.attempts - 1);
        this.logger.warn(
          `Job ${job.type} failed (attempt ${job.attempts}/${job.maxRetries}). Retrying in ${delay}ms: ${error.message}`
        );
        setTimeout(() => {
          this.queue.push(job);
          this.process();
        }, delay);
      } else {
        this.logger.error(`Job ${job.type} exhausted retries: ${error.message}`);
        this.deadLetters.push({ job, error: error.message, stack: error.stack });
      }
    }
  }

  async waitForIdle() {
    if (!this.queue.length && this.activeCount === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  stop() {
    this.stopped = true;
    this.queue = [];
  }
}

module.exports = { JobQueue };
