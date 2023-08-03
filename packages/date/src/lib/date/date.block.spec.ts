import { expectFail, itShouldFail } from '@dereekb/util/test';
import { DateRange, DateRangeInput, isDateInDateRange } from './date.range';
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, endOfDay, addSeconds, addMilliseconds, millisecondsToHours, minutesToHours, isBefore, isAfter } from 'date-fns';
import {
  changeTimingToTimezoneFunction,
  DateBlock,
  dateBlockDayOfWeekFactory,
  DateBlockIndex,
  dateBlockIndexRange,
  DateBlockRange,
  dateBlockRange,
  dateBlockRangeBlocksCount,
  dateBlockRangeBlocksCountInfo,
  dateBlockRangeIncludedByRangeFunction,
  dateBlockRangesFullyCoverDateBlockRangeFunction,
  DateBlockRangeWithRange,
  dateBlockDayTimingInfoFactory,
  dateBlocksExpansionFactory,
  dateBlocksInDateBlockRange,
  dateBlockTiming,
  DateBlockTiming,
  dateBlockTimingInTimezoneFunction,
  dateTimingRelativeIndexArrayFactory,
  dateTimingRelativeIndexFactory,
  expandDateBlockRange,
  expandUniqueDateBlocksFunction,
  getCurrentDateBlockTimingOffset,
  getCurrentDateBlockTimingStartDate,
  getRelativeIndexForDateTiming,
  groupToDateBlockRanges,
  groupUniqueDateBlocks,
  isDateBlockWithinDateBlockRangeFunction,
  isValidDateBlockIndex,
  isValidDateBlockTiming,
  isValidDateBlockTimingStartDate,
  modifyDateBlocksToFitRange,
  modifyDateBlocksToFitRangeFunction,
  sortDateBlockRanges,
  timingIsInExpectedTimezoneFunction,
  UniqueDateBlockRange,
  allIndexesInDateBlockRanges,
  isValidDateBlockRange,
  isValidDateBlockRangeSeries,
  getGreatestDateBlockIndexInDateBlockRanges,
  getDateBlockTimingHoursInEvent,
  getDateBlockTimingFirstEventDateRange,
  dateBlockTimingFromDateRangeAndEvent,
  getCurrentDateBlockTimingUtcData,
  getCurrentDateBlockTimingOffsetData
} from './date.block';
import { MS_IN_DAY, MINUTES_IN_DAY, range, RangeInput, Hours, Day, TimezoneString } from '@dereekb/util';
import { copyHoursAndMinutesFromDate, roundDownToHour, roundDownToMinute } from './date';
import { dateBlockDurationSpanHasNotEndedFilterFunction } from './date.filter';
import { dateTimezoneUtcNormal, getCurrentSystemOffsetInHours, systemBaseDateToNormalDate, systemNormalDateToBaseDate } from './date.timezone';
import { formatToISO8601DayString } from './date.format';

describe('isValidDateBlockIndex()', () => {
  it('should return false for -1.', () => {
    expect(isValidDateBlockIndex(-1)).toBe(false);
  });

  it('should return false for 0.5', () => {
    expect(isValidDateBlockIndex(0.5)).toBe(false);
  });

  it('should return true for 0.', () => {
    expect(isValidDateBlockIndex(0)).toBe(true);
  });

  it('should return true for 100.', () => {
    expect(isValidDateBlockIndex(100)).toBe(true);
  });
});

describe('isValidDateBlockRange()', () => {
  it('should return false if to is less than i.', () => {
    expect(isValidDateBlockRange({ i: 1, to: 0 })).toBe(false);
  });

  it('should return false if to is a non-integer.', () => {
    expect(isValidDateBlockRange({ i: 0, to: 1.2 })).toBe(false);
  });

  it('should return false if i is negative', () => {
    expect(isValidDateBlockRange({ i: -1 })).toBe(false);
  });

  it('should return false if i is a non-integer value.', () => {
    expect(isValidDateBlockRange({ i: 1.2 })).toBe(false);
  });

  it('should return true if only i is provided', () => {
    expect(isValidDateBlockRange({ i: 1 })).toBe(true);
  });

  it('should return true for a valid range.', () => {
    expect(isValidDateBlockRange({ i: 1, to: 5 })).toBe(true);
  });
});

describe('isValidDateBlockRangeSeries()', () => {
  it('should return false if one input is not a valid series.', () => {
    expect(isValidDateBlockRangeSeries([{ i: 1, to: 0 }])).toBe(false);
  });

  it('should return false if one index is repeated.', () => {
    expect(
      isValidDateBlockRangeSeries([
        { i: 0, to: 2 },
        { i: 2, to: 3 }
      ])
    ).toBe(false);
  });

  it('should return true for a single item series.', () => {
    expect(isValidDateBlockRangeSeries([{ i: 0, to: 2 }])).toBe(true);
  });

  it('should return true for a valid series.', () => {
    expect(
      isValidDateBlockRangeSeries([
        { i: 0, to: 2 },
        { i: 3, to: 5 }
      ])
    ).toBe(true);
  });
});

describe('getGreatestDateBlockIndexInDateBlockRanges()', () => {
  it('should return 0 for empty arrays.', () => {
    const greatestIndex = 0;

    const result = getGreatestDateBlockIndexInDateBlockRanges([]);
    expect(result).toBe(greatestIndex);
  });

  it('should return the largest index in the input ranges.', () => {
    const greatestIndex = 100;

    const result = getGreatestDateBlockIndexInDateBlockRanges([{ i: 0 }, { i: 12, to: 23 }, { i: 40, to: greatestIndex }, { i: 50, to: 55 }]);
    expect(result).toBe(greatestIndex);
  });
});

describe('getCurrentDateBlockTimingUtcData()', () => {
  describe('Asia/Tokyo', () => {
    it('should return the expected offset.', () => {
      const expectedUTCDate = new Date('2023-08-03T00:00:00.000Z'); // 8/03/23 in UTC
      const start = new Date('2023-08-02T15:00:00.000Z'); // 8/03/23 in UTC
      const result = getCurrentDateBlockTimingUtcData({ start });

      expect(result.originalUtcOffsetInHours).toBe(9);
      expect(result.originalUtcDate).toBeSameSecondAs(expectedUTCDate);
    });
  });
});

describe('getCurrentDateBlockTimingOffset()', () => {
  const utcDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

  describe('system time', () => {
    it('should apply the expected offset.', () => {
      const start = new Date(2022, 0, 2); // first second of the day date with an offset equal to the current.

      const systemTimezoneOffset = start.getTimezoneOffset();
      const systemDateAsUtc = addMinutes(start, -systemTimezoneOffset); // timezone offset is inverse of UTC zones

      expect(systemDateAsUtc).toBeSameSecondAs(utcDate);

      const duration = 60;
      const timing: DateBlockTiming = dateBlockTiming({ startsAt: start, duration: 60 }, { start: start, end: addMinutes(start, duration) });
      const offset = getCurrentDateBlockTimingOffset(timing);

      // zero offset when system timezone matches the given, otherwise creating a new start date would allow applying an offset.
      expect(millisecondsToHours(offset)).toBe(0);
      expect(addMilliseconds(start, offset)).toBeSameSecondAs(start);
    });
  });

  const shiftStartDateInUTC = new Date(2022, 0, 2); // addHours(new Date(2022, 0, 2), getCurrentSystemOffsetInHours(utcDate));

  function describeUTCShift(utc: Hours) {
    const systemTimezoneHoursOffset = minutesToHours(-shiftStartDateInUTC.getTimezoneOffset());
    let systemToTargetTimezoneDifference = utc - systemTimezoneHoursOffset;

    if (systemToTargetTimezoneDifference === -24) {
      systemToTargetTimezoneDifference = 0;
    }

    describe(`UTC${utc > 0 ? '+' : ''}${utc}`, () => {
      it('should apply the expected offset.', () => {
        // offset of 0 is equvalent to system time test
        const timezoneOffsetDate = addHours(shiftStartDateInUTC, -systemToTargetTimezoneDifference); // hours offset is inverse

        const duration = 60;
        const timing: DateBlockTiming = dateBlockTiming({ startsAt: timezoneOffsetDate, duration }, { start: timezoneOffsetDate, end: addMinutes(timezoneOffsetDate, duration) });

        const offset = getCurrentDateBlockTimingOffset(timing);
        expect(millisecondsToHours(offset)).toBe(systemToTargetTimezoneDifference);
        expect(addMilliseconds(timezoneOffsetDate, offset)).toBeSameSecondAs(shiftStartDateInUTC);
      });
    });
  }

  // builds a range of tests concerning valid date range offsets. from the system offset.
  // only date block timing offsets of -11 to 12 are valid
  range(-11, 12).forEach((x) => {
    describeUTCShift(x);
  });
});

describe('getCurrentDateBlockTimingStartDate()', () => {
  const utcDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

  describe('system time', () => {
    it('should apply the expected offset.', () => {
      const start = new Date(2022, 0, 2);

      const systemTimezoneOffset = start.getTimezoneOffset();
      const systemDateAsUtc = addMinutes(start, -systemTimezoneOffset);

      expect(systemDateAsUtc).toBeSameSecondAs(utcDate);

      const timing: DateBlockTiming = dateBlockTiming({ startsAt: start, duration: 60 }, 2);
      const date = getCurrentDateBlockTimingStartDate(timing);

      expect(date).toBeSameSecondAs(start);
    });
  });
});

describe('timingIsInExpectedTimezoneFunction()', () => {
  describe('function', () => {
    describe('UTC', () => {
      const fn = timingIsInExpectedTimezoneFunction('UTC');
      const utcStart = new Date('2023-03-12T00:00:00.000Z');
      const gmtnegative1Start = new Date('2023-03-12T01:00:00.000Z');

      it('should return true if the timing starts in UTC.', () => {
        const result = fn({ start: utcStart });
        expect(result).toBe(true);
      });

      it('should return false if the timing starts in a timezone with a different offset.', () => {
        const result = fn({ start: gmtnegative1Start });
        expect(result).toBe(false);
      });
    });

    describe('America/Denver', () => {
      const fn = timingIsInExpectedTimezoneFunction('America/Denver');
      const mstStart = new Date('2023-03-11T07:00:00.000Z'); // 7 hours behind UTC
      const mdtStart = new Date('2023-03-12T06:00:00.000Z'); // 6 hours behind UTC
      const gmtnegative1Start = new Date('2023-03-12T01:00:00.000Z');

      it('should return true if the timing starts in MST.', () => {
        const result = fn({ start: mstStart });
        expect(result).toBe(true);
      });

      it('should return true if the timing starts in MDT (Daylight Savings Begins).', () => {
        const normal = dateTimezoneUtcNormal({ timezone: 'America/Denver' });

        const offsetA = normal.baseDateToTargetDateOffset(mstStart);
        const offsetB = normal.baseDateToTargetDateOffset(mdtStart);

        expect(offsetA).not.toBe(offsetB);

        const result = fn({ start: mdtStart });
        expect(result).toBe(true);
      });

      it('should return false if the timing starts in a timezone with a different offset.', () => {
        const result = fn({ start: gmtnegative1Start });
        expect(result).toBe(false);
      });
    });
  });
});

describe('getDateBlockTimingFirstEventDateRange()', () => {
  const hours = 4;
  const startsAt = startOfDay(new Date());
  const timing = dateBlockTiming({ startsAt, duration: 60 * hours }, 2); // 2 days

  it('should return the hours in the timing.', () => {
    const result = getDateBlockTimingFirstEventDateRange(timing);
    expect(result.start).toBeSameSecondAs(startsAt);
    expect(result.end).toBeSameSecondAs(addHours(startsAt, hours));
  });
});

describe('getDateBlockTimingHoursInEvent()', () => {
  const hours = 4;
  const startsAt = startOfDay(new Date());
  const timing = dateBlockTiming({ startsAt, duration: 60 * hours }, 2); // 2 days

  it('should return the hours in the timing.', () => {
    const result = getDateBlockTimingHoursInEvent(timing);
    expect(result).toBe(hours);
  });
});

describe('dateBlockTimingFromDateRangeAndEvent()', () => {
  describe('function', () => {
    const startOfToday = startOfDay(new Date());
    const systemTiming = dateBlockTiming({ startsAt: addHours(startOfToday, 3), duration: 60 }, 2); // 2 days

    describe('system time', () => {
      const timing = systemTiming;

      it('should return a copy of a timing.', () => {
        const result = dateBlockTimingFromDateRangeAndEvent(timing, timing); // use the first event again

        expect(result.start).toBeSameSecondAs(timing.start);
        expect(result.end).toBeSameSecondAs(timing.end);
        expect(result.duration).toBe(timing.duration);
        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
      });

      it('should return the original timing using the second event', () => {
        const result = dateBlockTimingFromDateRangeAndEvent(timing, { startsAt: addDays(timing.startsAt, 1), duration: timing.duration }); // use the first event again

        expect(result.start).toBeSameSecondAs(timing.start);
        expect(result.end).toBeSameSecondAs(timing.end);
        expect(result.duration).toBe(timing.duration);
        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
      });
    });

    function describeTestsForTimezone(timezone: TimezoneString) {
      const startOfTodayInTimezone = dateTimezoneUtcNormal({ timezone }).systemDateToTargetDate(startOfDay(new Date()));
      const timing = dateBlockTiming({ startsAt: addHours(startOfTodayInTimezone, 3), duration: 60 }, 2); // 2 days

      describe(`${timezone}`, () => {
        it('should return a copy of a timing.', () => {
          const result = dateBlockTimingFromDateRangeAndEvent(timing, timing); // use the first event again

          expect(result.start).toBeSameSecondAs(timing.start);
          expect(result.end).toBeSameSecondAs(timing.end);
          expect(result.duration).toBe(timing.duration);
          expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
        });

        it('should return the original timing using the second event', () => {
          const result = dateBlockTimingFromDateRangeAndEvent(timing, { startsAt: addDays(timing.startsAt, 1), duration: timing.duration }); // use the first event again

          expect(result.start).toBeSameSecondAs(timing.start);
          expect(result.end).toBeSameSecondAs(timing.end);
          expect(result.duration).toBe(timing.duration);
          expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
        });
      });
    }

    describeTestsForTimezone('UTC');
    describeTestsForTimezone('America/Denver');
    describeTestsForTimezone('America/Los_Angeles');
    describeTestsForTimezone('America/New_York');
    describeTestsForTimezone('America/Chicago');
    describeTestsForTimezone('Pacific/Auckland');
    describeTestsForTimezone('Pacific/Kiritimati');
  });
});

describe('changeTimingToTimezoneFunction()', () => {
  describe('function', () => {
    const startOfToday = startOfDay(new Date());
    const timing = dateBlockTiming({ startsAt: addHours(startOfToday, 3), duration: 60 }, 2); // 2 days

    describe('UTC', () => {
      const fn = changeTimingToTimezoneFunction('UTC');
      const utcTimezoneOffsetInHours = 0; // GMT-0

      it('should convert the start date to the UTC timezone.', () => {
        const result = fn(timing);

        const { start } = result;
        const utcHours = start.getUTCHours();
        expect(utcHours).toBe(utcTimezoneOffsetInHours);

        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
        expect(result.end).toBeSameSecondAs(timing.end);
        expect(result.duration).toBe(timing.duration);
      });

      describe('UTC via other timing', () => {
        const startsAtInUtcDate = new Date('2022-01-02T00:00:00Z'); // 0 offset UTC date
        const utcTiming = { start: startsAtInUtcDate, startsAt: addHours(startsAtInUtcDate, 1), duration: 60 };
        const fn = changeTimingToTimezoneFunction(utcTiming);

        it('should convert the start date to the UTC timezone.', () => {
          const result = fn(timing);

          const { start } = result;
          const utcHours = start.getUTCHours();
          expect(utcHours).toBe(utcTimezoneOffsetInHours);

          expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
          expect(result.end).toBeSameSecondAs(timing.end);
          expect(result.duration).toBe(timing.duration);
        });
      });
    });

    describe('America/Denver', () => {
      const fn = changeTimingToTimezoneFunction('America/Denver');

      // GMT-6 or GMT-7 depending on time of year
      const denverTimezoneOffsetInHours = millisecondsToHours(dateTimezoneUtcNormal('America/Denver').targetDateToBaseDateOffset(startOfToday));

      it('should convert the start date to the America/Denver timezone.', () => {
        const result = fn(timing);

        const { start } = result;
        const utcHours = start.getUTCHours();
        expect(utcHours).toBe(denverTimezoneOffsetInHours);

        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
        expect(result.end).toBeSameSecondAs(timing.end);
        expect(result.duration).toBe(timing.duration);
      });
    });
  });
});

describe('dateBlockTimingInTimezoneFunction()', () => {
  describe('function', () => {
    const startOfToday = startOfDay(new Date());

    describe('UTC', () => {
      const fn = dateBlockTimingInTimezoneFunction('UTC');
      const utcTimezoneOffsetInHours = 0; // GMT-0

      it('should create a timing in the UTC timezone.', () => {
        const duration = 60;
        const startsAt = addHours(startOfToday, 3);
        const result = fn({ startsAt, duration }, 2);

        const { start } = result;
        const utcHours = start.getUTCHours();
        expect(utcHours).toBe(utcTimezoneOffsetInHours);

        expect(result.startsAt).toBeSameSecondAs(startsAt);
        expect(result.duration).toBe(duration);
      });
    });

    describe('America/Denver', () => {
      const fn = dateBlockTimingInTimezoneFunction('America/Denver');

      // GMT-6 or GMT-7 depending on time of year
      const denverTimezoneOffsetInHours = millisecondsToHours(dateTimezoneUtcNormal('America/Denver').targetDateToBaseDateOffset(startOfToday));

      it('should create a timing in the America/Denver timezone.', () => {
        const duration = 60;
        const startsAt = addHours(startOfToday, 3);
        const result = fn({ startsAt, duration }, 2);

        const { start } = result;
        const utcHours = start.getUTCHours();
        expect(utcHours).toBe(denverTimezoneOffsetInHours);

        expect(result.startsAt).toBeSameSecondAs(startsAt);
        expect(result.duration).toBe(duration);
      });
    });
  });
});

describe('dateTimingRelativeIndexFactory()', () => {
  describe('function', () => {
    const start = startOfDay(new Date());
    const startsAt = addHours(start, 12); // Noon on the day
    const days = 5;
    const duration = 60;
    const systemTiming = dateBlockTiming({ startsAt, duration }, days);

    describe('UTC', () => {
      const timezone = 'UTC';
      const timing = changeTimingToTimezoneFunction(timezone)(systemTiming);
      const fn = dateTimingRelativeIndexFactory(timing);

      it('should return the expected indexes.', () => {
        const dayString = formatToISO8601DayString(start);

        const result1date = fn(start); // input the system time
        const result1day = fn(dayString);

        expect(result1day).toBe(0);
        expect(result1date).toBe(0);
      });
    });

    describe('America/Denver', () => {
      const timezone = 'America/Denver';
      const timing = changeTimingToTimezoneFunction(timezone)(systemTiming);
      const fn = dateTimingRelativeIndexFactory(timing);

      it('should return the expected indexes.', () => {
        const dayString = formatToISO8601DayString(start);

        const result1date = fn(start); // input the system time
        const result1day = fn(dayString);

        expect(result1day).toBe(0);
        expect(result1date).toBe(0);
      });
    });
  });

  describe('scenarios', () => {
    describe('timezone change', () => {
      const start = new Date('2023-03-11T06:00:00.000Z'); // timezone offset changes going into the next day.
      const dstDay = new Date('2023-03-13T06:00:00.000Z'); // daylight Savings has occured for some timezones. We jump 2 days however to ensure all zones are in the next timezone where applicable.

      it('should handle daylight savings time changes.', () => {
        const factory = dateTimingRelativeIndexFactory({ start });
        const result = factory(dstDay);

        expect(result).toBe(2); // 2 days later
      });
    });
  });
});

describe('dateTimingRelativeIndexArrayFactory()', () => {
  const start = startOfDay(new Date());

  describe('function', () => {
    const indexFactory = dateTimingRelativeIndexFactory({ start });
    const factory = dateTimingRelativeIndexArrayFactory(indexFactory);

    it('should convert a DateRange', () => {
      const days = 5;
      const dateRange: DateRange = { start, end: addDays(start, days - 1) };
      const result = factory(dateRange);

      expect(result.length).toBe(days);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(1);
      expect(result[2]).toBe(2);
      expect(result[3]).toBe(3);
      expect(result[4]).toBe(4);
    });

    it('should convert a Date', () => {
      const result = factory(start);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0);
    });

    it('should convert a DateBlockRangeWithRange', () => {
      const days = 5;
      const dateRange: DateBlockRangeWithRange = { i: 0, to: days - 1 };
      const result = factory(dateRange);

      expect(result.length).toBe(days);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(1);
      expect(result[2]).toBe(2);
      expect(result[3]).toBe(3);
      expect(result[4]).toBe(4);
    });

    it('should convert a DateBlockRange', () => {
      const dateRange: DateBlockRange = { i: 0 };
      const result = factory(dateRange);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0);
    });

    it('should convert a DateBlockIndex', () => {
      const index = 100;
      const result = factory(index);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(index);
    });

    it('should convert an array of DateBlockIndex values', () => {
      const index = 10;
      const result = factory(range(0, index));

      expect(result.length).toBe(index);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(1);
      expect(result[2]).toBe(2);
      expect(result[3]).toBe(3);
      expect(result[4]).toBe(4);
      expect(result[index - 1]).toBe(index - 1);
    });
  });
});

describe('getRelativeIndexForDateTiming()', () => {
  const start = startOfDay(new Date());
  const startsAt = addHours(start, 12); // Noon on the day
  const days = 5;
  const timing = dateBlockTiming({ startsAt, duration: 60 }, days);

  it('same time should return an index of 0', () => {
    const result = getRelativeIndexForDateTiming(timing, startsAt);
    expect(result).toBe(0);
  });

  it('same 24 hour period should return an index of 0', () => {
    const result = getRelativeIndexForDateTiming(timing, addHours(startsAt, 6));
    expect(result).toBe(0);
  });

  it('yesterday should return an index of -1', () => {
    const result = getRelativeIndexForDateTiming(timing, addDays(startsAt, -1));
    expect(result).toBe(-1);
  });

  it('tomorrow should return an index of 1', () => {
    const result = getRelativeIndexForDateTiming(timing, addDays(startsAt, 1));
    expect(result).toBe(1);
  });

  it('one week later should return an index of 7', () => {
    const result = getRelativeIndexForDateTiming(timing, addDays(startsAt, 7));
    expect(result).toBe(7);
  });
});

describe('dateBlockTiming()', () => {
  const startsAt = setMinutes(setHours(systemNormalDateToBaseDate(new Date()), 12), 0); // keep seconds to show rounding
  const start = systemNormalDateToBaseDate(startOfDay(startsAt));
  const days = 5;
  const minutes = 60;

  it('should allow a duration of 24 hours', () => {
    const result = dateBlockTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
    expect(result).toBeDefined();
    expect(result.duration).toBe(MINUTES_IN_DAY);
  });

  describe('range input', () => {
    describe('number of days', () => {
      it('should start at the beginning of the startsAt date', () => {
        const result = dateBlockTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
        expect(result.start).toBeSameSecondAs(startOfDay(startsAt));
      });

      it('should retain the startsAt time', () => {
        const result = dateBlockTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
        expect(result.startsAt).toBeSameSecondAs(roundDownToHour(startsAt));
      });

      it('should create a timing for a specific time that last 1 day', () => {
        const days = 1;
        const result = dateBlockTiming({ startsAt, duration: minutes }, days);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.end).toBeSameMinuteAs(addMinutes(startsAt, minutes));
        expect(result.duration).toBe(minutes);
      });

      it('should create a timing for a specific time that last 5 days', () => {
        const result = dateBlockTiming({ startsAt, duration: minutes }, days);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days - 1), minutes));
      });
    });

    describe('Range', () => {
      itShouldFail('if the input start date of the date range is not a valid DateBlockTiming start date', () => {
        const start = addHours(startsAt, -6);
        expect(isValidDateBlockTimingStartDate(start)).toBe(false);

        const dateRange: DateRange = { start: start, end: start };
        expectFail(() => dateBlockTiming({ startsAt, duration: minutes }, dateRange));
      });

      it('should create a timing that starts at the input start time with a start before the startsAt time (same day)', () => {
        const start = roundDownToHour(addHours(startsAt, -6));
        const dateRange: DateRange = { start: start, end: start };
        const result = dateBlockTiming({ startsAt, duration: minutes }, dateRange);

        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(start);
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(startsAt, minutes));
      });

      it('should create a timing that starts at the input start time with a start after the startsAt time (next day)', () => {
        const start = roundDownToHour(addHours(startsAt, 6));
        const dateRange: DateRange = { start: start, end: start };

        const result = dateBlockTiming({ startsAt, duration: minutes }, dateRange);
        const expectedStartsAt = addDays(startsAt, 1);

        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(start);
        expect(result.startsAt).toBeSameMinuteAs(expectedStartsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(expectedStartsAt, minutes));
      });

      it('should create a timing that starts at the input start time and last 5 days using a Range', () => {
        const start = startOfDay(startsAt);
        const dateRange: DateRange = { start: start, end: endOfDay(addDays(startsAt, days - 1)) };
        const result = dateBlockTiming({ startsAt, duration: minutes }, dateRange);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(start);
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days - 1), minutes));
      });

      it('should create a timing that starts at the input start time and last 4 days using a Range (next day)', () => {
        const days = 4;
        const start = roundDownToHour(addHours(startsAt, 6)); // start is 6 hours after startAt
        const dateRange: DateRange = { start: start, end: endOfDay(addDays(start, days)) };
        const result = dateBlockTiming({ startsAt, duration: minutes }, dateRange);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(start);
        expect(result.startsAt).toBeSameMinuteAs(addDays(startsAt, 1));
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days), minutes));
      });
    });

    describe('DateRangeInput', () => {
      it('should create a timing for a specific time that last 5 days using a DateRangeDayDistanceInput', () => {
        const dateRangeInput: DateRangeInput = { date: startOfDay(startsAt), distance: days };
        const result = dateBlockTiming({ startsAt, duration: minutes }, dateRangeInput);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days - 1), minutes));
      });
    });
  });

  describe('scenarios', () => {
    describe('Jan 2nd 2022', () => {
      const duration = 60;
      const startsAt = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday
      const endsAtDate = addDays(startsAt, 6); // Saturday
      const expectedEndsAt = addMinutes(endsAtDate, duration);

      it('should generate the correct timing when inputting the number of days.', () => {
        const weekTiming = dateBlockTiming({ startsAt, duration }, 7); // Sunday-Saturday

        expect(weekTiming.start).toBeSameSecondAs(startsAt); // also the start of the day
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
      });

      it('should generate the correct timing when inputting the range of days.', () => {
        const weekTiming = dateBlockTiming({ startsAt, duration }, { start: startsAt, end: endsAtDate }); // Sunday-Saturday

        expect(weekTiming.start).toBeSameSecondAs(startsAt); // also the start of the day
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
      });

      it('should generate the correct timing when inputting the range of days.', () => {
        const weekTiming = dateBlockTiming({ startsAt, duration }, { distance: 7 }); // Sunday-Saturday

        expect(weekTiming.start).toBeSameSecondAs(startsAt); // also the start of the day
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
      });
    });

    describe('Sun Nov 6, 5:04PM', () => {
      it('should generate the correct timing for a single day.', () => {
        const now = systemNormalDateToBaseDate(new Date('2022-11-06T17:04:41.134Z')); // Sunday, Nov 6th, 5:04PM
        const expectedStartsAt = roundDownToMinute(now);
        const expectedEnd = addMinutes(expectedStartsAt, 60);

        const duration = 60;
        const weekTiming = dateBlockTiming({ startsAt: now, duration }, 1);

        expect(weekTiming.start).toBeSameSecondAs(startOfDay(now));
        expect(weekTiming.startsAt).toBeSameSecondAs(expectedStartsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEnd);
        expect(weekTiming.duration).toBe(60);
      });
    });
  });
});

describe('isValidDateBlockTiming()', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
  const validTiming = dateBlockTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);

  it('should return true if a valid timing is input.', () => {
    const validTiming = dateBlockTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);
    const isValid = isValidDateBlockTiming(validTiming);
    expect(isValid).toBe(true);
  });

  it('should return false if the starts time has seconds.', () => {
    const invalidTiming: DateBlockTiming = { ...validTiming, start: addSeconds(validTiming.start, 10) };
    const isValid = isValidDateBlockTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the starts time has milliseconds.', () => {
    const invalidTiming: DateBlockTiming = { ...validTiming, start: addMilliseconds(validTiming.start, 10) };
    const isValid = isValidDateBlockTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the startsAt time is before the start time.', () => {
    const start = addHours(startOfDay(startsAt), 2);
    const isValid = isValidDateBlockTiming({ startsAt: addMinutes(start, -10), start, end: endOfDay(start), duration: 10 });
    expect(isValid).toBe(false);
  });

  it('should return false if the startsAt time is more than 24 hours after the start time.', () => {
    const invalidTiming: DateBlockTiming = { ...validTiming, startsAt: addMilliseconds(validTiming.start, MS_IN_DAY + 1) };
    const isValid = isValidDateBlockTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the end is not the expected end time.', () => {
    const invalidTiming: DateBlockTiming = { ...validTiming, end: addMinutes(validTiming.end, 1), duration: validTiming.duration };
    const isValid = isValidDateBlockTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the duration time is greater than 24 hours.', () => {
    const invalidTiming: DateBlockTiming = { ...validTiming, duration: MINUTES_IN_DAY + 1 };
    const isValid = isValidDateBlockTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  describe('scenario', () => {
    describe('daylight savings changes', () => {
      /**
       * Illustrates the effects of daylight savings changes
       */
      it('should return true for a timing generated via dateBlockTiming() for 2023-03-01T14:00:00.000Z with 15 days', () => {
        const startsAt = new Date('2023-03-01T14:00:00.000Z');
        const days = 15; // difference of 15 day causes an issue
        const duration = 600;
        const timing = dateBlockTiming({ startsAt, duration }, days);

        const isValid = isValidDateBlockTiming(timing);
        expect(isValid).toBe(true);
      });

      it('should return true for a timing generated via dateBlockTiming() for 2022-11-01T14:00:00.000Z with 15 days', () => {
        const startsAt = new Date('2022-11-01T14:00:00.000Z');
        const days = 15; // difference of 15 day causes an issue
        const duration = 600;
        const timing = dateBlockTiming({ startsAt, duration }, days);

        const isValid = isValidDateBlockTiming(timing);
        expect(isValid).toBe(true);
      });
    });
  });
});

describe('dateBlockDayOfWeekFactory()', () => {
  describe('function', () => {
    describe('from sunday', () => {
      const factoryFromSunday = dateBlockDayOfWeekFactory(Day.SUNDAY);

      it('should return the proper day of the week.', () => {
        range(Day.SUNDAY, Day.SATURDAY).map((i: DateBlockIndex) => {
          const result = factoryFromSunday(i);
          expect(result).toBe(i);
        });
      });

      it('should wrap around week.', () => {
        range(Day.SUNDAY, Day.SATURDAY).map((i: DateBlockIndex) => {
          const result = factoryFromSunday(i + 7); // add a full week to the index.
          expect(result).toBe(i);
        });
      });
    });

    describe('from saturday', () => {
      const factoryFromSaturday = dateBlockDayOfWeekFactory(Day.SATURDAY);

      it('should return the day of the week for the input index.', () => {
        expect(factoryFromSaturday(0)).toBe(Day.SATURDAY);
        expect(factoryFromSaturday(1)).toBe(Day.SUNDAY);
        expect(factoryFromSaturday(2)).toBe(Day.MONDAY);
        expect(factoryFromSaturday(3)).toBe(Day.TUESDAY);
        expect(factoryFromSaturday(4)).toBe(Day.WEDNESDAY);
      });
    });
  });
});

/**
 * A DateBlock with a string value.
 */
interface DataDateBlock extends DateBlock {
  value: string;
}

interface DataDateBlockRange extends DateBlockRangeWithRange {
  value: string;
}

describe('dateBlocksExpansionFactory()', () => {
  describe('function', () => {
    function makeBlocks(input: RangeInput) {
      return range(input).map((i) => ({ i, value: `${i}` }));
    }

    const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
    const days = 5;
    const duration = 60;

    const timing = dateBlockTiming({ startsAt, duration }, days);
    const factory = dateBlocksExpansionFactory<DataDateBlock | DataDateBlockRange>({ timing });
    const blocks: DataDateBlock[] = makeBlocks(days);
    const blocksAsRange: DataDateBlockRange = { i: 0, to: days - 1, value: 'a' };

    it('should generate the timings for the input date blocks.', () => {
      const result = factory(blocks);
      expect(result.length).toBe(days);
    });

    it('should filter out block indexes that fall outside the range.', () => {
      const offset = 3;
      const expectedResultCount = days - offset;
      const blocks = makeBlocks({ start: offset, end: 8 });

      const result = factory(blocks);
      expect(result.length).toBe(expectedResultCount);

      const indexes = result.map((x) => x.i);
      expect(indexes).not.toContain(0);
      expect(indexes).not.toContain(1);
      expect(indexes).not.toContain(2);
      expect(indexes).not.toContain(5);
      expect(indexes).not.toContain(6);
      expect(indexes).not.toContain(7);
      expect(indexes).not.toContain(8);
    });

    describe('with DateBlockRange input', () => {
      it('should generate the timings for the input date blocks.', () => {
        const result = factory([blocksAsRange]);
        expect(result.length).toBe(days);
      });

      it('should filter out block indexes that fall outside the range.', () => {
        const offset = 3;
        const expectedResultCount = days - offset;
        const blocksRange = { i: offset, to: days - 1, value: 'a' };

        const result = factory([blocksRange]);
        expect(result.length).toBe(expectedResultCount);

        const indexes = result.map((x) => x.i);
        expect(indexes).not.toContain(0);
        expect(indexes).not.toContain(1);
        expect(indexes).not.toContain(2);
        expect(indexes).not.toContain(5);
        expect(indexes).not.toContain(6);
        expect(indexes).not.toContain(7);
        expect(indexes).not.toContain(8);
      });
    });

    describe('with durationSpanFilter', () => {
      describe('filter checks the future', () => {
        const pastDays = 2;

        const now = addDays(startsAt, pastDays);
        const factory = dateBlocksExpansionFactory({ timing, durationSpanFilter: dateBlockDurationSpanHasNotEndedFilterFunction(now) });

        it('should filter out spans that have not ended.', () => {
          const result = factory(blocks);
          expect(result.length).toBe(days - pastDays);
        });
      });
    });

    describe('with maxDateBlocksToReturn', () => {
      const maxDateBlocksToReturn = 1;
      const factory = dateBlocksExpansionFactory({ timing, maxDateBlocksToReturn });

      it('should generate up to the maximum number of blocks to return.', () => {
        const result = factory(blocks);
        expect(result.length).toBe(maxDateBlocksToReturn);
      });
    });

    describe('with rangeLimit', () => {
      describe('rangeLimit=duration', () => {
        const daysLimit = 3;
        const factory = dateBlocksExpansionFactory({ timing, rangeLimit: daysLimit });

        it('should limit the index range to the first 3 days', () => {
          const offset = 1;
          const expectedResultCount = daysLimit - offset;
          const blocks = makeBlocks({ start: offset, end: 5 });

          const result = factory(blocks);
          expect(result.length).toBe(expectedResultCount);

          const indexes = result.map((x) => x.i);
          expect(indexes).not.toContain(0);
          expect(indexes).toContain(1);
          expect(indexes).toContain(2);
        });

        describe('with DateBlockRange input', () => {
          it('should limit the index range to the first 3 days', () => {
            const offset = 1;
            const expectedResultCount = daysLimit - offset;
            const blocksRange = { i: offset, to: 5, value: 'a' };

            const result = factory([blocksRange]);
            expect(result.length).toBe(expectedResultCount);

            const indexes = result.map((x) => x.i);
            expect(indexes).not.toContain(0);
            expect(indexes).toContain(1);
            expect(indexes).toContain(2);
          });
        });
      });

      describe('rangeLimit=range', () => {
        const factory = dateBlocksExpansionFactory({ timing, rangeLimit: { start: addDays(timing.start, 1), end: addDays(timing.end, -1) } });

        it('should limit the index range to the first 3 days', () => {
          const expectedResultCount = 3;

          const result = factory(blocks);
          expect(result.length).toBe(expectedResultCount);

          const indexes = result.map((x) => x.i);
          expect(indexes).not.toContain(0);
          expect(indexes).toContain(1);
          expect(indexes).toContain(2);
          expect(indexes).toContain(3);
          expect(indexes).not.toContain(4);
        });
      });

      describe('rangeLimit=DateRangeDayDistanceInput', () => {
        const factory = dateBlocksExpansionFactory({ timing, rangeLimit: { distance: 3 } });

        it('should limit the index range to the first 3 days', () => {
          const expectedResultCount = 3;

          const result = factory(blocks);
          expect(result.length).toBe(expectedResultCount);

          const indexes = result.map((x) => x.i);
          expect(indexes).toContain(0);
          expect(indexes).toContain(1);
          expect(indexes).toContain(2);
          expect(indexes).not.toContain(3);
          expect(indexes).not.toContain(4);
        });
      });

      describe('with rangeLimit=false', () => {
        const factory = dateBlocksExpansionFactory({ timing, rangeLimit: false });

        it('should generate a span for all blocks', () => {
          const offset = 3;
          const end = 8;
          const expectedResultCount = end - offset;
          const blocks = makeBlocks({ start: offset, end });

          const result = factory(blocks);
          expect(result.length).toBe(expectedResultCount);

          const indexes = result.map((x) => x.i);
          expect(indexes).not.toContain(0);
          expect(indexes).not.toContain(1);
          expect(indexes).not.toContain(2);
          expect(indexes).toContain(3);
          expect(indexes).toContain(4);
          expect(indexes).toContain(5);
          expect(indexes).toContain(6);
          expect(indexes).toContain(7);
        });
      });
    });
  });
});

describe('dateBlocksDayTimingInfoFactory()', () => {
  const start = startOfDay(new Date());
  const startsAt = addHours(start, 12); // Noon on the day
  const days = 5;
  const duration = 60;
  const timing = dateBlockTiming({ startsAt, duration }, days);
  const factory = dateBlockDayTimingInfoFactory({ timing });

  it('should calculate the day info when provided a day index.', () => {
    const result = factory(0);
    const isInProgress = isDateInDateRange(result.now, { start: result.startsAtOnDay, end: result.endsAtOnDay });

    expect(result.date).toBeSameMinuteAs(copyHoursAndMinutesFromDate(start, new Date()));
    expect(result.dayIndex).toBe(0);
    expect(result.isInProgress).toBe(isInProgress);

    // has already occured in some timezones (e.g. Asia/Tokyo)
    const expectedHasOccuredToday = !isBefore(result.now, result.endsAtOnDay);
    expect(result.hasOccuredToday).toBe(expectedHasOccuredToday);

    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(isInProgress || expectedHasOccuredToday ? 0 : -1);
    expect(result.nextIndex).toBe(isInProgress || expectedHasOccuredToday ? 1 : 0);
  });

  it('should calculate the day info for before occurrence for today', () => {
    const result = factory(start);
    expect(result.dayIndex).toBe(0);
    expect(result.isInProgress).toBe(false);
    expect(result.hasOccuredToday).toBe(false);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(-1);
    expect(result.nextIndex).toBe(0);
  });

  it('should calculate the day info for the startsAt time (is occurring)', () => {
    const result = factory(startsAt);
    expect(result.dayIndex).toBe(0);
    expect(result.isInProgress).toBe(true);
    expect(result.hasOccuredToday).toBe(false);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(0);
    expect(result.nextIndex).toBe(1);
  });

  it('should calculate the day info for after occurrence for today', () => {
    const result = factory(addMinutes(startsAt, duration * 2));
    expect(result.dayIndex).toBe(0);
    expect(result.isInProgress).toBe(false);
    expect(result.hasOccuredToday).toBe(true);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(0);
    expect(result.nextIndex).toBe(1);
  });

  it('should calculate the day info for tomorrow at the startsAt time (is occurring)', () => {
    const result = factory(addDays(startsAt, 1));
    expect(result.dayIndex).toBe(1);
    expect(result.isInProgress).toBe(true);
    expect(result.hasOccuredToday).toBe(false);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(1);
    expect(result.nextIndex).toBe(2);
  });

  it('should calculate the day info for after occurrence for tomorrow', () => {
    const result = factory(addMinutes(addDays(startsAt, 1), duration * 2));
    expect(result.dayIndex).toBe(1);
    expect(result.isInProgress).toBe(false);
    expect(result.hasOccuredToday).toBe(true);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(1);
    expect(result.nextIndex).toBe(2);
  });

  describe('scenarios', () => {
    describe('only weekends', () => {
      const startsAt = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday
      const weekTiming = dateBlockTiming({ startsAt, duration: 60 }, 7); // Sunday-Saturday
      const nextDate = systemNormalDateToBaseDate(new Date('2022-01-08T00:00:00.000Z'));
      const factory = dateBlockDayTimingInfoFactory({ timing: weekTiming });

      it('should return the correct current index.', () => {
        const now = startsAt;
        const result = factory(nextDate, now);

        expect(result.currentIndex).toBe(5);
        expect(result.isInProgress).toBe(false); // passed now as startsAt, which is a few days before the passed nextDate's start time.
        expect(result.nextIndex).toBe(6);
        expect(result.isComplete).toBe(false);
      });

      it('should return isComplete=true after the final event has occured.', () => {
        const now = nextDate;
        const result = factory(nextDate, addMinutes(now, duration + 5));

        expect(result.nextIndex).toBe(7); // does not exist in the timing
        expect(result.nextIndexInRange).toBe(undefined); // not defined
        expect(result.isInProgress).toBe(false); // finished for the day
        expect(result.isComplete).toBe(true);
      });

      it('should return isComplete=false if before the final event has occured..', () => {
        const now = nextDate;
        const result = factory(nextDate, now);

        expect(result.isComplete).toBe(false);
      });

      it('should return isComplete=false if before the first event has occured.', () => {
        const now = addDays(startsAt, -1);
        const result = factory(now, now);

        expect(result.dayIndex).toBe(-1);
        expect(result.nextIndexInRange).toBe(0);
        expect(result.isComplete).toBe(false);
      });
    });
  });
});

describe('groupToDateBlockRanges()', () => {
  it('should group the input blocks that overlap eachother.', () => {
    const input = [dateBlockRange(0, 4), dateBlockRange(0, 4), dateBlockRange(0, 4), dateBlockRange(0, 4)];
    const result = groupToDateBlockRanges(input);

    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(4);
  });

  it('should group the input blocks that are contiguous but do not overlap.', () => {
    const input = [dateBlockRange(0, 1), dateBlockRange(2, 3), dateBlockRange(4, 5), dateBlockRange(6, 7)];
    const result = groupToDateBlockRanges(input);

    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(7);
  });

  it('should group the input blocks that are contiguous and overlap.', () => {
    const input = [dateBlockRange(0, 5), dateBlockRange(2, 3), dateBlockRange(4, 7), dateBlockRange(4, 9)];
    const result = groupToDateBlockRanges(input);

    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(9);
  });

  it('should only group the input blocks that are contiguous or overlap.', () => {
    const input = [dateBlockRange(0, 2), dateBlockRange(4, 7), dateBlockRange(9, 12)];
    const result = groupToDateBlockRanges(input);

    expect(result.length).toBe(3);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(2);

    expect(result[1].i).toBe(4);
    expect(result[1].to).toBe(7);

    expect(result[2].i).toBe(9);
    expect(result[2].to).toBe(12);
  });
});

describe('allIndexesInDateBlockRanges()', () => {
  it('should return the indexes from all input DateBlockRange values', () => {
    const a = { i: 0 };
    const b = { i: 1, to: 2 };

    const result = allIndexesInDateBlockRanges([a, b]);

    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('should return the indexes from all input DateBlockIndex values', () => {
    const result = allIndexesInDateBlockRanges([0, 1, 2]);

    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('should return the indexes from a mix of DateBlockRange values and index values', () => {
    const a = 0;
    const b = { i: 1, to: 2 };
    const result = allIndexesInDateBlockRanges([a, b]);

    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });
});

describe('dateBlockRangeBlocksCountInfo()', () => {
  it('should return the correct calculations for DateBlock at index 100.', () => {
    const { count, total, average } = dateBlockRangeBlocksCountInfo({ i: 100 });
    expect(count).toBe(1);
    expect(total).toBe(100);
    expect(average).toBe(100);
  });

  it('should return the correct calculations for a DateBlockRange.', () => {
    const { count, total, average } = dateBlockRangeBlocksCountInfo({ i: 51, to: 100 });
    expect(count).toBe(50); // 50 blocks
    expect(total).toBe(3775);
    expect(average).toBe(75.5);
  });
});

describe('dateBlockRangeBlocksCount()', () => {
  it('should return 1 for a DateBlock.', () => {
    const count = dateBlockRangeBlocksCount({ i: 100 });
    expect(count).toBe(1);
  });

  it('should return 2 for two DateBlocks.', () => {
    const count = dateBlockRangeBlocksCount([{ i: 100 }, { i: 101 }]);
    expect(count).toBe(2);
  });

  it('should return 1 for two DateBlocks that have the same value.', () => {
    const count = dateBlockRangeBlocksCount([{ i: 100 }, { i: 100 }]);
    expect(count).toBe(1);
  });

  it('should return 10 for a DateBlockRange.', () => {
    const count = dateBlockRangeBlocksCount({ i: 5, to: 15 });
    expect(count).toBe(11); // 11 blocks
  });

  it('should return the sum of two unique DateBlockRanges.', () => {
    const count = dateBlockRangeBlocksCount([
      { i: 5, to: 15 }, // 11 blocks
      { i: 25, to: 35 } // 11 blocks
    ]);
    expect(count).toBe(22);
  });

  it('should return the unique blocks for DateBlockRanges.', () => {
    const count = dateBlockRangeBlocksCount([
      { i: 5, to: 10 }, // 6 blocks
      { i: 5, to: 15 } // 11 blocks
    ]);
    expect(count).toBe(11);
  });
});

describe('dateBlockRangesFullyCoverDateBlockRangeFunction()', () => {
  describe('function', () => {
    describe('single range', () => {
      const range = dateBlockRange(5, 10);
      const fn = dateBlockRangesFullyCoverDateBlockRangeFunction(range);

      it('should return true for the same range.', () => {
        const result = fn(range);
        expect(result).toBe(true);
      });

      it('should return true for a range that is smaller and fully covered', () => {
        const result = fn(dateBlockRange(5, 6));
        expect(result).toBe(true);
      });

      it('should return false for a range that is larger and not fully covered.', () => {
        const result = fn(dateBlockRange(2, 12));
        expect(result).toBe(false);
      });

      it('should return false for a range that is smaller and not fully covered', () => {
        const result = fn(dateBlockRange(1, 4));
        expect(result).toBe(false);
      });
    });

    describe('split range', () => {
      const rangeA = dateBlockRange(1, 3);
      const rangeB = dateBlockRange(5, 8);
      const fn = dateBlockRangesFullyCoverDateBlockRangeFunction([rangeA, rangeB]);

      it('should return true for rangeA.', () => {
        const result = fn(rangeA);
        expect(result).toBe(true);
      });

      it('should return true for rangeB.', () => {
        const result = fn(rangeB);
        expect(result).toBe(true);
      });

      it('should return false for a range that is larger and not fully covered.', () => {
        const result = fn(dateBlockRange(1, 12));
        expect(result).toBe(false);
      });
    });

    describe('merged range', () => {
      const rangeA = dateBlockRange(2, 4);
      const rangeB = dateBlockRange(5, 10);
      const fn = dateBlockRangesFullyCoverDateBlockRangeFunction([rangeA, rangeB]);

      it('should return true for rangeA.', () => {
        const result = fn(rangeA);
        expect(result).toBe(true);
      });

      it('should return true for rangeB.', () => {
        const result = fn(rangeB);
        expect(result).toBe(true);
      });

      it('should return false for a range that is larger and not fully covered.', () => {
        const result = fn(dateBlockRange(0, 12));
        expect(result).toBe(false);
      });

      it('should return false for a range that is smaller and not fully covered', () => {
        const result = fn(dateBlockRange(1, 3));
        expect(result).toBe(false);
      });

      it('should return false for a range that is not fully covered', () => {
        const result = fn(dateBlockRange(10, 12));
        expect(result).toBe(false);
      });
    });
  });
});

describe('expandDateBlockRange', () => {
  it('should copy the input block and spread it over a range.', () => {
    const lastIndex = 5;
    const blocksRange = { i: 0, to: 5, value: 'a' };

    const result = expandDateBlockRange(blocksRange);
    expect(result.length).toBe(lastIndex + 1);
    result.forEach((x, i) => {
      expect(x.i).toBe(i);
      expect(x.value).toBe(blocksRange.value);
    });
  });
});

describe('dateBlockIndexRange()', () => {
  const days = 5;
  const start = systemNormalDateToBaseDate(new Date(0)); // 1970-01-01 UTC start of day

  const duration = 60;
  const timing = dateBlockTiming({ startsAt: start, duration }, days);
  const end = timing.end;

  it('should generate the dateBlockIndexRange for a given date.', () => {
    const result = dateBlockIndexRange(timing);
    expect(result.minIndex).toBe(0);
    expect(result.maxIndex).toBe(days);
  });

  it('should return the expected IndexRange for a single day', () => {
    const days = 1;
    const timing = dateBlockTiming({ startsAt: start, duration }, days);
    const result = dateBlockIndexRange(timing);

    expect(result.minIndex).toBe(0);
    expect(result.maxIndex).toBe(days);
  });

  describe('with limit', () => {
    it('should return the expected range if the limit is the same as the range', () => {
      const days = 1;
      const timing = dateBlockTiming({ startsAt: start, duration }, days);

      const limit = {
        start: timing.start,
        end: timing.end
      };

      const result = dateBlockIndexRange(timing, limit);

      expect(result.minIndex).toBe(0);
      expect(result.maxIndex).toBe(days);
    });

    /*
    it('should return a zero range if the end is the same time as the start in limit', () => {
      const days = 1;
      const timing = dateBlockTiming({ startsAt: start, duration }, days);

      const limit = {
        start: timing.start,
        end: timing.start
      };

      const result = dateBlockIndexRange(timing, limit);
  
      expect(result.minIndex).toBe(0);
      expect(result.maxIndex).toBe(0);
    });
    */

    it('should limit a two day timing to a single day', () => {
      const days = 2;
      const timing = dateBlockTiming({ startsAt: start, duration }, days);

      const limit = {
        start: timing.start,
        end: addDays(timing.end, -1) // limit 1 day less
      };

      const result = dateBlockIndexRange(timing, limit);

      expect(result.minIndex).toBe(0);
      expect(result.maxIndex).toBe(days - 1); // expects 1 day
    });

    it('should generate the dateBlockIndexRange for one day in the future (1,5).', () => {
      const limit = {
        start: addHours(start, 24),
        end: end
      };

      const result = dateBlockIndexRange(timing, limit);
      expect(result.minIndex).toBe(1);
      expect(result.maxIndex).toBe(days);
    });

    describe('fitToTimingRange=false', () => {
      it('should generate the dateBlockIndexRange for the limit.', () => {
        const daysPastEnd = 2;

        const limit = {
          start: addHours(start, 24),
          end: addDays(end, daysPastEnd)
        };

        const result = dateBlockIndexRange(timing, limit, false);
        expect(result.minIndex).toBe(1);
        expect(result.maxIndex).toBe(days + daysPastEnd);
      });
    });
  });
});

describe('dateBlocksInDateBlockRange()', () => {
  it('should filter values that are within the range.', () => {
    const range = { i: 0, to: 5 };
    const input = [{ i: 0 }, { i: 1 }, { i: 2 }];

    const result = dateBlocksInDateBlockRange(input, range);
    expect(result.length).toBe(input.length);
  });

  it('should filter DateBlockRange values that are entirely within the range.', () => {
    const range = { i: 0, to: 5 };
    const input = [dateBlockRange(0, 5), dateBlockRange(2, 4)];

    const result = dateBlocksInDateBlockRange(input, range);
    expect(result.length).toBe(input.length);
  });

  it('should filter out values that are outside the range.', () => {
    const range = { i: 0, to: 5 };
    const input = [{ i: 6 }, { i: 7 }, { i: 8 }];

    const result = dateBlocksInDateBlockRange(input, range);
    expect(result.length).toBe(0);
  });

  it('should filter out DateBlockRange values that are only partially within the range.', () => {
    const range = { i: 0, to: 5 };
    const input = dateBlockRange(0, 10);

    const result = dateBlocksInDateBlockRange([input], range);
    expect(result.length).toBe(0);
  });
});

describe('isDateBlockWithinDateBlockRangeFunction()', () => {
  describe('function', () => {
    describe('range 0-0', () => {
      const fn = isDateBlockWithinDateBlockRangeFunction({ i: 0, to: 0 });

      it('should return false for the range 0-1000', () => {
        const result = fn({ i: 0, to: 1000 });
        expect(result).toBe(false);
      });

      it('should return true for the range 0-0', () => {
        const result = fn({ i: 0, to: 0 });
        expect(result).toBe(true);
      });
    });
  });
});

describe('dateBlockRangeIncludedByRangeFunction()', () => {
  describe('function', () => {
    const range = dateBlockRange(5, 10);
    const fn = dateBlockRangeIncludedByRangeFunction(range);

    it('should return true for the same range.', () => {
      const result = fn(range);
      expect(result).toBe(true);
    });

    it('should return true for a range that is larger and includes the full range.', () => {
      const result = fn(dateBlockRange(2, 12));
      expect(result).toBe(true);
    });

    it('should return false for a range that is smaller and does not include the full range.', () => {
      const result = fn(dateBlockRange(1, 4));
      expect(result).toBe(false);
    });

    it('should return false for a range that is partial and does not include the full range.', () => {
      const result = fn(dateBlockRange(5, 8));
      expect(result).toBe(false);
    });

    it('should return false for a range that is partial and bigger and does not include the full range.', () => {
      const result = fn(dateBlockRange(6, 12));
      expect(result).toBe(false);
    });
  });
});

interface UniqueDataDateBlock extends UniqueDateBlockRange {
  value: string;
}

function block(i: number, to?: number, id?: string | undefined) {
  return blockForIdFactory(id)(i, to);
}

function blockForIdFactory(id: string | undefined): (i: number, to?: number) => UniqueDataDateBlock {
  return (i: number, to?: number) => {
    return { id, i, to, value: `${i}-${to ?? i}` };
  };
}

function blocks(i: number, to: number): UniqueDataDateBlock[] {
  return range(i, to).map((x) => block(x));
}

const startAtIndex = 2;
const endAtIndex = 3;

const noBlocks: UniqueDataDateBlock[] = blocks(0, 0);
const contiguousBlocks: UniqueDataDateBlock[] = blocks(0, 5);
const blocksWithMiddleGap: UniqueDataDateBlock[] = [block(0, 1), block(4, 5)];
const blocksWithStartGap: UniqueDataDateBlock[] = [block(startAtIndex + 1, 5)];
const blocksWithEndGap: UniqueDataDateBlock[] = [block(0, endAtIndex - 1)];
const blocksBeforeStartAtIndex: UniqueDataDateBlock[] = [block(0, startAtIndex - 1)];
const blocksAfterEndAtIndex: UniqueDataDateBlock[] = [block(endAtIndex + 1, endAtIndex + 5)];
const overlappingBlocksAtSameIndex: UniqueDataDateBlock[] = [block(0, 0, 'a'), block(0, 0, 'b')];
const overlappingBlocksAtSameRange: UniqueDataDateBlock[] = [block(0, 5, 'a'), block(0, 5, 'b')];
const overlappingBlocksAtDifferentRange: UniqueDataDateBlock[] = [block(0, 3, 'a'), block(2, 5, 'b')];
const overlappingBlocksFirstEclipseSecond: UniqueDataDateBlock[] = [block(0, 3, 'a'), block(2, 3, 'b')];

const manyOverlappingBlocksAtSameIndex: UniqueDataDateBlock[] = [block(0, 0, 'a'), block(0, 0, 'b'), block(0, 0, 'c'), block(0, 0, 'd')];
const manyOverlappingBlocksAtSameRange: UniqueDataDateBlock[] = [block(0, 5, 'a'), block(0, 5, 'b'), block(0, 5, 'c'), block(0, 5, 'd')];

describe('groupUniqueDateBlocks()', () => {
  it('should return the blocks sorted by index', () => {
    const result = groupUniqueDateBlocks(contiguousBlocks);
    expect(result.i).toBe(0);
    expect(result.to).toBe(4);

    contiguousBlocks.forEach((x, i) => expect(result.blocks[i].value).toBe(x.value));
  });
});

describe('expandUniqueDateBlocksFunction', () => {
  describe('function', () => {
    describe('overwrite', () => {
      describe('next', () => {
        const overwriteNextExpand = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({ retainOnOverlap: 'next', fillOption: 'extend' });

        describe('with index', () => {
          it('should use the latter value to overwrite the previous value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameIndex[0].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameIndex[1].id);
          });

          it('should use the latter value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameIndex[0].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameIndex[1].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameIndex[2].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameIndex[3].id);
          });
        });

        describe('with range', () => {
          it('should use the latter value to overwrite the previous value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameRange[0].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameRange[1].id);
          });

          it('should use the latter value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameRange[0].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameRange[1].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameRange[2].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameRange[3].id);
          });
        });

        describe('with overlapping ranges', () => {
          it('the former value should end before the start of the newer value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtDifferentRange);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtDifferentRange[0].id);
            expect(result.blocks[1].id).toBe(overlappingBlocksAtDifferentRange[1].id);
            expect(result.blocks[0].to).toBe(overlappingBlocksAtDifferentRange[1].i! - 1);
            expect(result.blocks[1].i).toBe(overlappingBlocksAtDifferentRange[1].i);
            expect(result.blocks[1].to).toBe(overlappingBlocksAtDifferentRange[1].to);
          });
        });

        describe('with first eclipsing second', () => {
          it('the former value should end before the start of the newer value', () => {
            const result = overwriteNextExpand(overlappingBlocksFirstEclipseSecond);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
            expect(result.blocks[1].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
            expect(result.blocks[0].to).toBe(overlappingBlocksFirstEclipseSecond[1].i! - 1);
            expect(result.blocks[1].i).toBe(overlappingBlocksFirstEclipseSecond[1].i);
            expect(result.blocks[1].to).toBe(overlappingBlocksFirstEclipseSecond[1].to);
          });

          describe('with endAtIndex', () => {
            const endAtIndex = 1; // use endAtIndex=1 for these tests
            const overwriteNextWithEndIndexExpand = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({
              //
              endAtIndex,
              retainOnOverlap: 'next',
              fillOption: 'extend'
            });

            it('the former value should only exist', () => {
              const result = overwriteNextWithEndIndexExpand(overlappingBlocksFirstEclipseSecond);

              expect(result.blocks.length).toBe(1);
              expect(result.discarded.length).toBe(1);
              expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
              expect(result.discarded[0].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
              expect(result.blocks[0].i).toBe(overlappingBlocksFirstEclipseSecond[0].i);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });

        describe('with larger first followed by smaller', () => {
          it('should start with the new value and end with the former value.', () => {
            const blocks = [
              { i: 0, to: 5, value: 'a' },
              { i: 0, value: 'b' }
            ];
            const result = overwriteNextExpand(blocks);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].value).toBe(blocks[1].value);
            expect(result.blocks[1].value).toBe(blocks[0].value);
            expect(result.blocks[0].i).toBe(blocks[1].i);
            expect(result.blocks[0].to).toBe(blocks[1].to ?? 0);
            expect(result.blocks[1].i).toBe(blocks[1].i + 1);
            expect(result.blocks[1].to).toBe(blocks[0].to);
          });
        });
      });

      describe('current', () => {
        const overwriteNextExpand = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({ retainOnOverlap: 'current', fillOption: 'extend' });

        describe('with index', () => {
          it('should use the former value and ignore the latter value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameIndex[1].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameIndex[0].id);
          });

          it('should use the former value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameIndex[1].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameIndex[2].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameIndex[3].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameIndex[0].id);
          });
        });

        describe('with range', () => {
          it('should use the former value and ignore the latter value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameRange[1].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameRange[0].id);
          });

          it('should use the former value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameRange[1].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameRange[2].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameRange[3].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameRange[0].id);
          });
        });

        describe('with overlapping range', () => {
          it('the newer value should start after the end of the older value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtDifferentRange);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtDifferentRange[0].id);
            expect(result.blocks[1].id).toBe(overlappingBlocksAtDifferentRange[1].id);
            expect(result.blocks[0].i).toBe(overlappingBlocksAtDifferentRange[0].i);
            expect(result.blocks[0].to).toBe(overlappingBlocksAtDifferentRange[0].to);
            expect(result.blocks[1].i).toBe(overlappingBlocksAtDifferentRange[0].to! + 1);
            expect(result.blocks[1].to).toBe(overlappingBlocksAtDifferentRange[1].to);
          });
        });

        describe('with first eclipsing second', () => {
          it('the former value should eclipse the second', () => {
            const result = overwriteNextExpand(overlappingBlocksFirstEclipseSecond);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
            expect(result.discarded[0].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
            expect(result.blocks[0].i).toBe(overlappingBlocksFirstEclipseSecond[0].i);
            expect(result.blocks[0].to).toBe(overlappingBlocksFirstEclipseSecond[0].to);
          });

          describe('with endAtIndex', () => {
            const endAtIndex = 1; // use endAtIndex=1 for these tests
            const overwriteNextWithEndIndexExpand = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({ endAtIndex, retainOnOverlap: 'current', fillOption: 'extend' });

            it('the former value should only matter and eclipse the second', () => {
              const result = overwriteNextWithEndIndexExpand(overlappingBlocksFirstEclipseSecond);

              expect(result.blocks.length).toBe(1);
              expect(result.discarded.length).toBe(1);
              expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
              expect(result.discarded[0].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
              expect(result.blocks[0].i).toBe(overlappingBlocksFirstEclipseSecond[0].i);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });

        describe('with larger first followed by smaller', () => {
          it('current value should be retained.', () => {
            const blocks = [
              { i: 0, to: 5, value: 'a' },
              { i: 0, value: 'b' }
            ];
            const result = overwriteNextExpand(blocks);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].value).toBe(blocks[1].value);
            expect(result.blocks[0].value).toBe(blocks[0].value);
            expect(result.blocks[0].i).toBe(blocks[0].i);
            expect(result.blocks[0].to).toBe(blocks[0].to);
          });
        });
      });
    });

    describe('fillOption', () => {
      describe('fill', () => {
        const fillOptionExpand = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({ fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

        itShouldFail('if fillFactory is not provided.', () => {
          expectFail(() => expandUniqueDateBlocksFunction({ fillOption: 'fill' }));
        });

        it('should create a gap block for middle gaps', () => {
          const result = fillOptionExpand(blocksWithMiddleGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithMiddleGap.length + 1);
          expect(result.blocks[1].i).toBe(blocksWithMiddleGap[0].to! + 1);
          expect(result.blocks[1].to).toBe(blocksWithMiddleGap[1].i - 1);
        });

        it('should create a gap block for start gaps', () => {
          const result = fillOptionExpand(blocksWithStartGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithStartGap.length + 1);
          expect(result.blocks[0].i).toBe(0);
          expect(result.blocks[0].to).toBe(blocksWithStartGap[0].i! - 1);
          expect(result.blocks[1].i).toBe(blocksWithStartGap[0].i);
          expect(result.blocks[1].to).toBe(blocksWithStartGap[0].to);
        });

        it('should not create a gap block for end gaps', () => {
          const result = fillOptionExpand(blocksWithEndGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithEndGap.length);
        });

        it('should not create a gap block for contiguous blocks', () => {
          const result = fillOptionExpand(contiguousBlocks);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(contiguousBlocks.length);

          contiguousBlocks.forEach((x, i) => expect(result.blocks[i].value).toBe(x.value));
        });

        it('should not create a gap block for no blocks', () => {
          const result = fillOptionExpand(noBlocks);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(noBlocks.length);
        });

        describe('with endAtIndex', () => {
          const fillOptionExpandBlocksWithEndAtIndex = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({ endAtIndex, fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

          it('should create a gap block for end gaps', () => {
            const result = fillOptionExpandBlocksWithEndAtIndex(blocksWithEndGap);

            expect(result.discarded.length).toBe(0);
            expect(result.blocks.length).toBe(blocksWithEndGap.length + 1);
            expect(result.blocks[1].i).toBe(blocksWithEndGap[0].to! + 1);
            expect(result.blocks[1].to).toBe(endAtIndex);
          });

          describe('block that starts after the endAtIndex', () => {
            it('should create a gap block from 0 to endIndex range and discard the input', () => {
              const result = fillOptionExpandBlocksWithEndAtIndex(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(1);
              expect(result.blocks[0].i).toBe(0);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });

        describe('with startAtIndex and endAtIndex', () => {
          const fillOptionExpandBlocksWithStartAndEnd = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({ startAtIndex, endAtIndex, fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

          describe('block that starts after the endAtIndex', () => {
            it('should create a gap block for the startIndex to endIndex range and discard the input', () => {
              const result = fillOptionExpandBlocksWithStartAndEnd(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(1);
              expect(result.blocks[0].i).toBe(startAtIndex);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });

          describe('no blocks as input', () => {
            it('should create a gap block for the startIndex to endIndex range', () => {
              const result = fillOptionExpandBlocksWithStartAndEnd(noBlocks);

              expect(result.discarded.length).toBe(0);
              expect(result.blocks.length).toBe(1);
              expect(result.blocks[0].i).toBe(startAtIndex);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });
      });

      describe('extend', () => {
        const expandOptionExpandBlocks = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({ fillOption: 'extend' });

        it('should not extend the first block to stretch to the start', () => {
          const result = expandOptionExpandBlocks(blocksWithStartGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithStartGap.length);
          expect(result.blocks[0].i).toBe(blocksWithStartGap[0].i);
          expect(result.blocks[0].to).toBe(blocksWithStartGap[0].to);
        });

        it('should extend to fill for middle gaps', () => {
          const result = expandOptionExpandBlocks(blocksWithMiddleGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithMiddleGap.length);
          expect(result.blocks[0].i).toBe(blocksWithMiddleGap[0].i);
          expect(result.blocks[0].to).toBe(blocksWithMiddleGap[1].i - 1);
          expect(result.blocks[1].i).toBe(blocksWithMiddleGap[1].i);
          expect(result.blocks[1].to).toBe(blocksWithMiddleGap[1].to);
        });

        it('should not extend the end gap as there is no known end', () => {
          const result = expandOptionExpandBlocks(blocksWithEndGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithEndGap.length);
          expect(result.blocks[0].i).toBe(blocksWithEndGap[0].i);
          expect(result.blocks[0].to).toBe(blocksWithEndGap[0].to);
        });

        describe('with endAtIndex', () => {
          const expandOptionWithEndIndexExpandBlocks = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({ endAtIndex, fillOption: 'extend' });

          describe('block that starts after the endAtIndex', () => {
            it('should filter that block out and return nothing.', () => {
              const result = expandOptionWithEndIndexExpandBlocks(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(0);
            });
          });

          it('should expand the last value to the end block.', () => {
            const result = expandOptionWithEndIndexExpandBlocks(blocksWithEndGap);

            expect(result.discarded.length).toBe(0);
            expect(result.blocks.length).toBe(blocksWithEndGap.length);
            expect(result.blocks[0].i).toBe(blocksWithEndGap[0].i);
            expect(result.blocks[0].to).toBe(endAtIndex);
          });
        });

        describe('with startAt and endAt index', () => {
          const expandOptionWithStartAndEndIndexExpandBlocks = expandUniqueDateBlocksFunction<UniqueDataDateBlock>({ startAtIndex, endAtIndex, fillOption: 'extend' });

          describe('block that starts after the endAtIndex', () => {
            it('should filter that block out and return nothing.', () => {
              const result = expandOptionWithStartAndEndIndexExpandBlocks(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(0);
            });
          });

          describe('block that ends before the startAtIndex', () => {
            it('should filter that block out and return nothing.', () => {
              const result = expandOptionWithStartAndEndIndexExpandBlocks(blocksBeforeStartAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(0);
            });
          });

          describe('no blocks as input', () => {
            it('should return no blocks', () => {
              const result = expandOptionWithStartAndEndIndexExpandBlocks(noBlocks);

              expect(result.discarded.length).toBe(0);
              expect(result.blocks.length).toBe(0);
            });
          });
        });
      });
    });

    describe('scenarios', () => {
      it('should expand the blocks and not infinitely loop if another block comes after that has a 0-0 range.', async () => {
        const i = 0;
        const to = 2;

        const allBlocks: any[] = [
          {
            i: 0,
            to: 2
          },
          { i: 0, to: undefined }
        ];

        const requestedRangeBlocks = expandUniqueDateBlocksFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => x
        })(allBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(2);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(0);
        expect(requestedRangeBlocks.blocks[1].i).toBe(1);
        expect(requestedRangeBlocks.blocks[1].to).toBe(2);
      });

      it('should replace the current block with the next block.', async () => {
        const i = 0;
        const to = 5;

        const allBlocks = [
          {
            i: 3,
            to: 4,
            value: 'overwrite me'
          },
          { i: 4, to: 4, value: 'canceled with' }
        ];

        const requestedRangeBlocks = expandUniqueDateBlocksFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => x
        })(allBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(4);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(allBlocks[0].i - 1);
        expect(requestedRangeBlocks.blocks[1].i).toBe(allBlocks[0].i);
        expect(requestedRangeBlocks.blocks[1].to).toBe(allBlocks[0].i);
        expect(requestedRangeBlocks.blocks[2].i).toBe(allBlocks[1].i);
        expect(requestedRangeBlocks.blocks[2].to).toBe(allBlocks[1].i);
        expect(requestedRangeBlocks.blocks[3].i).toBe(5);
        expect(requestedRangeBlocks.blocks[3].to).toBe(5);
      });

      it('should replace the current block with the next block that extends before the current block.', async () => {
        const i = 0;
        const to = 5;

        const allBlocks = [
          {
            i: 3,
            to: 4,
            value: 'overwrite me'
          }
        ];

        // this one comes "next", and below will prefer it to exist.
        const nextBlocks = [{ i: 2, to: 4, value: 'canceled with' }];

        const requestedRangeBlocks = expandUniqueDateBlocksFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => x
        })(allBlocks, nextBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(3);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(nextBlocks[0].i - 1);
        expect(requestedRangeBlocks.blocks[1].i).toBe(nextBlocks[0].i);
        expect(requestedRangeBlocks.blocks[1].to).toBe(nextBlocks[0].to);
        expect(requestedRangeBlocks.blocks[2].i).toBe(5);
        expect(requestedRangeBlocks.blocks[2].to).toBe(5);
      });

      it('should replace all current blocks with the next block.', async () => {
        const i = 0;
        const to = 5;

        const currentBlocks = range(i, to + 1).map((x) => ({ i: x, to: x, value: 'replace me' }));

        // this one comes "next", and below will prefer it to exist.
        const nextBlocks = [{ i: 0, to: 5, value: 'retained next' }];

        const requestedRangeBlocks = expandUniqueDateBlocksFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => ({ ...x, value: 'a' })
        })(currentBlocks, nextBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(1);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(nextBlocks[0].to);

        currentBlocks.forEach((block, i) => {
          expect(requestedRangeBlocks.discarded[i].i).toBe(block.i);
        });
      });

      it('should retain all current blocks over the next block.', async () => {
        const i = 0;
        const to = 5;

        const currentBlocks = range(i, to + 1).map((x) => ({ i: x, to: x, value: 'retain current' }));

        // this one comes "next", and below will prefer it to exist.
        const nextBlocks = [{ i: 0, to: 5, value: 'skip me' }];

        const requestedRangeBlocks = expandUniqueDateBlocksFunction({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'current',
          fillFactory: (x) => ({ ...x, value: 'a' })
        })(currentBlocks, nextBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.discarded).toBeDefined();
        expect(requestedRangeBlocks.discarded.length).toBe(1);

        // discarded range might not be the same range that entered, but values/ids will be retained
        expect(requestedRangeBlocks.discarded[0].value).toBe(nextBlocks[0].value);

        expect(requestedRangeBlocks.blocks.length).toBe(currentBlocks.length);
        currentBlocks.forEach((block, i) => {
          expect(requestedRangeBlocks.blocks[i].i).toBe(block.i);
        });
      });

      it('should replace the next block with the current block that extends before the current block.', async () => {
        const i = 0;
        const to = 5;

        const currentBlocks = [
          {
            i: 3,
            to: 4,
            value: 'retain me'
          }
        ];

        // this one comes "next", and below will prefer it to exist.
        const nextBlocks = [{ i: 2, to: 4, value: 'overwrite empty area' }];

        const filledValue = 'filled value';

        const requestedRangeBlocks = expandUniqueDateBlocksFunction<typeof currentBlocks[0]>({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'current',
          fillFactory: (x) => ({ ...x, value: filledValue })
        })(currentBlocks, nextBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(4);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(nextBlocks[0].i - 1);
        expect(requestedRangeBlocks.blocks[0].value).toBe(filledValue);
        expect(requestedRangeBlocks.blocks[1].i).toBe(nextBlocks[0].i);
        expect(requestedRangeBlocks.blocks[1].to).toBe(nextBlocks[0].i);
        expect(requestedRangeBlocks.blocks[1].value).toBe(nextBlocks[0].value);
        expect(requestedRangeBlocks.blocks[2].i).toBe(currentBlocks[0].i);
        expect(requestedRangeBlocks.blocks[2].to).toBe(currentBlocks[0].to);
        expect(requestedRangeBlocks.blocks[2].value).toBe(currentBlocks[0].value);
        expect(requestedRangeBlocks.blocks[3].i).toBe(5);
        expect(requestedRangeBlocks.blocks[3].to).toBe(5);
        expect(requestedRangeBlocks.blocks[3].value).toBe(filledValue);
      });

      it(`should split a block and retain its attributes.`, async () => {
        const i = 0;
        const to = 5;

        const allBlocks = [
          {
            i: 0,
            to: 5,
            value: 'retain'
          }
        ];

        const cancelledBlocks = [
          {
            i: 1,
            to: 1,
            value: 'cancel'
          }
        ];

        const requestedRangeBlocks = expandUniqueDateBlocksFunction<typeof cancelledBlocks[0]>({
          startAtIndex: i,
          endAtIndex: to,
          fillOption: 'fill',
          retainOnOverlap: 'next',
          fillFactory: (x) => ({ ...x, value: 'new' })
        })(allBlocks, cancelledBlocks);

        expect(requestedRangeBlocks.blocks).toBeDefined();
        expect(requestedRangeBlocks.blocks.length).toBe(3);
        expect(requestedRangeBlocks.blocks[0].i).toBe(0);
        expect(requestedRangeBlocks.blocks[0].to).toBe(0);
        expect(requestedRangeBlocks.blocks[0].value).toBe(allBlocks[0].value);
        expect(requestedRangeBlocks.blocks[1].i).toBe(1);
        expect(requestedRangeBlocks.blocks[1].to).toBe(1);
        expect(requestedRangeBlocks.blocks[1].value).toBe(cancelledBlocks[0].value);
        expect(requestedRangeBlocks.blocks[2].i).toBe(2);
        expect(requestedRangeBlocks.blocks[2].to).toBe(to);
        expect(requestedRangeBlocks.blocks[2].value).toBe(allBlocks[0].value);
      });
    });
  });
});

describe('sortDateBlockRanges', () => {
  it('should retain the order for items that have the same start index.', () => {
    const allBlocks = [
      {
        i: 0,
        to: 2,
        id: 'a'
      },
      { i: 0, to: undefined, id: 'b' },
      { i: 0, to: 3, id: 'c' },
      { i: 0, to: 1, id: 'd' },
      { i: 0, to: 100, id: 'e' }
    ];

    const sorted = sortDateBlockRanges(allBlocks);

    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('b');
    expect(sorted[2].id).toBe('c');
    expect(sorted[3].id).toBe('d');
    expect(sorted[4].id).toBe('e');
  });

  it('should retain the before/after order for items that have the same start index.', () => {
    const allBlocks = [
      {
        i: 0,
        to: 2,
        id: 'a'
      },
      { i: 1, to: undefined, id: 'b' },
      { i: 2, to: 3, id: 'c' },
      { i: 3, to: 1, id: 'd' },
      { i: 0, to: 100, id: 'e' }
    ];

    const sorted = sortDateBlockRanges(allBlocks);

    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('e');
    expect(sorted[2].id).toBe('b');
    expect(sorted[3].id).toBe('c');
    expect(sorted[4].id).toBe('d');
  });
});

describe('modifyDateBlocksToFitRangeFunction()', () => {
  describe('function', () => {
    const range = { i: 2, to: 4 };
    const fn = modifyDateBlocksToFitRangeFunction(range);

    it('should retain the same range', () => {
      const result = fn([range]);
      expect(result[0]).toBe(range);
    });

    it('should filter out blocks that are outside the range.', () => {
      const outside = [
        { x: 'a', i: range.i - 1 },
        { x: 'c', i: range.to + 1 }
      ];
      const values = [...outside, { x: 'b', ...range }];

      const result = fn(values);
      expect(result.length).toBe(1);
    });

    it('should reduce the range of items that are larger than the range.', () => {
      const value = { x: 'a', i: range.i - 1, to: range.to + 1 };
      const result = fn([value]);

      expect(result.length).toBe(1);
      expect(result[0].x).toBe(value.x);
      expect(result[0].i).toBe(range.i);
      expect(result[0].to).toBe(range.to);
    });
  });
});

describe('modifyDateBlocksToFitRange()', () => {
  it('should fit an input range of 0-1000 within a range of 0-0', () => {
    const result = modifyDateBlocksToFitRange({ i: 0, to: 0 }, [{ i: 0, to: 1000 }]);
    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(0);
  });
});
