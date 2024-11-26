import { MS_IN_SECOND } from '../date';
import { resetPeriodPromiseRateLimiter, exponentialPromiseRateLimiter } from './promise.limit';
import { waitForMs } from './wait';

describe('burstPromiseRateLimiter()', () => {
  it('should rate limit in an exponential fashion', async () => {
    const limiter = exponentialPromiseRateLimiter();
    const a = limiter.waitForRateLimit();

    const waitTimeA = limiter.getNextWaitTime();
    expect(waitTimeA).toBeGreaterThan(0);
    expect(waitTimeA).toBeLessThanOrEqual(MS_IN_SECOND);

    const b = limiter.waitForRateLimit();
    const waitTimeB = limiter.getNextWaitTime();
    expect(waitTimeB).toBeGreaterThan(2 / MS_IN_SECOND);
    expect(waitTimeB).toBeLessThanOrEqual(2 * MS_IN_SECOND);

    const c = limiter.waitForRateLimit();
    const waitTimeC = limiter.getNextWaitTime();
    expect(waitTimeC).toBeGreaterThan(3 * MS_IN_SECOND);
    expect(waitTimeC).toBeLessThanOrEqual(4 * MS_IN_SECOND);

    const d = limiter.waitForRateLimit();
    const waitTimeD = limiter.getNextWaitTime();
    expect(waitTimeD).toBeGreaterThan(7 * MS_IN_SECOND);
    expect(waitTimeD).toBeLessThanOrEqual(8 * MS_IN_SECOND);

    await Promise.all([a, b, c, d]);
  });

  it('should rate limit with the custom exponent rate', async () => {
    // The ideal rate only effects the cooldown period, but not the exponential growth if many fire off at the same time.

    const exponentRate = 1.2;
    const limiter = exponentialPromiseRateLimiter({ exponentRate });
    expect(limiter.getConfig().exponentRate).toBe(exponentRate);

    const a = limiter.waitForRateLimit();

    const waitTimeA = limiter.getNextWaitTime();
    expect(waitTimeA).toBeGreaterThan(0);
    expect(waitTimeA).toBeLessThanOrEqual(MS_IN_SECOND);

    const b = limiter.waitForRateLimit();
    const waitTimeB = limiter.getNextWaitTime();
    expect(waitTimeB).toBeGreaterThan(2 / MS_IN_SECOND);
    expect(waitTimeB).toBeLessThanOrEqual(2 * MS_IN_SECOND);

    const c = limiter.waitForRateLimit();
    const waitTimeC = limiter.getNextWaitTime();
    expect(waitTimeC).toBeGreaterThan(MS_IN_SECOND);
    expect(waitTimeC).toBeLessThanOrEqual(2 * MS_IN_SECOND);

    await Promise.all([a, b, c]);
  });

  it('should cooldown between executions.', async () => {
    const limiter = exponentialPromiseRateLimiter({ cooldownRate: 1 });
    const a = limiter.waitForRateLimit();

    const waitTimeA = limiter.getNextWaitTime();
    expect(waitTimeA).toBeLessThanOrEqual(MS_IN_SECOND);

    const b = limiter.waitForRateLimit();
    const waitTimeB = limiter.getNextWaitTime();
    expect(waitTimeB).toBeGreaterThan(2 / MS_IN_SECOND);
    expect(waitTimeB).toBeLessThanOrEqual(2 * MS_IN_SECOND);

    await waitForMs(2 * MS_IN_SECOND); // wait for 2 seconds

    const waitTimeC = limiter.getNextWaitTime();
    expect(waitTimeC).toBeLessThanOrEqual(MS_IN_SECOND);

    await Promise.all([a, b]);
  });

  it('should cooldown between executions faster with a higher cooldown rate', async () => {
    const limiter = exponentialPromiseRateLimiter({ cooldownRate: 2 });
    limiter.waitForRateLimit();

    const waitTimeA = limiter.getNextWaitTime();
    expect(waitTimeA).toBeGreaterThan(0);
    expect(waitTimeA).toBeLessThanOrEqual(MS_IN_SECOND);

    limiter.waitForRateLimit();
    const waitTimeB = limiter.getNextWaitTime();
    expect(waitTimeB).toBeGreaterThan(2 / MS_IN_SECOND);
    expect(waitTimeB).toBeLessThanOrEqual(2 * MS_IN_SECOND);

    await waitForMs(MS_IN_SECOND); // wait for 1 second

    const waitTimeC = limiter.getNextWaitTime();
    expect(waitTimeC).toBeLessThanOrEqual(MS_IN_SECOND);
  });

  describe('reset()', () => {
    it('should reset the rate limiter', async () => {
      const limiter = exponentialPromiseRateLimiter();

      const waitTimeS = limiter.getNextWaitTime();
      expect(waitTimeS).toBe(0);

      const a = limiter.waitForRateLimit();
      limiter.reset(); // reset

      const waitTimeA = limiter.getNextWaitTime();
      expect(waitTimeA).toBe(0);

      const b = limiter.waitForRateLimit();
      limiter.reset(); // reset

      const waitTimeB = limiter.getNextWaitTime();
      expect(waitTimeB).toBe(0);

      await Promise.all([a, b]);
    });
  });

  describe('maxWaitTime', () => {
    it('should limit the wait time', async () => {
      const limiter = exponentialPromiseRateLimiter({ maxWaitTime: 1000 });
      const a = limiter.waitForRateLimit();
      const b = limiter.waitForRateLimit();
      const c = limiter.waitForRateLimit();

      const waitTimeA = limiter.getNextWaitTime();
      expect(waitTimeA).toBeLessThanOrEqual(1000);

      await Promise.all([a, b, c]);
    });
  });
});

describe('resetPeriodPromiseRateLimiter()', () => {
  it('should rate limit to the reset period when the limit is reached.', async () => {
    const resetPeriod = 4000;
    const limiter = resetPeriodPromiseRateLimiter({
      limit: 2,
      resetPeriod,
      maxWaitTime: 2000 // max wait time is ignored once the remaining limit is reduced
    });
    expect(limiter.getRemainingLimit()).toBe(2);

    const a = limiter.waitForRateLimit();
    expect(limiter.getRemainingLimit()).toBe(1);

    const waitTimeA = limiter.getNextWaitTime();
    expect(waitTimeA).toBeLessThanOrEqual(MS_IN_SECOND);

    const b = limiter.waitForRateLimit();
    expect(limiter.getRemainingLimit()).toBe(0);

    const waitTimeB = limiter.getNextWaitTime();
    expect(waitTimeB).toBeGreaterThan(3.5 * MS_IN_SECOND);
    expect(waitTimeB).toBeLessThanOrEqual(4 * MS_IN_SECOND);

    await Promise.all([a, b]);
  });

  describe('reset()', () => {
    it('resetting the rate limiter resets the remaining limit', async () => {
      const resetPeriod = 4000;
      const limiter = resetPeriodPromiseRateLimiter({
        limit: 2,
        resetPeriod,
        maxWaitTime: 2000 // max wait time is ignored once the remaining limit is reduced
      });

      expect(limiter.getRemainingLimit()).toBe(2);

      const a = limiter.waitForRateLimit();

      expect(limiter.getRemainingLimit()).toBe(1);

      const b = limiter.waitForRateLimit();

      expect(limiter.getRemainingLimit()).toBe(0);

      limiter.reset(); // reset

      expect(limiter.getRemainingLimit()).toBe(2);

      await Promise.all([a, b]);
    });

    it('resetting the rate limiter does not affect the internal exponential limiter', async () => {
      const resetPeriod = 4000;
      const limiter = resetPeriodPromiseRateLimiter({
        limit: 2,
        resetPeriod,
        maxWaitTime: 2000 // max wait time is ignored once the remaining limit is reduced
      });

      const a = limiter.waitForRateLimit();
      limiter.reset(); // reset

      const waitTimeA = limiter.getNextWaitTime();
      expect(waitTimeA).toBeLessThanOrEqual(MS_IN_SECOND);

      const b = limiter.waitForRateLimit();
      limiter.reset(); // reset

      const waitTimeB = limiter.getNextWaitTime();
      expect(waitTimeB).toBeLessThanOrEqual(1.5 * MS_IN_SECOND);

      await Promise.all([a, b]);
    });
  });

  describe('maxWaitTime', () => {
    it('should limit the exponential wait time', async () => {
      const limiter = resetPeriodPromiseRateLimiter({ resetPeriod: 4000, limit: 10, maxWaitTime: 1000 });
      const a = limiter.waitForRateLimit();
      const b = limiter.waitForRateLimit();
      const c = limiter.waitForRateLimit();

      const waitTimeA = limiter.getNextWaitTime();
      expect(waitTimeA).toBeLessThanOrEqual(1000);

      await Promise.all([a, b, c]);
    });
  });
});
