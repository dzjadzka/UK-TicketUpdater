const DEFAULT_CALLS_PER_MINUTE = Number(process.env.TICKET_RATE_LIMIT_PER_MINUTE) || 12;
const DEFAULT_WINDOW_MS = Number(process.env.TICKET_RATE_LIMIT_WINDOW_MS) || 60 * 1000;

class TokenBucketRateLimiter {
  constructor({ callsPerWindow = DEFAULT_CALLS_PER_MINUTE, windowMs = DEFAULT_WINDOW_MS, logger = console } = {}) {
    this.capacity = Math.max(1, callsPerWindow);
    this.windowMs = Math.max(1000, windowMs);
    this.tokens = this.capacity;
    this.logger = logger || console;
    this.queue = [];
    this.stats = {
      acquired: 0,
      delayed: 0,
      totalWaitMs: 0,
      lastRefillAt: Date.now()
    };

    this.refillTimer = setInterval(() => this.refill(), this.windowMs);
    if (typeof this.refillTimer.unref === 'function') {
      this.refillTimer.unref();
    }
  }

  stop() {
    if (this.refillTimer) {
      clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }

  refill() {
    this.tokens = this.capacity;
    this.stats.lastRefillAt = Date.now();

    while (this.tokens > 0 && this.queue.length > 0) {
      const next = this.queue.shift();
      this.tokens -= 1;
      this.stats.acquired += 1;
      this.stats.totalWaitMs += Date.now() - next.requestedAt;
      next.resolve();
    }
  }

  async acquire() {
    this.refillIfNeeded();

    if (this.tokens > 0) {
      this.tokens -= 1;
      this.stats.acquired += 1;
      return;
    }

    this.stats.delayed += 1;
    return new Promise((resolve) => {
      this.queue.push({ resolve, requestedAt: Date.now() });
    });
  }

  refillIfNeeded() {
    const now = Date.now();
    if (now - this.stats.lastRefillAt >= this.windowMs) {
      this.refill();
    }
  }

  getStats() {
    const avgWait = this.stats.delayed ? Math.round(this.stats.totalWaitMs / this.stats.delayed) : 0;
    return {
      capacity: this.capacity,
      window_ms: this.windowMs,
      available_tokens: this.tokens,
      queue_depth: this.queue.length,
      acquired: this.stats.acquired,
      delayed: this.stats.delayed,
      avg_wait_ms: avgWait
    };
  }
}

function createRateLimiterFromEnv(logger = console) {
  const callsPerMinute = Number(process.env.TICKET_RATE_LIMIT_PER_MINUTE) || DEFAULT_CALLS_PER_MINUTE;
  const windowMs = Number(process.env.TICKET_RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS;
  return new TokenBucketRateLimiter({ callsPerWindow: callsPerMinute, windowMs, logger });
}

module.exports = { TokenBucketRateLimiter, createRateLimiterFromEnv };
