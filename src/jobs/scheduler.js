class JobScheduler {
  constructor(queue, { intervalMs, logger = console } = {}) {
    this.queue = queue;
    this.intervalMs = intervalMs || 6 * 60 * 60 * 1000; // default 6 hours
    this.logger = logger;
    this.timer = null;
  }

  start() {
    if (this.timer) {
      return;
    }
    this.logger.info(`Starting base ticket scheduler (interval ${this.intervalMs}ms)`);
    this.timer = setInterval(() => {
      this.queue.enqueue('checkBaseTicket');
    }, this.intervalMs);
    // Kick off immediately
    this.queue.enqueue('checkBaseTicket');
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

module.exports = { JobScheduler };
