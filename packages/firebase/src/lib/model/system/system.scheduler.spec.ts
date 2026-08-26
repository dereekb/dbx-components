import { describe, expect, it } from 'vitest';
import { snapshotConverterFunctions } from '../../common/firestore/snapshot/snapshot';
import { type SystemState } from './system';
import { SCHEDULER_SYSTEM_STATE_TYPE, type SchedulerSystemData, hasRunInCurrentHour, isNthHourOfDay, schedulerSystemDataConverter } from './system.scheduler';

/**
 * Local-time constructor, deliberately. Both predicates read the hour in the ambient timezone
 * (`getHours()` / `roundDownToHour()`), so a `Z`-suffixed literal would make every expectation here
 * depend on the machine's timezone.
 */
function dateAtHour(hourOfDay: number, minutes: number = 0): Date {
  return new Date(2024, 0, 15, hourOfDay, minutes, 0, 0);
}

describe('isNthHourOfDay()', () => {
  describe('at hour 12', () => {
    const noon = dateAtHour(12, 30);

    // Pins the plan's worked example: this is a modulo against the hour-of-day, not an interval, so
    // only the divisors of 12 that are <= 12 open the gate at noon.
    const expectedOpenForN = new Set([1, 2, 3, 4, 6, 12]);

    for (let everyNHours = 1; everyNHours <= 12; everyNHours += 1) {
      const expected = expectedOpenForN.has(everyNHours);

      it(`should return ${expected} for N=${everyNHours}`, () => {
        expect(isNthHourOfDay(everyNHours, noon)).toBe(expected);
      });
    }
  });

  describe('at hour 0', () => {
    const midnight = dateAtHour(0);

    // 0 % n === 0 for every n, so midnight is an Nth hour for every N. This is what makes an
    // every-5-hours schedule still fire daily despite 5 not dividing 24.
    for (const everyNHours of [1, 2, 3, 5, 7, 12, 24]) {
      it(`should return true for N=${everyNHours}`, () => {
        expect(isNthHourOfDay(everyNHours, midnight)).toBe(true);
      });
    }
  });

  it('should return false for N=5 at hour 12', () => {
    expect(isNthHourOfDay(5, dateAtHour(12))).toBe(false);
  });

  it('should return true for N=5 at hour 15', () => {
    expect(isNthHourOfDay(5, dateAtHour(15))).toBe(true);
  });

  it('should ignore minutes and seconds within the hour', () => {
    expect(isNthHourOfDay(3, dateAtHour(15, 0))).toBe(true);
    expect(isNthHourOfDay(3, dateAtHour(15, 59))).toBe(true);
  });

  it('should return false for N=0 rather than dividing by zero', () => {
    // 12 % 0 is NaN, which would compare false anyway - this pins the guard so the result cannot
    // become true for hour 0 (0 % 0 is also NaN, but the guard is what makes that explicit).
    expect(isNthHourOfDay(0, dateAtHour(12))).toBe(false);
    expect(isNthHourOfDay(0, dateAtHour(0))).toBe(false);
  });

  it('should return false for a negative N', () => {
    expect(isNthHourOfDay(-3, dateAtHour(12))).toBe(false);
  });

  it('should default to the current date when no date is given', () => {
    // N=1 is true for every hour, so this is deterministic without freezing the clock.
    expect(isNthHourOfDay(1)).toBe(true);
  });
});

describe('hasRunInCurrentHour()', () => {
  it('should return false when lastRunAt is null', () => {
    expect(hasRunInCurrentHour(null, dateAtHour(12))).toBe(false);
  });

  it('should return false when lastRunAt is undefined', () => {
    expect(hasRunInCurrentHour(undefined, dateAtHour(12))).toBe(false);
  });

  it('should return true for two moments in the same hour', () => {
    expect(hasRunInCurrentHour(dateAtHour(12, 5), dateAtHour(12, 55))).toBe(true);
  });

  it('should return true for the same moment', () => {
    const now = dateAtHour(12, 30);
    expect(hasRunInCurrentHour(now, now)).toBe(true);
  });

  it('should return false across an hour boundary even when only minutes apart', () => {
    // The gate is a same-hour-bucket compare, NOT an elapsed-time compare. Two minutes apart, but
    // 12:59 and 13:01 are different hours - so the 13:00 cron run is allowed through.
    expect(hasRunInCurrentHour(dateAtHour(12, 59), dateAtHour(13, 1))).toBe(false);
  });

  it('should return false for the same hour on a different day', () => {
    expect(hasRunInCurrentHour(new Date(2024, 0, 14, 12, 30), new Date(2024, 0, 15, 12, 30))).toBe(false);
  });

  it('should return false when lastRunAt is in a later hour', () => {
    // A clock skew backwards must not be read as "already ran": the compare is on equality of the
    // hour bucket, so a future lastRunAt leaves the gate open.
    expect(hasRunInCurrentHour(dateAtHour(14), dateAtHour(12))).toBe(false);
  });

  it('should default to the current date when no now is given', () => {
    expect(hasRunInCurrentHour(new Date())).toBe(true);
  });
});

describe('schedulerSystemDataConverter', () => {
  const converter = snapshotConverterFunctions<SystemState<SchedulerSystemData>>({
    fields: {
      data: schedulerSystemDataConverter
    }
  });

  it('should round-trip lat as a Date', () => {
    const lat = dateAtHour(12, 30);
    const loaded = converter.mapFunctions.from(converter.mapFunctions.to({ data: { lat } }));

    expect(loaded.data.lat).toBeInstanceOf(Date);
    expect(loaded.data.lat?.getTime()).toBe(lat.getTime());
  });

  it('should read an absent lat as undefined', () => {
    // A fresh document has never claimed an hour. optionalFirestoreDate() leaves an absent value as
    // undefined rather than null, which is why hasRunInCurrentHour() tests `!= null` and why the
    // server accessor normalizes it to null before exposing it as `lastRunAt`.
    const loaded = converter.mapFunctions.from({ data: {} } as any);
    expect(loaded.data.lat).toBeUndefined();
  });

  it('should use the type identifier as its document id', () => {
    expect(SCHEDULER_SYSTEM_STATE_TYPE).toBe('scheduler');
  });
});
