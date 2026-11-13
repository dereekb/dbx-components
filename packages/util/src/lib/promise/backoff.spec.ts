import { exponentialBackoffDelay } from './backoff';

describe('exponentialBackoffDelay()', () => {
  it('grows by the factor from the initial delay', () => {
    expect(exponentialBackoffDelay({ attempt: 1, jitter: 'none' })).toBe(1000);
    expect(exponentialBackoffDelay({ attempt: 2, jitter: 'none' })).toBe(2000);
    expect(exponentialBackoffDelay({ attempt: 4, jitter: 'none' })).toBe(8000);
    expect(exponentialBackoffDelay({ attempt: 3, jitter: 'none', initialDelay: 100, factor: 3 })).toBe(900);
  });

  it('caps at the max delay, even for a huge attempt', () => {
    expect(exponentialBackoffDelay({ attempt: 10, jitter: 'none' })).toBe(60000);
    expect(exponentialBackoffDelay({ attempt: 5000, jitter: 'none', maxDelay: 5000 })).toBe(5000);
  });

  it('treats attempt 0 or less as the first retry', () => {
    expect(exponentialBackoffDelay({ attempt: 0, jitter: 'none' })).toBe(1000);
  });

  it('applies equal jitter by default: uniform in [d/2, d]', () => {
    expect(exponentialBackoffDelay({ attempt: 3, random: () => 0 })).toBe(2000);
    expect(exponentialBackoffDelay({ attempt: 3, random: () => 0.5 })).toBe(3000);
    expect(exponentialBackoffDelay({ attempt: 3, random: () => 0.999999 })).toBe(4000);

    for (let i = 0; i < 50; i += 1) {
      const delay = exponentialBackoffDelay({ attempt: 2 });
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(2000);
    }
  });
});
