import { type Mock } from 'vitest';
import { addMilliseconds } from '../date/date';
import { type Expires } from '../date/expires';
import { expiringCachedGetter } from './getter.cache.expiring';

describe('expiringCachedGetter()', () => {
  // A controllable clock so expiry is deterministic without wall-clock sleeps.
  let currentTime: Date;
  const now = () => currentTime;

  beforeEach(() => {
    currentTime = new Date('2020-01-01T00:00:00.000Z');
  });

  const advance = (ms: number) => {
    currentTime = addMilliseconds(currentTime, ms);
  };

  describe('with a fixed ttl', () => {
    const ttl = 1000;
    let mockGetter: Mock<() => string>;
    let cached: ReturnType<typeof expiringCachedGetter<string>>;

    beforeEach(() => {
      mockGetter = vi.fn(() => 'initial_value');
      cached = expiringCachedGetter({ getter: mockGetter, ttl, now });
    });

    it('should call the getter only once for multiple retrievals within the ttl', () => {
      expect(cached()).toBe('initial_value');
      advance(ttl - 1);
      expect(cached()).toBe('initial_value');
      expect(mockGetter).toHaveBeenCalledTimes(1);
    });

    it('should reload from the getter once the ttl has passed', () => {
      expect(cached()).toBe('initial_value');
      mockGetter.mockImplementation(() => 'reloaded_value');

      advance(ttl);
      expect(cached()).toBe('reloaded_value');
      expect(mockGetter).toHaveBeenCalledTimes(2);
    });

    it('should give the reloaded value a fresh ttl', () => {
      cached(); // load
      advance(ttl); // expire
      cached(); // reload (loadedAt reset to current time)
      mockGetter.mockClear();

      advance(ttl - 1);
      cached();
      expect(mockGetter).not.toHaveBeenCalled();
    });

    describe('expirationDetails()', () => {
      it('should return null before the cache has been used', () => {
        expect(cached.expirationDetails()).toBeNull();
      });

      it('should expose the load time plus the ttl as the expiration date', () => {
        const loadedAt = currentTime;
        cached();
        expect(cached.expirationDetails()?.getExpirationDate()).toEqual(addMilliseconds(loadedAt, ttl));
      });

      it('should report hasExpired relative to the provided now', () => {
        cached();
        expect(cached.expirationDetails()?.hasExpired(currentTime)).toBe(false);
        expect(cached.expirationDetails()?.hasExpired(addMilliseconds(currentTime, ttl))).toBe(true);
      });
    });

    describe('set()', () => {
      it('should update the value without calling the getter', () => {
        cached();
        mockGetter.mockClear();

        cached.set('manual_value');
        expect(cached()).toBe('manual_value');
        expect(mockGetter).not.toHaveBeenCalled();
      });

      it('should re-derive the expiration from the set time', () => {
        cached.set('manual_value');
        expect(cached.expirationDetails()?.getExpirationDate()).toEqual(addMilliseconds(currentTime, ttl));

        advance(ttl);
        expect(cached.expirationDetails()?.hasExpired(currentTime)).toBe(true);
      });
    });

    describe('reset()', () => {
      it('should clear the cache so the next call reloads', () => {
        expect(cached()).toBe('initial_value');
        cached.reset();
        expect(cached.used()).toBe(false);

        mockGetter.mockImplementation(() => 'reloaded_value');
        expect(cached()).toBe('reloaded_value');
        expect(mockGetter).toHaveBeenCalledTimes(2);
      });
    });

    describe('init()', () => {
      it('should re-initialize from the getter and recompute the expiration', () => {
        cached();
        advance(ttl / 2);
        mockGetter.mockImplementation(() => 'reinitialized_value');

        cached.init();
        expect(cached()).toBe('reinitialized_value');
        expect(cached.expirationDetails()?.getExpirationDate()).toEqual(addMilliseconds(currentTime, ttl));
        expect(mockGetter).toHaveBeenCalledTimes(2);
      });
    });

    describe('used()', () => {
      it('should return false before the cache has been accessed', () => {
        expect(cached.used()).toBe(false);
      });

      it('should return true after the cache has been accessed', () => {
        cached();
        expect(cached.used()).toBe(true);
      });

      it('should remain true for an expired-but-not-yet-reloaded value', () => {
        cached();
        advance(ttl);
        expect(cached.expirationDetails()?.hasExpired(currentTime)).toBe(true);
        expect(cached.used()).toBe(true);
      });
    });
  });

  describe('with a value-derived expiration', () => {
    interface ExpiringToken extends Expires {
      readonly token: string;
    }

    it('should use the value own expiresAt (Expires case)', () => {
      let counter = 0;
      const mockGetter = vi.fn((): ExpiringToken => {
        counter += 1;
        return { token: `token_${counter}`, expiresAt: addMilliseconds(currentTime, 500) };
      });

      const cached = expiringCachedGetter<ExpiringToken>({ getter: mockGetter, expiration: (value) => value.expiresAt, now });

      expect(cached().token).toBe('token_1');
      advance(499);
      expect(cached().token).toBe('token_1');
      expect(mockGetter).toHaveBeenCalledTimes(1);

      advance(1);
      expect(cached().token).toBe('token_2');
      expect(mockGetter).toHaveBeenCalledTimes(2);
    });

    it('should treat a null derived expiration as never-expiring', () => {
      const mockGetter = vi.fn(() => 'permanent_value');
      const cached = expiringCachedGetter<string>({ getter: mockGetter, expiration: () => null, now });

      expect(cached()).toBe('permanent_value');
      advance(1_000_000);
      expect(cached()).toBe('permanent_value');
      expect(cached.expirationDetails()?.getExpirationDate()).toBeNull();
      expect(cached.expirationDetails()?.hasExpired(currentTime)).toBe(false);
      expect(mockGetter).toHaveBeenCalledTimes(1);
    });

    it('should accept an epoch-milliseconds expiration', () => {
      const mockGetter = vi.fn(() => 'value');
      const expiresAtMs = addMilliseconds(currentTime, 200).getTime();
      const cached = expiringCachedGetter<string>({ getter: mockGetter, expiration: () => expiresAtMs, now });

      cached();
      expect(cached.expirationDetails()?.getExpirationDate()).toEqual(new Date(expiresAtMs));
      advance(200);
      expect(cached.expirationDetails()?.hasExpired(currentTime)).toBe(true);
    });

    it('should express a value-derived ttl via loadedAt', () => {
      const mockGetter = vi.fn(() => ({ value: 'v', ttl: 300 }));
      const cached = expiringCachedGetter({ getter: mockGetter, expiration: (value, loadedAt) => addMilliseconds(loadedAt, value.ttl), now });

      cached();
      advance(299);
      cached();
      expect(mockGetter).toHaveBeenCalledTimes(1);

      advance(1);
      cached();
      expect(mockGetter).toHaveBeenCalledTimes(2);
    });

    it('should take precedence over ttl', () => {
      const mockGetter = vi.fn(() => 'value');
      const cached = expiringCachedGetter<string>({ getter: mockGetter, ttl: 10, expiration: () => addMilliseconds(currentTime, 1000), now });

      cached();
      advance(500);
      expect(cached.expirationDetails()?.hasExpired(currentTime)).toBe(false);
      expect(mockGetter).toHaveBeenCalledTimes(1);
    });
  });

  describe('dynamic vs static expiration details', () => {
    it('static (default) should freeze the expiration details at load time', () => {
      let externalExpiresAt = addMilliseconds(currentTime, 500);
      const cached = expiringCachedGetter<string>({ getter: () => 'v', expiration: () => externalExpiresAt, now });

      cached();
      const frozen = externalExpiresAt;
      externalExpiresAt = addMilliseconds(currentTime, 5000);

      expect(cached.expirationDetails()?.getExpirationDate()).toEqual(frozen);
    });

    it('dynamic should recompute the expiration details on each access', () => {
      let externalExpiresAt = addMilliseconds(currentTime, 500);
      const cached = expiringCachedGetter<string>({ getter: () => 'v', expiration: () => externalExpiresAt, dynamic: true, now });

      cached();
      expect(cached.expirationDetails()?.getExpirationDate()).toEqual(externalExpiresAt);

      externalExpiresAt = addMilliseconds(currentTime, 5000);
      expect(cached.expirationDetails()?.getExpirationDate()).toEqual(externalExpiresAt);
    });

    it('dynamic should react to an externally-shortened expiration and reload', () => {
      let externalExpiresAt = addMilliseconds(currentTime, 1000);
      const mockGetter = vi.fn(() => 'v');
      const cached = expiringCachedGetter<string>({ getter: mockGetter, expiration: () => externalExpiresAt, dynamic: true, now });

      cached();
      advance(500);
      externalExpiresAt = addMilliseconds(currentTime, -100); // now in the past
      cached();
      expect(mockGetter).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkExpirationOnFirstGet', () => {
    it('should return a dead-on-arrival value without throwing by default', () => {
      const mockGetter = vi.fn(() => 'value');
      const cached = expiringCachedGetter<string>({ getter: mockGetter, expiration: () => addMilliseconds(currentTime, -1), now });

      expect(cached()).toBe('value');
      expect(cached.expirationDetails()?.hasExpired(currentTime)).toBe(true);
    });

    it('should throw when the freshly-loaded value is already expired', () => {
      const mockGetter = vi.fn(() => 'value');
      const cached = expiringCachedGetter<string>({ getter: mockGetter, expiration: () => addMilliseconds(currentTime, -1), checkExpirationOnFirstGet: true, now });

      expect(() => cached()).toThrow(/already expired/);
    });

    it('should not throw when the freshly-loaded value is still valid', () => {
      const mockGetter = vi.fn(() => 'value');
      const cached = expiringCachedGetter<string>({ getter: mockGetter, expiration: () => addMilliseconds(currentTime, 1000), checkExpirationOnFirstGet: true, now });

      expect(cached()).toBe('value');
    });

    it('should throw when a reload after expiry produces an already-expired value', () => {
      let expireImmediately = false;
      const mockGetter = vi.fn(() => 'value');
      const cached = expiringCachedGetter<string>({
        getter: mockGetter,
        expiration: () => addMilliseconds(currentTime, expireImmediately ? -1 : 1000),
        checkExpirationOnFirstGet: true,
        now
      });

      expect(cached()).toBe('value'); // valid at first load
      advance(1000); // expire the first value
      expireImmediately = true;
      expect(() => cached()).toThrow(/already expired/); // reload is dead-on-arrival
    });
  });

  describe('with no expiration configured', () => {
    it('should never expire (matching cachedGetter)', () => {
      const mockGetter = vi.fn(() => 'value');
      const cached = expiringCachedGetter<string>({ getter: mockGetter, now });

      expect(cached()).toBe('value');
      advance(1_000_000);
      expect(cached()).toBe('value');
      expect(cached.expirationDetails()?.hasExpired(currentTime)).toBe(false);
      expect(cached.expirationDetails()?.getExpirationDate()).toBeNull();
      expect(mockGetter).toHaveBeenCalledTimes(1);
    });
  });

  describe('default clock', () => {
    it('should use the real clock when no now getter is provided', () => {
      const mockGetter = vi.fn(() => 'value');
      const cached = expiringCachedGetter({ getter: mockGetter, ttl: 10_000 });

      expect(cached()).toBe('value');
      expect(cached.expirationDetails()?.hasExpired()).toBe(false);
      expect(cached.expirationDetails()?.getExpirationDate()).toBeInstanceOf(Date);
    });
  });
});
