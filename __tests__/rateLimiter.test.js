const { TokenBucketRateLimiter } = require('../src/rateLimiter');

describe('TokenBucketRateLimiter', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('consumes tokens and delays when exhausted', async () => {
    jest.useFakeTimers();
    const limiter = new TokenBucketRateLimiter({ callsPerWindow: 1, windowMs: 1000 });

    await limiter.acquire();

    const delayedPromise = limiter.acquire();
    jest.advanceTimersByTime(1000);

    await expect(delayedPromise).resolves.toBeUndefined();
    const stats = limiter.getStats();
    expect(stats.acquired).toBeGreaterThanOrEqual(2);
    limiter.stop();
  });
});
