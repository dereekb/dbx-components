import { describe, expect, it } from 'vitest';
import { snapshotConverterFunctions } from '../../common/firestore/snapshot/snapshot';
import { type SystemState } from './system';
import { SCHEDULER_SYSTEM_STATE_TYPE, type SchedulerSystemData, hasRunInCurrentHour, isNthHourOfDay, nthHourOfDayIndex, schedulerSystemDataConverter, schedulerSystemStateRead } from './system.scheduler';

/**
 * Local-time constructor, deliberately. Every predicate here reads the hour in the ambient timezone
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

describe('nthHourOfDayIndex()', () => {
  it('should return the zero-based window index for a matching hour', () => {
    // The day's every-3-hours windows are 0, 3, 6, 9, 12, ... so hour 12 is the 5th window, index 4.
    expect(nthHourOfDayIndex(3, dateAtHour(12))).toBe(4);
    expect(nthHourOfDayIndex(3, dateAtHour(0))).toBe(0);
    expect(nthHourOfDayIndex(3, dateAtHour(21))).toBe(7);
  });

  it('should return the hour itself for N=1', () => {
    expect(nthHourOfDayIndex(1, dateAtHour(13))).toBe(13);
  });

  it('should return null for a non-matching hour', () => {
    expect(nthHourOfDayIndex(3, dateAtHour(13))).toBeNull();
    expect(nthHourOfDayIndex(5, dateAtHour(12))).toBeNull();
  });

  it('should return null rather than NaN for N=0', () => {
    expect(nthHourOfDayIndex(0, dateAtHour(12))).toBeNull();
    expect(nthHourOfDayIndex(0, dateAtHour(0))).toBeNull();
  });

  it('should distinguish index 0 from no window', () => {
    // Both are falsy, which is exactly why the miss case is null and not a number - a caller
    // checking `if (index != null)` must still see the first window of the day.
    expect(nthHourOfDayIndex(6, dateAtHour(0))).toBe(0);
    expect(nthHourOfDayIndex(6, dateAtHour(1))).toBeNull();
  });

  it('should ignore minutes within the hour', () => {
    expect(nthHourOfDayIndex(3, dateAtHour(15, 59))).toBe(5);
  });

  it('should default to the current date when no date is given', () => {
    // N=1 matches every hour, so the index is just the current hour - deterministic without a clock.
    expect(nthHourOfDayIndex(1)).toBe(new Date().getHours());
  });
});

describe('schedulerSystemStateRead()', () => {
  it('should expose the moment it was built from', () => {
    const now = dateAtHour(12, 30);
    const read = schedulerSystemStateRead({ now, lastRunAt: null });

    expect(read.now).toBe(now);
    expect(read.hourOfDay).toBe(12);
  });

  it('should normalize an undefined lastRunAt to null', () => {
    // optionalFirestoreDate() reads an absent `lat` as undefined; the read normalizes it so callers
    // have one absent value to test against.
    expect(schedulerSystemStateRead({ now: dateAtHour(12), lastRunAt: undefined }).lastRunAt).toBeNull();
  });

  it('should default now to the current date', () => {
    const read = schedulerSystemStateRead({ lastRunAt: null });
    expect(read.hourOfDay).toBe(new Date().getHours());
  });

  describe('with no previous run', () => {
    const read = schedulerSystemStateRead({ now: dateAtHour(12, 30), lastRunAt: null });

    it('should report hasRunInCurrentHour as false', () => {
      expect(read.hasRunInCurrentHour).toBe(false);
    });

    it('should answer several intervals off one read', () => {
      expect(read.isOpen(1)).toBe(true);
      expect(read.isOpen(3)).toBe(true);
      expect(read.isOpen(5)).toBe(false); // 12 % 5 === 2
      expect(read.isOpen(12)).toBe(true);
    });

    it('should bind isNthHourOfDay to its own now', () => {
      expect(read.isNthHourOfDay(3)).toBe(true);
      expect(read.isNthHourOfDay(5)).toBe(false);
    });

    it('should bind nthHourOfDayIndex to its own now', () => {
      expect(read.nthHourOfDayIndex(3)).toBe(4);
      expect(read.nthHourOfDayIndex(5)).toBeNull();
    });
  });

  describe('with a previous run in the same hour', () => {
    const read = schedulerSystemStateRead({ now: dateAtHour(12, 55), lastRunAt: dateAtHour(12, 5) });

    it('should report hasRunInCurrentHour as true', () => {
      expect(read.hasRunInCurrentHour).toBe(true);
    });

    it('should close isOpen for every interval', () => {
      expect(read.isOpen(1)).toBe(false);
      expect(read.isOpen(3)).toBe(false);
      expect(read.isOpen(12)).toBe(false);
    });

    it('should still answer isNthHourOfDay, which ignores lastRunAt', () => {
      // This is the sub-gate for work running INSIDE an already-claimed hour: the hour is spent
      // either way, so the task only asks whether this is its hour.
      expect(read.isNthHourOfDay(3)).toBe(true);
      expect(read.nthHourOfDayIndex(3)).toBe(4);
    });
  });

  it('should not drift across an hour boundary between questions', () => {
    // The whole point of holding `now`: asking about 2 and then 3 is answered against one moment,
    // even if the wall clock rolls over mid-evaluation.
    const read = schedulerSystemStateRead({ now: dateAtHour(12), lastRunAt: null });

    expect(read.isOpen(2)).toBe(true);
    expect(read.isOpen(3)).toBe(true);
    expect(read.now.getHours()).toBe(12);
  });
});
