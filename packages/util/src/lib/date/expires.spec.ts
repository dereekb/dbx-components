import { addMilliseconds } from './date';
import { checkAnyHaveExpired, checkAtleastOneNotExpired, isThrottled, expirationDetails, isUnderThreshold, calculateExpirationDate, isExpired } from './expires';

describe('expirationDetails()', () => {
  describe('hasExpired()', () => {
    it('should return true if the expiration time has passed', () => {
      const now = new Date();

      const details = expirationDetails({ expires: { expiresAt: now } });
      expect(details.hasExpired(now)).toBe(true);
    });

    it('should return false if the expiration time has not passed', () => {
      const later = new Date(new Date().getTime() + 1000);
      const details = expirationDetails({ expires: { expiresAt: later } });
      expect(details.hasExpired()).toBe(false);
    });

    describe('with now override', () => {
      it('should return false if the expiration time has not passed', () => {
        const now = new Date();
        const later = new Date(now.getTime() + 1000);

        const details = expirationDetails({ expires: { expiresAt: later } });
        expect(details.hasExpired(now)).toBe(false);
      });

      it('should return true if the expiration time has passed', () => {
        const now = new Date();
        const later = new Date(now.getTime() + 1000);

        const details = expirationDetails({ expires: { expiresAt: now } });
        expect(details.hasExpired(later)).toBe(true);
      });
    });
  });

  describe('getExpirationDate()', () => {
    describe('input', () => {
      describe('with empty input', () => {
        it('should return null', () => {
          const details = expirationDetails({});
          expect(details.getExpirationDate()).toBeNull();
        });
      });

      describe('with expires', () => {
        describe('with expiresAt', () => {
          it('should return the expiration date', () => {
            const expiresAt = new Date();
            const details = expirationDetails({ expires: { expiresAt } });
            expect(details.getExpirationDate()).toBeSameSecondAs(expiresAt);
          });
        });

        describe('without expiresAt', () => {
          it('should return null', () => {
            const details = expirationDetails({ expires: {} });
            expect(details.getExpirationDate()).toBeNull();
          });
        });
      });

      describe('with expiresAt', () => {
        it('should return the expiration date', () => {
          const expiresAt = new Date();
          const details = expirationDetails({ expiresAt });
          expect(details.getExpirationDate()).toBeSameSecondAs(expiresAt);
        });
      });

      describe('with expiresIn', () => {
        describe('with default now', () => {
          it('should return the expiration date relative to now', () => {
            const now = new Date();
            const expiresIn = 1000;
            const expectedExpiresAt = addMilliseconds(now, expiresIn);
            const details = expirationDetails({ expiresIn });
            expect(details.getExpirationDate(now)).toBeSameSecondAs(expectedExpiresAt);
          });
        });

        describe('with now', () => {
          it('should return the expiration date relative to now', () => {
            const now = new Date();
            const expiresIn = 1000;
            const expectedExpiresAt = addMilliseconds(now, expiresIn);
            const details = expirationDetails({ now, expiresIn });
            expect(details.getExpirationDate()).toBeSameSecondAs(expectedExpiresAt);
          });
        });

        describe('with expiresFromDate', () => {
          it('should return the expiration date relative to the expiresFromDate', () => {
            const now = new Date();

            const expiresInFromDateAndNowDifference = -5000;
            const expiresIn = 1000;

            const expiresFromDate = addMilliseconds(now, expiresInFromDateAndNowDifference); // 5 seconds ago
            const expectedExpiresAt = addMilliseconds(expiresFromDate, expiresIn);

            const details = expirationDetails({ expiresIn, expiresFromDate });
            expect(details.getExpirationDate(now)).toBeSameSecondAs(expectedExpiresAt);
          });
        });

        describe('with defaultExpiresFromDateToNow scenarios (expiresFromDate is not set)', () => {
          const expiresIn = 1000;

          it('should use now if defaultExpiresFromDateToNow is true', () => {
            const now = new Date();
            const details = expirationDetails({ expiresIn, defaultExpiresFromDateToNow: true });
            const expectedExpiresAt = addMilliseconds(now, expiresIn);
            expect(details.getExpirationDate(now)).toBeSameSecondAs(expectedExpiresAt);
          });

          it('should use now if defaultExpiresFromDateToNow is undefined (default)', () => {
            const now = new Date();
            const details = expirationDetails({ expiresIn, defaultExpiresFromDateToNow: undefined });
            const expectedExpiresAt = addMilliseconds(now, expiresIn);
            expect(details.getExpirationDate(now)).toBeSameSecondAs(expectedExpiresAt);
          });

          it('should return null if defaultExpiresFromDateToNow is false and expiresFromDate is not set', () => {
            const now = new Date();
            const details = expirationDetails({ expiresIn, defaultExpiresFromDateToNow: false });
            // When base date for addMilliseconds is null, the result is null
            expect(details.getExpirationDate(now)).toBeNull();
          });
        });
      });
    });
  });

  describe('scenarios', () => {
    /**
     * The reverse of throttling, returns true if the expiration has not yet been met.
     */
    describe('threshold', () => {
      it('should return true if under the threshold', () => {
        const now = new Date();

        const nextScheduledRunAt = addMilliseconds(now, 500);
        const threshold = 1000;

        const details = expirationDetails({ expiresFromDate: nextScheduledRunAt, expiresIn: -threshold });
        expect(details.hasExpired()).toBe(true);
      });

      it('should return false if over the threshold', () => {
        const now = new Date();

        const nextScheduledRunAt = addMilliseconds(now, 1500);
        const threshold = 1000;

        const details = expirationDetails({ expiresFromDate: nextScheduledRunAt, expiresIn: -threshold });
        expect(details.hasExpired()).toBe(false);
      });

      describe('isUnderThreshold()', () => {
        it('should return false if the nextRunAt date is not defined.', () => {
          const now = new Date();

          const nextScheduledRunAt = null;
          const threshold = 1000;

          const result = isUnderThreshold(threshold, nextScheduledRunAt, now);
          expect(result).toBe(false);
        });

        it('should return true if under the threshold', () => {
          const now = new Date();

          const nextScheduledRunAt = addMilliseconds(now, 500);
          const threshold = 1000;

          const result = isUnderThreshold(threshold, nextScheduledRunAt, now);
          expect(result).toBe(true);
        });

        it('should return false if over the threshold', () => {
          const now = new Date();

          const nextScheduledRunAt = addMilliseconds(now, 1500);
          const threshold = 1000;

          const result = isUnderThreshold(threshold, nextScheduledRunAt, now);
          expect(result).toBe(false);
        });
      });
    });

    describe('throttling', () => {
      it('should return not expires if still being throttled', () => {
        const now = new Date();

        const lastRunAt = addMilliseconds(now, -500);
        const throttleFor = 1000;

        const details = expirationDetails({ expiresFromDate: lastRunAt, expiresIn: throttleFor });
        expect(details.hasExpired()).toBe(false);
      });

      describe('isThrottled()', () => {
        it('should return false if there was no last run (null/undefined)', () => {
          const throttled = isThrottled(1000, null);
          expect(throttled).toBe(false);
        });

        it('should return true if the throttle time has not passed since the last run time', () => {
          const now = new Date();

          const lastRunAt = addMilliseconds(now, -500);
          const throttleFor = 1000;

          const throttled = isThrottled(throttleFor, lastRunAt, now);
          expect(throttled).toBe(true);
        });

        it('should return false if the throttle time has passed since the last run time', () => {
          const now = new Date();

          const lastRunAt = addMilliseconds(now, -500);
          const throttleFor = 200;

          const throttled = isThrottled(throttleFor, lastRunAt, now);
          expect(throttled).toBe(false);
        });
      });
    });
  });
});

describe('calculateExpirationDate()', () => {
  it('should return the expiration date if calculable', () => {
    const expiresAt = new Date(Date.now() + 10000); // 10 seconds in the future
    const result = calculateExpirationDate({ expiresAt });
    expect(result).toBeSameSecondAs(expiresAt);
  });

  it('should return null if the expiration date cannot be determined from the input', () => {
    const result = calculateExpirationDate({});
    expect(result).toBeNull();
  });

  it('should correctly calculate expiration based on expiresIn and now', () => {
    const now = new Date();
    const expiresIn = 5000; // 5 seconds
    const expectedExpiration = addMilliseconds(now, expiresIn);
    const result = calculateExpirationDate({ expiresIn, now });
    expect(result).toBeSameSecondAs(expectedExpiration);
  });

  it('should correctly calculate expiration based on expiresIn and expiresFromDate', () => {
    const expiresFromDate = new Date(Date.now() - 10000); // 10 seconds ago
    const expiresIn = 5000; // 5 seconds
    const expectedExpiration = addMilliseconds(expiresFromDate, expiresIn);
    const result = calculateExpirationDate({ expiresIn, expiresFromDate });
    expect(result).toBeSameSecondAs(expectedExpiration);
  });
});

describe('checkAtleastOneNotExpired()', () => {
  it('should return false if the list is empty', () => {
    expect(checkAtleastOneNotExpired([])).toBe(false);
  });

  it('should return true if there is an item that has not yet expired', () => {
    const details = expirationDetails({ expiresIn: 1000 });
    expect(checkAtleastOneNotExpired([details])).toBe(true);
  });

  it('should return false if all items have expired', () => {
    const details = expirationDetails({ expiresIn: -1000 });
    expect(checkAtleastOneNotExpired([details])).toBe(false);
  });
});

describe('checkAnyHaveExpired()', () => {
  it('should return true if the list is empty and defaultIfEmpty is not set', () => {
    expect(checkAnyHaveExpired([])).toBe(true);
  });

  it('should return false if the list is empty and defaultIfEmpty is set to false', () => {
    expect(checkAnyHaveExpired([], false)).toBe(false);
  });

  it('should return true if there is an item that has expired', () => {
    const details = expirationDetails({ expiresIn: -1000 });
    expect(checkAnyHaveExpired([details])).toBe(true);
  });

  it('should return false if all items have not expired', () => {
    const details = expirationDetails({ expiresIn: 1000 });
    expect(checkAnyHaveExpired([details])).toBe(false);
  });
});

describe('isExpired()', () => {
  it('should return true when input is null', () => {
    expect(isExpired(null)).toBe(true);
  });

  it('should return true when input is undefined', () => {
    expect(isExpired(undefined)).toBe(true);
  });

  it('should return true when expiresAt is null', () => {
    expect(isExpired({ expiresAt: null })).toBe(true);
  });

  it('should return true for a Date in the past', () => {
    const past = new Date(Date.now() - 1000);
    expect(isExpired({ expiresAt: past })).toBe(true);
  });

  it('should return false for a Date in the future', () => {
    const future = new Date(Date.now() + 60_000);
    expect(isExpired({ expiresAt: future })).toBe(false);
  });

  it('should treat values within the buffer window as expired when now is shifted forward', () => {
    const expiresAt = new Date(Date.now() + 30_000);
    const nowWithBuffer = addMilliseconds(new Date(), 60_000);
    expect(isExpired({ expiresAt }, nowWithBuffer)).toBe(true);
  });

  it('should respect a now override', () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const now = addMilliseconds(expiresAt, 1);
    expect(isExpired({ expiresAt }, now)).toBe(true);
  });

  it('should treat exact equality as expired', () => {
    const now = new Date();
    expect(isExpired({ expiresAt: now }, now)).toBe(true);
  });

  it('should defer to the input now when no override is given', () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const inputNow = addMilliseconds(expiresAt, 1);
    expect(isExpired({ expiresAt, now: inputNow })).toBe(true);
  });

  it('should prefer expires over a top-level expiresAt when both are present', () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    // expires says expired, top-level expiresAt says not expired — expires must win.
    expect(isExpired({ expires: { expiresAt: past }, expiresAt: future })).toBe(true);
    // And the other way: expires says not expired, top-level says expired — expires must win.
    expect(isExpired({ expires: { expiresAt: future }, expiresAt: past })).toBe(false);
  });

  it('should treat a present expires with no expiresAt as expired regardless of top-level fallback', () => {
    const future = new Date(Date.now() + 60_000);
    // With expires supplied (but expiresAt null), the top-level future date must NOT rescue it.
    expect(isExpired({ expires: { expiresAt: null }, expiresAt: future })).toBe(true);
  });
});
