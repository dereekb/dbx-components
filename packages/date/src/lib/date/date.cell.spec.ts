import { parseISO8601DayStringToDate } from '@dereekb/date';
import { expectFail, itShouldFail } from '@dereekb/util/test';
import { DateRange, DateRangeInput, isDateInDateRange } from './date.range';
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, endOfDay, addSeconds, addMilliseconds, millisecondsToHours, minutesToHours, isBefore, isAfter, addBusinessDays, startOfWeek, differenceInSeconds, differenceInMilliseconds } from 'date-fns';
import {
  changeTimingToTimezoneFunction,
  DateCell,
  dateCellDayOfWeekFactory,
  DateCellIndex,
  dateCellIndexRange,
  DateCellRange,
  dateCellRange,
  dateCellRangeBlocksCount,
  dateCellRangeBlocksCountInfo,
  dateCellRangeIncludedByRangeFunction,
  dateCellRangesFullyCoverDateCellRangeFunction,
  DateCellRangeWithRange,
  dateCellDayTimingInfoFactory,
  dateCellsExpansionFactory,
  filterDateCellsInDateCellRange,
  dateCellTiming,
  DateCellTiming,
  dateCellTimingInTimezoneFunction,
  dateCellTimingRelativeIndexArrayFactory,
  dateCellTimingRelativeIndexFactory,
  expandDateCellRange,
  expandUniqueDateCellsFunction,
  getCurrentDateCellTimingOffset,
  getCurrentDateCellTimingStartDate,
  getRelativeIndexForDateCellTiming,
  groupToDateCellRanges,
  groupUniqueDateCells,
  isDateCellWithinDateCellRangeFunction,
  isValidDateCellIndex,
  isValidDateCellTiming,
  isValidDateCellTimingStartDate,
  modifyDateCellsToFitRange,
  modifyDateCellsToFitRangeFunction,
  sortDateCellRanges,
  timingIsInExpectedTimezoneFunction,
  UniqueDateCellRange,
  allIndexesInDateCellRanges,
  isValidDateCellRange,
  isValidDateCellRangeSeries,
  getGreatestDateCellIndexInDateCellRanges,
  getDateCellTimingHoursInEvent,
  getDateCellTimingFirstEventDateRange,
  dateCellTimingFromDateRangeAndEvent,
  getCurrentDateCellTimingUtcData,
  getCurrentDateCellTimingOffsetData,
  dateCellTimingStartForNowInSystemTimezone,
  timingIsInExpectedTimezone,
  dateCellRangeOverlapsRangeFunction,
  dateCellTimingInTimezone,
  dateCellTimingDateFactory,
  dateCellTimingStartsAtDateFactory,
  dateCellTimingStartDateFactory,
  timingDateTimezoneUtcNormal,
  isDateCellTimingRelativeIndexFactory,
  getLeastDateCellIndexInDateCellRanges,
  getLeastAndGreatestDateCellIndexInDateCellRanges,
  dateRelativeStateForDateCellRangeComparedToIndex,
  getNextDateCellTimingIndex,
  isSameDateCellTiming,
  safeDateCellTimingFromDateRangeAndEvent
} from './date.cell';
import { MS_IN_MINUTE, MS_IN_DAY, MINUTES_IN_DAY, range, RangeInput, Hours, Day, TimezoneString, isOddNumber, HOURS_IN_DAY, MINUTES_IN_HOUR } from '@dereekb/util';
import { copyHoursAndMinutesFromDate, guessCurrentTimezone, roundDownToHour, roundDownToMinute } from './date';
import { dateCellDurationSpanHasNotEndedFilterFunction } from './date.cell.filter';
import { dateTimezoneUtcNormal, getCurrentSystemOffsetInHours, systemBaseDateToNormalDate, systemNormalDateToBaseDate, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from './date.timezone';
import { formatToISO8601DayString, parseISO8601DayStringToUTCDate } from './date.format';
import { DateCellSchedule, expandDateCellSchedule } from './date.cell.schedule';

describe('isValidDateCellIndex()', () => {
  it('should return false for -1.', () => {
    expect(isValidDateCellIndex(-1)).toBe(false);
  });

  it('should return false for 0.5', () => {
    expect(isValidDateCellIndex(0.5)).toBe(false);
  });

  it('should return true for 0.', () => {
    expect(isValidDateCellIndex(0)).toBe(true);
  });

  it('should return true for 100.', () => {
    expect(isValidDateCellIndex(100)).toBe(true);
  });
});

describe('isSameDateCellTiming()', () => {
  const startsAt = startOfDay(new Date());
  const timing = dateCellTiming({ startsAt, duration: 60 }, 2); // 2 days

  it('should return true if the timings are the same.', () => {
    expect(isSameDateCellTiming(timing, timing)).toBe(true);
  });

  it('should return true if comparing a null and undefined value', () => {
    expect(isSameDateCellTiming(null, undefined)).toBe(true);
  });

  it('should return false if comparing a null value and a timing', () => {
    expect(isSameDateCellTiming(null, timing)).toBe(false);
  });

  it('should return false if the durations are different', () => {
    expect(isSameDateCellTiming(timing, { ...timing, duration: 30 })).toBe(false);
  });

  it('should return false if the starts are different', () => {
    expect(isSameDateCellTiming(timing, { ...timing, start: new Date() })).toBe(false);
  });

  it('should return false if the startsAt are different', () => {
    expect(isSameDateCellTiming(timing, { ...timing, startsAt: new Date() })).toBe(false);
  });
});

describe('isValidDateCellRange()', () => {
  it('should return false if to is less than i.', () => {
    expect(isValidDateCellRange({ i: 1, to: 0 })).toBe(false);
  });

  it('should return false if to is a non-integer.', () => {
    expect(isValidDateCellRange({ i: 0, to: 1.2 })).toBe(false);
  });

  it('should return false if i is negative', () => {
    expect(isValidDateCellRange({ i: -1 })).toBe(false);
  });

  it('should return false if i is a non-integer value.', () => {
    expect(isValidDateCellRange({ i: 1.2 })).toBe(false);
  });

  it('should return true if only i is provided', () => {
    expect(isValidDateCellRange({ i: 1 })).toBe(true);
  });

  it('should return true for a valid range.', () => {
    expect(isValidDateCellRange({ i: 1, to: 5 })).toBe(true);
  });
});

describe('isValidDateCellRangeSeries()', () => {
  it('should return false if one input is not a valid series.', () => {
    expect(isValidDateCellRangeSeries([{ i: 1, to: 0 }])).toBe(false);
  });

  it('should return false if one index is repeated.', () => {
    expect(
      isValidDateCellRangeSeries([
        { i: 0, to: 2 },
        { i: 2, to: 3 }
      ])
    ).toBe(false);
  });

  it('should return true for a single item series.', () => {
    expect(isValidDateCellRangeSeries([{ i: 0, to: 2 }])).toBe(true);
  });

  it('should return true for a valid series.', () => {
    expect(
      isValidDateCellRangeSeries([
        { i: 0, to: 2 },
        { i: 3, to: 5 }
      ])
    ).toBe(true);
  });
});

describe('getLeastDateCellIndexInDateCellRanges()', () => {
  it('should return 0 for empty arrays.', () => {
    const greatestIndex = 0;

    const result = getLeastDateCellIndexInDateCellRanges([]);
    expect(result).toBe(greatestIndex);
  });

  it('should return the least index in the input ranges.', () => {
    const leastIndex = 3;

    const result = getLeastDateCellIndexInDateCellRanges([{ i: leastIndex }, { i: 12, to: 23 }, { i: 40, to: 42 }, { i: 50, to: 55 }]);
    expect(result).toBe(leastIndex);
  });
});

describe('getGreatestDateCellIndexInDateCellRanges()', () => {
  it('should return 0 for empty arrays.', () => {
    const greatestIndex = 0;

    const result = getGreatestDateCellIndexInDateCellRanges([]);
    expect(result).toBe(greatestIndex);
  });

  it('should return the largest index in the input ranges.', () => {
    const greatestIndex = 100;

    const result = getGreatestDateCellIndexInDateCellRanges([{ i: 0 }, { i: 12, to: 23 }, { i: 40, to: greatestIndex }, { i: 50, to: 55 }]);
    expect(result).toBe(greatestIndex);
  });
});

describe('getLeastAndGreatestDateCellIndexInDateCellRanges()', () => {
  it('should return null for empty arrays.', () => {
    const result = getLeastAndGreatestDateCellIndexInDateCellRanges([]);
    expect(result).toBe(null);
  });
});

describe('getCurrentDateCellTimingUtcData()', () => {
  describe('Asia/Tokyo', () => {
    it('should return the expected offset.', () => {
      const expectedUTCDate = new Date('2023-08-03T00:00:00.000Z'); // 8/03/23 in UTC
      const start = new Date('2023-08-02T15:00:00.000Z'); // 8/03/23 in UTC
      const result = getCurrentDateCellTimingUtcData({ start });

      expect(result.originalUtcOffsetInHours).toBe(9);
      expect(result.originalUtcDate).toBeSameSecondAs(expectedUTCDate);
    });
  });
});

describe('getCurrentDateCellTimingOffset()', () => {
  const utcDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

  describe('system time', () => {
    it('should apply the expected offset.', () => {
      const start = new Date(2022, 0, 2); // first second of the day date with an offset equal to the current.

      const systemTimezoneOffset = start.getTimezoneOffset();
      const systemDateAsUtc = addMinutes(start, -systemTimezoneOffset); // timezone offset is inverse of UTC zones

      expect(systemDateAsUtc).toBeSameSecondAs(utcDate);

      const duration = 60;
      const timing: DateCellTiming = dateCellTiming({ startsAt: start, duration: 60 }, { start: start, end: addMinutes(start, duration) });
      const offset = getCurrentDateCellTimingOffset(timing);

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
        const timing: DateCellTiming = dateCellTiming({ startsAt: timezoneOffsetDate, duration }, { start: timezoneOffsetDate, end: addMinutes(timezoneOffsetDate, duration) });

        const offset = getCurrentDateCellTimingOffset(timing);
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

describe('dateCellTimingStartForSystemTimezone()', () => {
  it('should return the DateCellTimingStart for the system timezone.', () => {
    const result = dateCellTimingStartForNowInSystemTimezone();
    const isInSystemTimezone = timingIsInExpectedTimezone(result, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE);
    expect(isInSystemTimezone).toBe(true);
  });
});

describe('getCurrentDateCellTimingStartDate()', () => {
  const utcDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

  describe('system time', () => {
    it('should apply the expected offset.', () => {
      const start = new Date(2022, 0, 2);

      const systemTimezoneOffset = start.getTimezoneOffset();
      const systemDateAsUtc = addMinutes(start, -systemTimezoneOffset);

      expect(systemDateAsUtc).toBeSameSecondAs(utcDate);

      const timing: DateCellTiming = dateCellTiming({ startsAt: start, duration: 60 }, 2);
      const date = getCurrentDateCellTimingStartDate(timing);

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

    function describeTestsForTimezone(timezone: TimezoneString) {
      const timezoneInstance = dateTimezoneUtcNormal({ timezone });
      const start = timezoneInstance.targetDateToSystemDate(startOfDay(new Date()));

      const fn = timingIsInExpectedTimezoneFunction(timezoneInstance);

      describe(`${timezone}`, () => {
        it(`should return true if the ${timezone} timing starts in the timezone.`, () => {
          const result = fn({ start });

          expect(result).toBe(true);
        });

        it(`should return false if the timing does not start in the timezone ${timezone}.`, () => {
          const utcStart = new Date('2023-03-12T00:00:00.000Z');

          const result = fn({ start: utcStart });
          expect(result).toBe(false);
        });
      });
    }

    describeTestsForTimezone('America/Denver');
    describeTestsForTimezone('America/Los_Angeles');
    describeTestsForTimezone('America/New_York');
    describeTestsForTimezone('America/Chicago');
    describeTestsForTimezone('Asia/Tokyo');
    describeTestsForTimezone('Pacific/Fiji'); // +12
    // describeTestsForTimezone('Pacific/Auckland'); //+12 // unsupported timezone when daylight savings is active
    // describeTestsForTimezone('Pacific/Kiritimati'); //+14 // unsupported timezone
  });
});

describe('getDateCellTimingFirstEventDateRange()', () => {
  const hours = 4;
  const startsAt = startOfDay(new Date());
  const timing = dateCellTiming({ startsAt, duration: 60 * hours }, 2); // 2 days

  it('should return the hours in the timing.', () => {
    const result = getDateCellTimingFirstEventDateRange(timing);
    expect(result.start).toBeSameSecondAs(startsAt);
    expect(result.end).toBeSameSecondAs(addHours(startsAt, hours));
  });
});

describe('getDateCellTimingHoursInEvent()', () => {
  const hours = 4;
  const startsAt = startOfDay(new Date());
  const timing = dateCellTiming({ startsAt, duration: 60 * hours }, 2); // 2 days

  it('should return the hours in the timing.', () => {
    const result = getDateCellTimingHoursInEvent(timing);
    expect(result).toBe(hours);
  });

  describe('hours with fraction', () => {
    const hours = 4.5;
    const startsAt = startOfDay(new Date());
    const timing = dateCellTiming({ startsAt, duration: 60 * hours }, 2); // 2 days

    it('should return the hours in the timing.', () => {
      const result = getDateCellTimingHoursInEvent(timing);
      expect(result).toBe(hours);
    });
  });
});

describe('dateCellTimingFromDateRangeAndEvent()', () => {
  describe('function', () => {
    const startOfToday = startOfDay(new Date());
    const systemTiming = dateCellTiming({ startsAt: addHours(startOfToday, 3), duration: 60 }, 2); // 2 days

    describe('system time', () => {
      const timing = systemTiming;

      it('should return a copy of a timing.', () => {
        const result = dateCellTimingFromDateRangeAndEvent(timing, timing); // use the first event again

        expect(result.start).toBeSameSecondAs(timing.start);
        expect(result.end).toBeSameSecondAs(timing.end);
        expect(result.duration).toBe(timing.duration);
        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

        expect(isValidDateCellTiming(result)).toBe(true);
      });

      it('should return the original timing using the second event', () => {
        const result = dateCellTimingFromDateRangeAndEvent(timing, { startsAt: addDays(timing.startsAt, 1), duration: timing.duration }); // use the first event again

        expect(result.start).toBeSameSecondAs(timing.start);
        expect(result.end).toBeSameSecondAs(timing.end);
        expect(result.duration).toBe(timing.duration);
        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

        expect(isValidDateCellTiming(result)).toBe(true);
      });
    });
    // describeTestsForTimezone('Pacific/Auckland'); // unsupported timezone, daylight savings pushes it to +13
    // describeTestsForTimezone('Pacific/Kiritimati'); // unsupported timezone
  });
});

describe('safeDateCellTimingFromDateRangeAndEvent()', () => {
  describe('function', () => {
    function describeTestsForTimezone(timezone: TimezoneString) {
      const timezoneInstance = dateTimezoneUtcNormal({ timezone });
      const startOfTodayInTimezone = timezoneInstance.targetDateToSystemDate(startOfDay(new Date()));
      const startOfTodayInTimezoneB = timezoneInstance.targetDateToBaseDate(parseISO8601DayStringToUTCDate(formatToISO8601DayString()));
      const timing = dateCellTimingInTimezone({ startsAt: startOfTodayInTimezone, duration: 60 }, 1, timezone); // 1 day

      describe(`${timezone}`, () => {
        it('should return a copy of a timing.', () => {
          const result = safeDateCellTimingFromDateRangeAndEvent(timing, timing, timezoneInstance); // use the first event again

          expect(result.start).toBeSameSecondAs(timing.start);
          expect(result.end).toBeSameSecondAs(timing.end);
          expect(result.duration).toBe(timing.duration);
          expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

          expect(isValidDateCellTiming(result)).toBe(true);
        });

        it('should return the original timing using the second event', () => {
          const result = safeDateCellTimingFromDateRangeAndEvent(timing, { startsAt: addDays(timing.startsAt, 1), duration: timing.duration }, timezoneInstance); // use the first event again

          expect(result.start).toBeSameSecondAs(timing.start);
          expect(result.end).toBeSameSecondAs(timing.end);
          expect(result.duration).toBe(timing.duration);
          expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

          expect(isValidDateCellTiming(result)).toBe(true);
        });

        describe('daylight savings changes', () => {
          const daylightSavingsLastDayActive = timezoneInstance.targetDateToBaseDate(new Date('2023-11-03T00:00:00Z'));
          const timing = dateCellTimingInTimezone({ startsAt: daylightSavingsLastDayActive, duration: 60 }, 5, timezone); // 1 day

          describe('active to inactive', () => {
            it(`should return a copy of the original ${timezone} timing`, () => {
              expect(isValidDateCellTiming(timing)).toBe(true);

              const result = safeDateCellTimingFromDateRangeAndEvent(timing, timing, timezoneInstance); // use the first event again

              expect(result.start).toBeSameSecondAs(timing.start);
              expect(result.end).toBeSameSecondAs(timing.end);
              expect(result.duration).toBe(timing.duration);
              expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

              expect(isValidDateCellTiming(result)).toBe(true);
            });

            it(`should return the proper timing with new duration of the day after daylight savings goes inactive in ${timezone}`, () => {
              expect(isValidDateCellTiming(timing)).toBe(true);

              const newDuration = timing.duration + MINUTES_IN_HOUR;
              const result = safeDateCellTimingFromDateRangeAndEvent(timing, { startsAt: timing.startsAt, duration: newDuration }, timezoneInstance); // use the first event again

              expect(result.start).toBeSameSecondAs(timing.start);
              expect(result.end).toBeSameSecondAs(addHours(timing.end, 1));
              expect(result.duration).toBe(newDuration);
              expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

              expect(isValidDateCellTiming(result)).toBe(true);
            });
          });

          describe('inactive to active', () => {
            const daylightSavingsBeforeFirstDayActive = timezoneInstance.targetDateToBaseDate(new Date('2023-03-10T00:00:00Z'));
            const timing = dateCellTimingInTimezone({ startsAt: daylightSavingsBeforeFirstDayActive, duration: 60 }, 5, timezone); // 1 day

            it(`should return a copy of a timing`, () => {
              const result = safeDateCellTimingFromDateRangeAndEvent(timing, timing, timezoneInstance); // use the first event again

              expect(result.start).toBeSameSecondAs(timing.start);
              expect(result.end).toBeSameSecondAs(timing.end);
              expect(result.duration).toBe(timing.duration);
              expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

              expect(isValidDateCellTiming(result)).toBe(true);
            });
          });
        });
      });
    }

    describeTestsForTimezone('UTC');
    describeTestsForTimezone('America/Denver');
    describeTestsForTimezone('America/Los_Angeles');
    describeTestsForTimezone('America/New_York');
    describeTestsForTimezone('America/Chicago');
    describeTestsForTimezone('Pacific/Fiji');
  });
});

describe('changeTimingToTimezoneFunction()', () => {
  describe('function', () => {
    const startOfToday = startOfDay(new Date());
    const timing = dateCellTiming({ startsAt: addHours(startOfToday, 3), duration: 60 }, 2); // 2 days

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

describe('dateCellTimingInTimezoneFunction()', () => {
  describe('function', () => {
    const startOfToday = startOfDay(new Date());

    describe('UTC', () => {
      const fn = dateCellTimingInTimezoneFunction('UTC');
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

      it('should create a timing in the afteroon in the UTC timezone.', () => {
        const duration = 60;
        const startsAt = addHours(startOfToday, 12);
        const result = fn({ startsAt, duration }, 2);

        const { start } = result;
        const utcHours = start.getUTCHours();
        expect(utcHours).toBe(utcTimezoneOffsetInHours);

        expect(result.startsAt).toBeSameSecondAs(startsAt);
        expect(result.duration).toBe(duration);
      });
    });

    describe('America/Denver', () => {
      const fn = dateCellTimingInTimezoneFunction('America/Denver');

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

      it('should create a timing in the afteroon in the America/Denver timezone.', () => {
        const duration = 60;
        const startsAt = addHours(startOfToday, 12);
        const result = fn({ startsAt, duration }, 2);

        const { start } = result;
        const utcHours = start.getUTCHours();
        expect(utcHours).toBe(denverTimezoneOffsetInHours);

        expect(result.startsAt).toBeSameSecondAs(startsAt);
        expect(result.duration).toBe(duration);
      });
    });

    describe('daylight savings changes', () => {
      const daylightSavingsLastDayActiveUTC = new Date('2023-11-03T00:00:00Z');

      function describeTestsForTimezone(timezone: TimezoneString) {
        const numberOfDays = 5;
        const timezoneInstance = dateTimezoneUtcNormal({ timezone });
        const startOfTodayInTimezone = timezoneInstance.targetDateToBaseDate(daylightSavingsLastDayActiveUTC);

        // depending on whether or not the area experiences daylight savings, this time will differ from the startOfTodayInTimezone time by 1 hour
        const startOfLastDayInTimezone = timezoneInstance.targetDateToBaseDate(addHours(daylightSavingsLastDayActiveUTC, HOURS_IN_DAY * (numberOfDays - 1)));

        describe(`${timezone}`, () => {
          it('should generate a proper timing for the timezone.', () => {
            const duration = 60;
            const timing = dateCellTimingInTimezone({ startsAt: startOfTodayInTimezone, duration }, numberOfDays, timezone); // 1 day

            expect(timing.start).toBeSameSecondAs(startOfTodayInTimezone);
            expect(timing.end).toBeSameSecondAs(addMinutes(startOfLastDayInTimezone, duration));
            expect(timing.duration).toBe(duration);
            expect(timing.startsAt).toBeSameSecondAs(startOfTodayInTimezone);

            expect(isValidDateCellTiming(timing)).toBe(true);
          });
        });
      }

      describeTestsForTimezone('UTC');
      describeTestsForTimezone('America/Denver');
      describeTestsForTimezone('America/Los_Angeles');
      describeTestsForTimezone('America/New_York');
      describeTestsForTimezone('America/Chicago');
      describeTestsForTimezone('Pacific/Fiji');
    });
  });
});

describe('dateCellTimingRelativeIndexFactory()', () => {
  describe('function', () => {
    const start = startOfDay(new Date());
    const startsAt = addHours(start, 12); // Noon on the day
    const days = 5;
    const duration = 60;
    const systemTiming = dateCellTiming({ startsAt, duration }, days);

    describe('UTC', () => {
      const timezone = 'UTC';
      const timing = changeTimingToTimezoneFunction(timezone)(systemTiming);
      const fn = dateCellTimingRelativeIndexFactory(timing);

      it('should return the expected indexes for the first day relative to the UTC timezone', () => {
        const dayString = formatToISO8601DayString(start);

        const result1date = fn(startsAt); // input the system time
        const result1day = fn(dayString);

        expect(result1date).toBe(0);
        expect(result1day).toBe(0);
      });
    });

    describe('America/Denver', () => {
      const timezone = 'America/Denver';
      const timing = changeTimingToTimezoneFunction(timezone)(systemTiming);
      const fn = dateCellTimingRelativeIndexFactory(timing);

      it('should return the expected indexes for the first day relative to the Denver timezone', () => {
        const dayString = formatToISO8601DayString(start);

        const resulttimingstart = fn(timing.start);
        const result1day = fn(dayString);

        expect(resulttimingstart).toBe(0);
        expect(result1day).toBe(0);

        // only a valid timing will return this value correctly
        if (isValidDateCellTiming(timing)) {
          const result1startsAtTime = fn(timing.startsAt); // input the system time
          expect(result1startsAtTime).toBe(0);
        }
      });
    });
  });

  describe('scenarios', () => {
    describe('America/New_York timezone past days', () => {
      const timezone = 'America/New_York';
      const testDays = 17;
      const timing = {
        start: new Date('2023-08-13T04:00:00.000Z'),
        end: new Date('2023-08-30T09:00:00.000Z'),
        startsAt: new Date('2023-08-14T00:00:00.000Z'),
        duration: 540
      };

      const s: DateCellSchedule = {
        w: '89',
        ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
      };

      it('should correspond the dates to the expanded indexes', () => {
        const indexFactory = dateCellTimingRelativeIndexFactory(timing);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i, startsAt } = x;
          expect(indexFactory(startsAt)).toBe(i);
        });
      });
    });

    describe('one second before midnight', () => {
      const start = new Date('2023-03-11T06:00:00.000Z'); // timezone offset changes going into the next day.
      const oneSecondBeforeNextDay = new Date('2023-03-12T05:59:59.999Z');
      const theNextDay = new Date('2023-03-12T06:00:00.000Z');

      it('should properly round the index down.', () => {
        const factory = dateCellTimingRelativeIndexFactory({ start });
        const result = factory(oneSecondBeforeNextDay);
        expect(result).toBe(0); // should be the same day

        const nextDayResult = factory(theNextDay);
        expect(nextDayResult).toBe(1); // should be the next day
      });
    });

    describe('timezone change', () => {
      const start = new Date('2023-03-11T06:00:00.000Z'); // timezone offset changes going into the next day.
      const dstDay = new Date('2023-03-13T06:00:00.000Z'); // daylight Savings has occured for some timezones. We jump 2 days however to ensure all zones are in the next timezone where applicable.

      it('should handle daylight savings time changes and return the expected index.', () => {
        const factory = dateCellTimingRelativeIndexFactory({ start });
        const result = factory(dstDay);

        expect(formatToISO8601DayString(dstDay)).toBe('2023-03-13');
        expect(result).toBe(2); // 2 days later
      });
    });
  });
});

describe('isDateCellTimingRelativeIndexFactory()', () => {
  const timing = {
    start: new Date('2023-08-13T04:00:00.000Z'),
    end: new Date('2023-08-30T09:00:00.000Z'),
    startsAt: new Date('2023-08-14T00:00:00.000Z'),
    duration: 540
  };

  describe('function', () => {
    it('should return false for a timing', () => {
      const result = isDateCellTimingRelativeIndexFactory(timing);
      expect(result).toBe(false);
    });

    it('should return true for a dateCellTimingRelativeIndexFactory()', () => {
      const indexFactory = dateCellTimingRelativeIndexFactory(timing);
      const result = isDateCellTimingRelativeIndexFactory(indexFactory);
      expect(result).toBe(true);
    });
  });
});

describe('getNextDateCellTimingIndex()', () => {
  it('should return the expected results', () => {
    const a = { i: 2, to: 3, x: 'a' };
    const b = { i: 6, to: 8, x: 'b' };
    const c = { i: 9, to: 12, x: 'c' };
    const d = { i: 20, to: 28, x: 'd' };
    const ranges = [a, b, c, d];

    const resultA = getNextDateCellTimingIndex({ currentIndex: 0, ranges });
    expect(resultA.currentResult).toBeUndefined();
    expect(resultA.nextIndex).toBe(2);
    expect(resultA.nextResult).toBeDefined();
    expect(resultA.nextResult?.x).toBe(a.x);

    const resultB = getNextDateCellTimingIndex({ currentIndex: 6, ranges });
    expect(resultB.currentResult).toBeDefined();
    expect(resultB.currentResult?.x).toBe(b.x);
    expect(resultB.nextIndex).toBe(7);
    expect(resultB.nextResult).toBeDefined();
    expect(resultB.nextResult?.x).toBe(b.x);

    const resultC = getNextDateCellTimingIndex({ currentIndex: 8, ranges });
    expect(resultC.currentResult).toBeDefined();
    expect(resultC.currentResult?.x).toBe(b.x);
    expect(resultC.nextIndex).toBe(9);
    expect(resultC.nextResult).toBeDefined();
    expect(resultC.nextResult?.x).toBe(c.x);

    const resultD = getNextDateCellTimingIndex({ currentIndex: 12, ranges });
    expect(resultD.currentResult).toBeDefined();
    expect(resultD.currentResult?.x).toBe(c.x);
    expect(resultD.nextIndex).toBe(d.i);
    expect(resultD.nextResult).toBeDefined();
    expect(resultD.nextResult?.x).toBe(d.x);

    const resultE = getNextDateCellTimingIndex({ currentIndex: 30, ranges });
    expect(resultE.currentResult).toBeUndefined();
    expect(resultE.nextResult).toBeUndefined();
    expect(resultE.nextIndex).toBeUndefined();
  });

  it('should return no results if the input is an empty array', () => {
    const result = getNextDateCellTimingIndex({ currentIndex: 0, ranges: [] });

    expect(result.currentResult).toBeUndefined();
    expect(result.nextResult).toBeUndefined();
    expect(result.pastResults.length).toBe(0);
    expect(result.presentResults.length).toBe(0);
    expect(result.futureResults.length).toBe(0);
  });
});

describe('dateRelativeStateForDateCellIndexAndDateCellRange()', () => {
  it('should return past for ranges less than the index.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 0, to: 2 }, 3);
    expect(result).toBe('past');
  });

  it('should return future for ranges greater than the index.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 2, to: 2 }, 1);
    expect(result).toBe('future');
  });

  it('should return present for ranges that contain the index.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 0, to: 2 }, 1);
    expect(result).toBe('present');
  });

  it('should return present for ranges that have the same i value.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 0, to: 2 }, 0);
    expect(result).toBe('present');
  });

  it('should return present for ranges that have the same to value.', () => {
    const result = dateRelativeStateForDateCellRangeComparedToIndex({ i: 0, to: 2 }, 2);
    expect(result).toBe('present');
  });
});

describe('dateCellTimingDateFactory()', () => {
  describe('scenarios', () => {
    describe('America/New_York timezone past days', () => {
      const timezone = 'America/New_York';
      const testDays = 17;
      const timing = {
        start: new Date('2023-08-13T04:00:00.000Z'),
        end: new Date('2023-08-30T09:00:00.000Z'),
        startsAt: new Date('2023-08-14T00:00:00.000Z'),
        duration: 540
      };

      const s: DateCellSchedule = {
        w: '89',
        ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
      };

      it('should correspond the indexes to the expanded dates', () => {
        const indexFactory = dateCellTimingRelativeIndexFactory(timing);
        const dateFactory = dateCellTimingDateFactory(timing);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i, startsAt } = x;

          const expectedIndex = indexFactory(startsAt);
          expect(i).toBe(expectedIndex);

          const dateFromIndex = dateFactory(i);

          expect(dateFromIndex).toBeAfter(timing.start);

          const now = new Date();

          // should return the same hours/minutes/seconds as now
          const differenceInSecondsOnly = Math.floor((Math.abs(differenceInMilliseconds(dateFromIndex, now)) % MS_IN_MINUTE) / MS_IN_MINUTE);
          expect(differenceInSecondsOnly).toBe(0);

          expect(dateFromIndex.getUTCHours()).toBe(now.getUTCHours());
          expect(dateFromIndex.getUTCMinutes()).toBe(now.getUTCMinutes());

          const indexFromDate = indexFactory(dateFromIndex);
          expect(indexFromDate).toBe(i);
        });
      });

      it('should expand the same dates to the same indexes.', () => {
        const indexFactory = dateCellTimingRelativeIndexFactory(timing);
        const dateFactory = dateCellTimingDateFactory(timing);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i } = x;

          const dateFromIndex = dateFactory(i);
          expect(dateFromIndex).toBeAfter(timing.start);

          const indexFromDate = indexFactory(dateFromIndex);
          expect(indexFromDate).toBe(i);
        });
      });
    });
  });
});

describe('dateCellTimingStartsAtDateFactory()', () => {
  describe('scenarios', () => {
    describe('America/New_York timezone past days', () => {
      const timezone = 'America/New_York';
      const testDays = 17;
      const timing = {
        start: new Date('2023-08-13T04:00:00.000Z'),
        end: new Date('2023-08-30T09:00:00.000Z'),
        startsAt: new Date('2023-08-14T00:00:00.000Z'),
        duration: 540
      };

      const s: DateCellSchedule = {
        w: '89',
        ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
      };

      it('should correspond the indexes to the expanded dates', () => {
        const dateFactory = dateCellTimingStartsAtDateFactory(timing, timezone);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i, startsAt } = x;
          expect(dateFactory(i)).toBeSameSecondAs(startsAt);
        });
      });
    });

    describe('system timezone change', () => {
      // this tests the system's timezone change handling to make sure output is different
      const start = parseISO8601DayStringToDate('2023-03-11'); // timezone offset changes going into the next day.
      const dstDay = parseISO8601DayStringToDate('2023-03-13'); // daylight Savings has occured for some timezones. We jump 2 days however to ensure all zones are in the next timezone where applicable.

      it('startsAt should handle daylight savings time changes', () => {
        const timezone = guessCurrentTimezone() as TimezoneString;
        const factory = dateCellTimingStartsAtDateFactory({ start, startsAt: start }, timezone);

        const zero = factory(0);
        expect(zero).toBeSameSecondAs(start);

        const two = factory(2);
        expect(two).toBeSameSecondAs(dstDay);

        const aOffset = start.getTimezoneOffset();
        const bOffset = dstDay.getTimezoneOffset();

        // timezone experiences daylight savings
        if (aOffset !== bOffset) {
          expect(zero.getUTCHours()).not.toBe(two.getUTCHours()); // our start time offset should be reflected in UTC hours
          expect(zero.getHours()).toBe(two.getHours()); // same hours due to tz
        }
      });
    });
  });
});

// TODO: Need more tests concerning the starts/ends at times...

describe('dateCellTimingStartDateFactory()', () => {
  describe('scenarios', () => {
    describe('America/New_York timezone past days', () => {
      const timezone = 'America/New_York';
      const timezoneInstance = timingDateTimezoneUtcNormal(timezone);

      const testDays = 17;
      const timing = {
        start: new Date('2023-08-13T04:00:00.000Z'),
        end: new Date('2023-08-30T09:00:00.000Z'),
        startsAt: new Date('2023-08-14T00:00:00.000Z'),
        duration: 540
      };

      const s: DateCellSchedule = {
        w: '89',
        ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
      };

      it('should output the 0 index start date', () => {
        const dateFactory = dateCellTimingStartDateFactory(timing, timezone);
        const result = dateFactory(0);
        expect(result).toBeSameSecondAs(timing.start);
      });

      it('should correspond the indexes to the expanded dates', () => {
        const dateFactory = dateCellTimingStartDateFactory(timing, timezone);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i, startsAt } = x;
          const expectedStart = addDays(timing.start, i); // there is no DST change for this test, so this is safe for all timezones

          const result = dateFactory(i);
          expect(result).toBeSameSecondAs(expectedStart);
        });
      });
    });

    describe('system timezone change', () => {
      // this tests the system's timezone change handling to make sure output is different
      const start = parseISO8601DayStringToDate('2023-03-11'); // timezone offset changes going into the next day.
      const dstDay = parseISO8601DayStringToDate('2023-03-13'); // daylight Savings has occured for some timezones. We jump 2 days however to ensure all zones are in the next timezone where applicable.

      it('should handle daylight savings time changes.', () => {
        const timezone = guessCurrentTimezone();
        const factory = dateCellTimingStartDateFactory({ start }, timezone as string);

        const zero = factory(0);
        expect(zero).toBeSameSecondAs(start);

        const two = factory(2);
        expect(two).toBeSameSecondAs(dstDay);

        const aOffset = start.getTimezoneOffset();
        const bOffset = dstDay.getTimezoneOffset();

        // timezone experiences daylight savings
        if (aOffset !== bOffset) {
          expect(zero.getUTCHours()).not.toBe(two.getUTCHours()); // our start time offset should be reflected in UTC hours
          expect(zero.getHours()).toBe(two.getHours()); // same hours due to tz
        }
      });
    });
  });
});

describe('dateCellTimingRelativeIndexArrayFactory()', () => {
  const start = startOfDay(new Date());

  describe('function', () => {
    const indexFactory = dateCellTimingRelativeIndexFactory({ start });
    const factory = dateCellTimingRelativeIndexArrayFactory(indexFactory);

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

    it('should convert a DateCellRangeWithRange', () => {
      const days = 5;
      const dateRange: DateCellRangeWithRange = { i: 0, to: days - 1 };
      const result = factory(dateRange);

      expect(result.length).toBe(days);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(1);
      expect(result[2]).toBe(2);
      expect(result[3]).toBe(3);
      expect(result[4]).toBe(4);
    });

    it('should convert a DateCellRange', () => {
      const dateRange: DateCellRange = { i: 0 };
      const result = factory(dateRange);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0);
    });

    it('should convert a DateCellIndex', () => {
      const index = 100;
      const result = factory(index);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(index);
    });

    it('should convert an array of DateCellIndex values', () => {
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

describe('getRelativeIndexForDateCellTiming()', () => {
  const start = startOfDay(new Date());
  const startsAt = addHours(start, 12); // Noon on the day
  const days = 5;
  const timing = dateCellTiming({ startsAt, duration: 60 }, days);

  it('same time should return an index of 0', () => {
    const result = getRelativeIndexForDateCellTiming(timing, startsAt);
    expect(result).toBe(0);
  });

  it('same 24 hour period should return an index of 0', () => {
    const result = getRelativeIndexForDateCellTiming(timing, addHours(startsAt, 6));
    expect(result).toBe(0);
  });

  it('yesterday should return an index of -1', () => {
    const result = getRelativeIndexForDateCellTiming(timing, addDays(startsAt, -1));
    expect(result).toBe(-1);
  });

  it('tomorrow should return an index of 1', () => {
    const result = getRelativeIndexForDateCellTiming(timing, addDays(startsAt, 1));
    expect(result).toBe(1);
  });

  it('one week later should return an index of 7', () => {
    const result = getRelativeIndexForDateCellTiming(timing, addDays(startsAt, 7));
    expect(result).toBe(7);
  });
});

describe('dateCellTiming()', () => {
  const startsAt = setMinutes(setHours(systemNormalDateToBaseDate(new Date()), 12), 0); // keep seconds to show rounding
  const start = systemNormalDateToBaseDate(startOfDay(startsAt));
  const days = 5;
  const minutes = 60;

  it('should allow a duration of 24 hours', () => {
    const result = dateCellTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
    expect(result).toBeDefined();
    expect(result.duration).toBe(MINUTES_IN_DAY);
  });

  describe('range input', () => {
    describe('number of days', () => {
      it('should start at the beginning of the startsAt date', () => {
        const result = dateCellTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
        expect(result.start).toBeSameSecondAs(startOfDay(startsAt));
      });

      it('should retain the startsAt time', () => {
        const result = dateCellTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
        expect(result.startsAt).toBeSameSecondAs(roundDownToHour(startsAt));
      });

      it('should create a timing for a specific time that last 1 day', () => {
        const days = 1;
        const result = dateCellTiming({ startsAt, duration: minutes }, days);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.end).toBeSameMinuteAs(addMinutes(startsAt, minutes));
        expect(result.duration).toBe(minutes);
      });

      it('should create a timing for a specific time that last 5 days', () => {
        const result = dateCellTiming({ startsAt, duration: minutes }, days);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days - 1), minutes));
      });
    });

    describe('Range', () => {
      itShouldFail('if the input start date of the date range is not a valid DateCellTiming start date', () => {
        const start = addHours(startsAt, -6);
        expect(isValidDateCellTimingStartDate(start)).toBe(false);

        const dateRange: DateRange = { start: start, end: start };
        expectFail(() => dateCellTiming({ startsAt, duration: minutes }, dateRange));
      });

      it('should create a timing that starts at the input start time with a start before the startsAt time (same day)', () => {
        const start = roundDownToHour(addHours(startsAt, -6));
        const dateRange: DateRange = { start: start, end: start };
        const result = dateCellTiming({ startsAt, duration: minutes }, dateRange);

        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(start);
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(startsAt, minutes));
      });

      it('should create a timing that starts at the input start time with a start after the startsAt time (next day)', () => {
        const start = roundDownToHour(addHours(startsAt, 6));
        const dateRange: DateRange = { start: start, end: start };

        const result = dateCellTiming({ startsAt, duration: minutes }, dateRange);
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
        const result = dateCellTiming({ startsAt, duration: minutes }, dateRange);
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
        const result = dateCellTiming({ startsAt, duration: minutes }, dateRange);
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
        const result = dateCellTiming({ startsAt, duration: minutes }, dateRangeInput);
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
        const weekTiming = dateCellTiming({ startsAt, duration }, 7); // Sunday-Saturday

        expect(weekTiming.start).toBeSameSecondAs(startsAt); // also the start of the day
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
      });

      it('should generate the correct timing when inputting the range of days.', () => {
        const weekTiming = dateCellTiming({ startsAt, duration }, { start: startsAt, end: endsAtDate }); // Sunday-Saturday

        expect(weekTiming.start).toBeSameSecondAs(startsAt); // also the start of the day
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
      });

      it('should generate the correct timing when inputting the range of days.', () => {
        const weekTiming = dateCellTiming({ startsAt, duration }, { distance: 7 }); // Sunday-Saturday

        expect(weekTiming.start).toBeSameSecondAs(startsAt); // also the start of the day
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
      });
    });

    describe('August 21 Midnight UTC', () => {
      it('should generate the correct timing when inputting the range of days.', () => {
        const startsAt = new Date('2023-08-21T00:00:00.000Z'); // 08-20-23 7PM CDT, should be for 08-20-23 UTC
        const duration = 540;

        const weekTiming = dateCellTiming({ startsAt, duration }, 13); // Sunday-Saturday

        expect(isValidDateCellTiming(weekTiming)).toBe(true);
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
      });
    });

    describe('Sun Nov 6, 5:04PM', () => {
      it('should generate the correct timing for a single day.', () => {
        const now = systemNormalDateToBaseDate(new Date('2022-11-06T17:04:41.134Z')); // Sunday, Nov 6th, 5:04PM
        const expectedStartsAt = roundDownToMinute(now);
        const expectedEnd = addMinutes(expectedStartsAt, 60);

        const duration = 60;
        const weekTiming = dateCellTiming({ startsAt: now, duration }, 1);

        expect(weekTiming.start).toBeSameSecondAs(startOfDay(now));
        expect(weekTiming.startsAt).toBeSameSecondAs(expectedStartsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEnd);
        expect(weekTiming.duration).toBe(60);
      });
    });
  });
});

describe('isValidDateCellTiming()', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
  const validTiming = dateCellTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);

  it('should return true if a valid timing is input.', () => {
    const validTiming = dateCellTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);
    const isValid = isValidDateCellTiming(validTiming);
    expect(isValid).toBe(true);
  });

  it('should return false if the starts time has seconds.', () => {
    const invalidTiming: DateCellTiming = { ...validTiming, start: addSeconds(validTiming.start, 10) };
    const isValid = isValidDateCellTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the starts time has milliseconds.', () => {
    const invalidTiming: DateCellTiming = { ...validTiming, start: addMilliseconds(validTiming.start, 30) };
    const isValid = isValidDateCellTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the startsAt time is before the start time.', () => {
    const start = addHours(startOfDay(startsAt), 2);
    const isValid = isValidDateCellTiming({ startsAt: addMinutes(start, -10), start, end: endOfDay(start), duration: 10 });
    expect(isValid).toBe(false);
  });

  it('should return false if the end time is before the startsAt time.', () => {
    const validTiming = dateCellTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);
    const invalidTiming = {
      ...validTiming,
      end: startsAt
    };

    const isValid = isValidDateCellTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the startsAt time is more than 24 hours after the start time.', () => {
    const invalidTiming: DateCellTiming = { ...validTiming, startsAt: addMilliseconds(validTiming.start, MS_IN_DAY + 1) };
    const isValid = isValidDateCellTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the end is not the expected end time.', () => {
    const invalidTiming: DateCellTiming = { ...validTiming, end: addMinutes(validTiming.end, 1), duration: validTiming.duration };
    const isValid = isValidDateCellTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the duration time is greater than 24 hours.', () => {
    const invalidTiming: DateCellTiming = { ...validTiming, duration: MINUTES_IN_DAY + 1 };
    const isValid = isValidDateCellTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  describe('scenario', () => {
    describe('valid timings', () => {
      it('august 6 to august 21 2023', () => {
        const timing = {
          duration: 540,
          start: new Date('2023-08-06T04:00:00.000Z'),
          startsAt: new Date('2023-08-07T00:00:00.000Z'), // should be a 24 hour difference (invalid)
          end: new Date('2023-08-21T09:00:00.000Z')
        };

        const isValid = isValidDateCellTiming(timing);
        expect(isValid).toBe(true);
      });

      it('august 15 to december 21 2023', () => {
        const timing = {
          start: new Date('2023-08-15T05:00:00.000Z'),
          end: new Date('2023-12-21T22:30:00.000Z'),
          startsAt: new Date('2023-08-15T13:30:00.000Z'),
          duration: 480
        };

        const isValid = isValidDateCellTiming(timing);
        expect(isValid).toBe(true);
      });
    });

    describe('daylight savings changes', () => {
      /**
       * Illustrates the effects of daylight savings changes
       */
      it('should return true for a timing generated via dateCellTiming() for 2023-03-01T14:00:00.000Z with 15 days', () => {
        const startsAt = new Date('2023-03-01T14:00:00.000Z');
        const days = 15; // difference of 15 day causes an issue
        const duration = 600;
        const timing = dateCellTiming({ startsAt, duration }, days);

        const isValid = isValidDateCellTiming(timing);
        expect(isValid).toBe(true);
      });

      it('should return true for a timing generated via dateCellTiming() for 2022-11-01T14:00:00.000Z with 15 days', () => {
        const startsAt = new Date('2022-11-01T14:00:00.000Z');
        const days = 15; // difference of 15 day causes an issue
        const duration = 600;
        const timing = dateCellTiming({ startsAt, duration }, days);

        const isValid = isValidDateCellTiming(timing);
        expect(isValid).toBe(true);
      });
    });
  });
});

describe('dateCellDayOfWeekFactory()', () => {
  describe('function', () => {
    describe('from sunday', () => {
      const factoryFromSunday = dateCellDayOfWeekFactory(Day.SUNDAY);

      it('should return the proper day of the week.', () => {
        range(Day.SUNDAY, Day.SATURDAY).map((i: DateCellIndex) => {
          const result = factoryFromSunday(i);
          expect(result).toBe(i);
        });
      });

      it('should wrap around week.', () => {
        range(Day.SUNDAY, Day.SATURDAY).map((i: DateCellIndex) => {
          const result = factoryFromSunday(i + 7); // add a full week to the index.
          expect(result).toBe(i);
        });
      });
    });

    describe('from saturday', () => {
      const factoryFromSaturday = dateCellDayOfWeekFactory(Day.SATURDAY);

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
 * A DateCell with a string value.
 */
interface DataDateCell extends DateCell {
  value: string;
}

interface DataDateCellRange extends DateCellRangeWithRange {
  value: string;
}

describe('dateCellsExpansionFactory()', () => {
  describe('function', () => {
    function makeBlocks(input: RangeInput) {
      return range(input).map((i) => ({ i, value: `${i}` }));
    }

    const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
    const days = 5;
    const duration = 60;

    const timing = dateCellTiming({ startsAt, duration }, days);
    const factory = dateCellsExpansionFactory<DataDateCell | DataDateCellRange>({ timing });
    const blocks: DataDateCell[] = makeBlocks(days);
    const blocksAsRange: DataDateCellRange = { i: 0, to: days - 1, value: 'a' };

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

    describe('with DateCellRange input', () => {
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
        const factory = dateCellsExpansionFactory({ timing, durationSpanFilter: dateCellDurationSpanHasNotEndedFilterFunction(now) });

        it('should filter out spans that have not ended.', () => {
          const result = factory(blocks);
          expect(result.length).toBe(days - pastDays);
        });
      });
    });

    describe('with maxDateCellsToReturn', () => {
      const maxDateCellsToReturn = 1;
      const factory = dateCellsExpansionFactory({ timing, maxDateCellsToReturn });

      it('should generate up to the maximum number of blocks to return.', () => {
        const result = factory(blocks);
        expect(result.length).toBe(maxDateCellsToReturn);
      });
    });

    describe('with rangeLimit', () => {
      describe('rangeLimit=duration', () => {
        const daysLimit = 3;
        const factory = dateCellsExpansionFactory({ timing, rangeLimit: daysLimit });

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

        describe('with DateCellRange input', () => {
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
        const factory = dateCellsExpansionFactory({ timing, rangeLimit: { start: addDays(timing.start, 1), end: addDays(timing.end, -1) } });

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
        const factory = dateCellsExpansionFactory({ timing, rangeLimit: { distance: 3 } });

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
        const factory = dateCellsExpansionFactory({ timing, rangeLimit: false });

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

describe('dateCellsDayTimingInfoFactory()', () => {
  const start = startOfDay(new Date());
  const startsAt = addHours(start, 12); // Noon on the day
  const days = 5;
  const duration = 60;
  const timing = dateCellTiming({ startsAt, duration }, days);
  const factory = dateCellDayTimingInfoFactory({ timing });

  it('should calculate the day info when provided a day index.', () => {
    const result = factory(0);
    const isInProgress = isDateInDateRange(result.now, { start: result.startsAtOnDay, end: result.endsAtOnDay });

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
    describe('dateCellDayTimingInfoFactory() comparison', () => {
      describe('America/New_York timezone past days', () => {
        const timezone = 'America/New_York';
        const testDays = 17;
        const timing = {
          start: new Date('2023-08-13T04:00:00.000Z'),
          end: new Date('2023-08-30T09:00:00.000Z'),
          startsAt: new Date('2023-08-14T00:00:00.000Z'),
          duration: 540
        };

        const s: DateCellSchedule = {
          w: '89',
          ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
        };

        it('should expand the zero index to the same block', () => {
          const infoFactory = dateCellDayTimingInfoFactory({ timing });
          const expandedDays = expandDateCellSchedule({ timing, schedule: s, maxDateCellsToReturn: 1 });
          const expandedDayZero = expandedDays[0];
          const infoDayZeroIndex = infoFactory(0);
          const infoDayZeroDate = infoFactory(infoDayZeroIndex.startsAtOnDay);

          expect(expandedDayZero.i).toBe(0);
          expect(expandedDayZero.startsAt).toBeSameSecondAs(timing.startsAt);

          expect(infoDayZeroIndex.dayIndex).toBe(0);
          expect(infoDayZeroIndex.startsAtOnDay).toBeSameSecondAs(timing.startsAt);

          expect(infoDayZeroDate.dayIndex).toBe(0);
          expect(infoDayZeroDate.startsAtOnDay).toBeSameSecondAs(timing.startsAt);
        });

        it('should expand the same dates', () => {
          const infoFactory = dateCellDayTimingInfoFactory({ timing });
          const expandedDays = expandDateCellSchedule({ timing, schedule: s });

          expandedDays.forEach((x) => {
            const { i } = x;
            const info = infoFactory(i);

            const { startsAtOnDay } = info;
            expect(startsAtOnDay).not.toBeBefore(timing.startsAt);
            expect(startsAtOnDay).toBeSameSecondAs(x.startsAt);
          });
        });
      });
    });

    describe('only weekends', () => {
      const startsAt = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday
      const weekTiming = dateCellTiming({ startsAt, duration: 60 }, 7); // Sunday-Saturday
      const nextDate = systemNormalDateToBaseDate(new Date('2022-01-08T00:00:00.000Z'));
      const factory = dateCellDayTimingInfoFactory({ timing: weekTiming });

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

describe('groupToDateCellRanges()', () => {
  it('should group the input blocks that overlap eachother.', () => {
    const input = [dateCellRange(0, 4), dateCellRange(0, 4), dateCellRange(0, 4), dateCellRange(0, 4)];
    const result = groupToDateCellRanges(input);

    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(4);
  });

  it('should group the input blocks that are contiguous but do not overlap.', () => {
    const input = [dateCellRange(0, 1), dateCellRange(2, 3), dateCellRange(4, 5), dateCellRange(6, 7)];
    const result = groupToDateCellRanges(input);

    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(7);
  });

  it('should group the input blocks that are contiguous and overlap.', () => {
    const input = [dateCellRange(0, 5), dateCellRange(2, 3), dateCellRange(4, 7), dateCellRange(4, 9)];
    const result = groupToDateCellRanges(input);

    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(9);
  });

  it('should only group the input blocks that are contiguous or overlap.', () => {
    const input = [dateCellRange(0, 2), dateCellRange(4, 7), dateCellRange(9, 12)];
    const result = groupToDateCellRanges(input);

    expect(result.length).toBe(3);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(2);

    expect(result[1].i).toBe(4);
    expect(result[1].to).toBe(7);

    expect(result[2].i).toBe(9);
    expect(result[2].to).toBe(12);
  });
});

describe('allIndexesInDateCellRanges()', () => {
  it('should return the indexes from all input DateCellRange values', () => {
    const a = { i: 0 };
    const b = { i: 1, to: 2 };

    const result = allIndexesInDateCellRanges([a, b]);

    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('should return the indexes from all input DateCellIndex values', () => {
    const result = allIndexesInDateCellRanges([0, 1, 2]);

    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('should return the indexes from a mix of DateCellRange values and index values', () => {
    const a = 0;
    const b = { i: 1, to: 2 };
    const result = allIndexesInDateCellRanges([a, b]);

    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });
});

describe('dateCellRangeBlocksCountInfo()', () => {
  it('should return the correct calculations for DateCell at index 100.', () => {
    const { count, total, average } = dateCellRangeBlocksCountInfo({ i: 100 });
    expect(count).toBe(1);
    expect(total).toBe(100);
    expect(average).toBe(100);
  });

  it('should return the correct calculations for a DateCellRange.', () => {
    const { count, total, average } = dateCellRangeBlocksCountInfo({ i: 51, to: 100 });
    expect(count).toBe(50); // 50 blocks
    expect(total).toBe(3775);
    expect(average).toBe(75.5);
  });
});

describe('dateCellRangeBlocksCount()', () => {
  it('should return 1 for a DateCell.', () => {
    const count = dateCellRangeBlocksCount({ i: 100 });
    expect(count).toBe(1);
  });

  it('should return 2 for two DateCells.', () => {
    const count = dateCellRangeBlocksCount([{ i: 100 }, { i: 101 }]);
    expect(count).toBe(2);
  });

  it('should return 1 for two DateCells that have the same value.', () => {
    const count = dateCellRangeBlocksCount([{ i: 100 }, { i: 100 }]);
    expect(count).toBe(1);
  });

  it('should return 10 for a DateCellRange.', () => {
    const count = dateCellRangeBlocksCount({ i: 5, to: 15 });
    expect(count).toBe(11); // 11 blocks
  });

  it('should return the sum of two unique DateCellRanges.', () => {
    const count = dateCellRangeBlocksCount([
      { i: 5, to: 15 }, // 11 blocks
      { i: 25, to: 35 } // 11 blocks
    ]);
    expect(count).toBe(22);
  });

  it('should return the unique blocks for DateCellRanges.', () => {
    const count = dateCellRangeBlocksCount([
      { i: 5, to: 10 }, // 6 blocks
      { i: 5, to: 15 } // 11 blocks
    ]);
    expect(count).toBe(11);
  });
});

describe('dateCellRangesFullyCoverDateCellRangeFunction()', () => {
  describe('function', () => {
    describe('single range', () => {
      const range = dateCellRange(5, 10);
      const fn = dateCellRangesFullyCoverDateCellRangeFunction(range);

      it('should return true for the same range.', () => {
        const result = fn(range);
        expect(result).toBe(true);
      });

      it('should return true for a range that is smaller and fully covered', () => {
        const result = fn(dateCellRange(5, 6));
        expect(result).toBe(true);
      });

      it('should return false for a range that is larger and not fully covered.', () => {
        const result = fn(dateCellRange(2, 12));
        expect(result).toBe(false);
      });

      it('should return false for a range that is smaller and not fully covered', () => {
        const result = fn(dateCellRange(1, 4));
        expect(result).toBe(false);
      });
    });

    describe('split range', () => {
      const rangeA = dateCellRange(1, 3);
      const rangeB = dateCellRange(5, 8);
      const fn = dateCellRangesFullyCoverDateCellRangeFunction([rangeA, rangeB]);

      it('should return true for rangeA.', () => {
        const result = fn(rangeA);
        expect(result).toBe(true);
      });

      it('should return true for rangeB.', () => {
        const result = fn(rangeB);
        expect(result).toBe(true);
      });

      it('should return false for a range that is larger and not fully covered.', () => {
        const result = fn(dateCellRange(1, 12));
        expect(result).toBe(false);
      });
    });

    describe('merged range', () => {
      const rangeA = dateCellRange(2, 4);
      const rangeB = dateCellRange(5, 10);
      const fn = dateCellRangesFullyCoverDateCellRangeFunction([rangeA, rangeB]);

      it('should return true for rangeA.', () => {
        const result = fn(rangeA);
        expect(result).toBe(true);
      });

      it('should return true for rangeB.', () => {
        const result = fn(rangeB);
        expect(result).toBe(true);
      });

      it('should return false for a range that is larger and not fully covered.', () => {
        const result = fn(dateCellRange(0, 12));
        expect(result).toBe(false);
      });

      it('should return false for a range that is smaller and not fully covered', () => {
        const result = fn(dateCellRange(1, 3));
        expect(result).toBe(false);
      });

      it('should return false for a range that is not fully covered', () => {
        const result = fn(dateCellRange(10, 12));
        expect(result).toBe(false);
      });
    });
  });
});

describe('expandDateCellRange', () => {
  it('should copy the input block and spread it over a range.', () => {
    const lastIndex = 5;
    const blocksRange = { i: 0, to: 5, value: 'a' };

    const result = expandDateCellRange(blocksRange);
    expect(result.length).toBe(lastIndex + 1);
    result.forEach((x, i) => {
      expect(x.i).toBe(i);
      expect(x.value).toBe(blocksRange.value);
    });
  });
});

describe('dateCellIndexRange()', () => {
  const days = 5;
  const start = systemNormalDateToBaseDate(new Date(0)); // 1970-01-01 UTC start of day

  const duration = 60;
  const timing = dateCellTiming({ startsAt: start, duration }, days);
  const end = timing.end;

  it('should generate the dateCellIndexRange for a given date.', () => {
    const result = dateCellIndexRange(timing);
    expect(result.minIndex).toBe(0);
    expect(result.maxIndex).toBe(days);
  });

  it('should return the expected IndexRange for a single day', () => {
    const days = 1;
    const timing = dateCellTiming({ startsAt: start, duration }, days);
    const result = dateCellIndexRange(timing);

    expect(result.minIndex).toBe(0);
    expect(result.maxIndex).toBe(days);
  });

  describe('with limit', () => {
    it('should return the expected range if the limit is the same as the range', () => {
      const days = 1;
      const timing = dateCellTiming({ startsAt: start, duration }, days);

      const limit = {
        start: timing.start,
        end: timing.end
      };

      const result = dateCellIndexRange(timing, limit);

      expect(result.minIndex).toBe(0);
      expect(result.maxIndex).toBe(days);
    });

    it('should return a zero range (maxIndex is exclusive) if the end is the same time as the start in limit', () => {
      const days = 1;
      const timing = dateCellTiming({ startsAt: start, duration }, days);

      const limit = {
        start: timing.start,
        end: timing.start
      };

      const result = dateCellIndexRange(timing, limit);

      expect(result.minIndex).toBe(0);
      expect(result.maxIndex).toBe(1);
    });

    it('should limit a two day timing to a single day', () => {
      const days = 2;
      const timing = dateCellTiming({ startsAt: start, duration }, days);

      const limit = {
        start: timing.start,
        end: addDays(timing.end, -1) // limit 1 day less
      };

      const result = dateCellIndexRange(timing, limit);

      expect(result.minIndex).toBe(0);
      expect(result.maxIndex).toBe(days - 1); // expects 1 day
    });

    it('should generate the dateCellIndexRange for one day in the future (1,5).', () => {
      const limit = {
        start: addHours(start, 24),
        end: end
      };

      const result = dateCellIndexRange(timing, limit);
      expect(result.minIndex).toBe(1);
      expect(result.maxIndex).toBe(days);
    });

    describe('fitToTimingRange=false', () => {
      it('should generate the dateCellIndexRange for the limit.', () => {
        const daysPastEnd = 2;

        const limit = {
          start: addHours(start, 24),
          end: addDays(end, daysPastEnd)
        };

        const result = dateCellIndexRange(timing, limit, false);
        expect(result.minIndex).toBe(1);
        expect(result.maxIndex).toBe(days + daysPastEnd);
      });
    });
  });
});

describe('dateCellsInDateCellRange()', () => {
  it('should filter values that are within the range.', () => {
    const range = { i: 0, to: 5 };
    const input = [{ i: 0 }, { i: 1 }, { i: 2 }];

    const result = filterDateCellsInDateCellRange(input, range);
    expect(result.length).toBe(input.length);
  });

  it('should filter DateCellRange values that are entirely within the range.', () => {
    const range = { i: 0, to: 5 };
    const input = [dateCellRange(0, 5), dateCellRange(2, 4)];

    const result = filterDateCellsInDateCellRange(input, range);
    expect(result.length).toBe(input.length);
  });

  it('should filter out values that are outside the range.', () => {
    const range = { i: 0, to: 5 };
    const input = [{ i: 6 }, { i: 7 }, { i: 8 }];

    const result = filterDateCellsInDateCellRange(input, range);
    expect(result.length).toBe(0);
  });

  it('should filter out DateCellRange values that are only partially within the range.', () => {
    const range = { i: 0, to: 5 };
    const input = dateCellRange(0, 10);

    const result = filterDateCellsInDateCellRange([input], range);
    expect(result.length).toBe(0);
  });
});

describe('isDateCellWithinDateCellRangeFunction()', () => {
  describe('function', () => {
    describe('range 0-0', () => {
      const fn = isDateCellWithinDateCellRangeFunction({ i: 0, to: 0 });

      it('should return false for the range 0-1000', () => {
        const result = fn({ i: 0, to: 1000 });
        expect(result).toBe(false);
      });

      it('should return true for the range 0-0', () => {
        const result = fn({ i: 0, to: 0 });
        expect(result).toBe(true);
      });
    });

    describe('index 0', () => {
      const fn = isDateCellWithinDateCellRangeFunction(0);

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

describe('dateCellRangeIncludedByRangeFunction()', () => {
  describe('function', () => {
    const range = dateCellRange(5, 10);
    const fn = dateCellRangeIncludedByRangeFunction(range);

    it('should return true for the same range.', () => {
      const result = fn(range);
      expect(result).toBe(true);
    });

    it('should return true for a range that is larger and includes the full range.', () => {
      const result = fn(dateCellRange(2, 12));
      expect(result).toBe(true);
    });

    it('should return false for a range that is smaller and does not include the full range.', () => {
      const result = fn(dateCellRange(1, 4));
      expect(result).toBe(false);
    });

    it('should return false for a range that is partial and does not include the full range.', () => {
      const result = fn(dateCellRange(5, 8));
      expect(result).toBe(false);
    });

    it('should return false for a range that is partial and bigger and does not include the full range.', () => {
      const result = fn(dateCellRange(6, 12));
      expect(result).toBe(false);
    });
  });
});

describe('dateCellRangeOverlapsRangeFunction()', () => {
  describe('function', () => {
    describe('index 8', () => {
      const fn = dateCellRangeOverlapsRangeFunction(8);

      it('should return true for the range 8-9', () => {
        const result = fn({ i: 8, to: 9 });
        expect(result).toBe(true);
      });

      it('should return true for the range 0-1000', () => {
        const result = fn({ i: 0, to: 1000 });
        expect(result).toBe(true);
      });

      it('should return false for the range 0-0', () => {
        const result = fn({ i: 0, to: 0 });
        expect(result).toBe(false);
      });

      it('should work with the findIndex function', () => {
        const ranges = [
          { i: 4, to: 4 },
          { i: 8, to: 9 }
        ];

        const result = ranges.findIndex(fn);
        expect(result).toBe(1);
      });
    });

    describe('range 5-10', () => {
      const range = dateCellRange(5, 10);
      const fn = dateCellRangeOverlapsRangeFunction(range);

      it('should return true for the same range.', () => {
        const result = fn(range);
        expect(result).toBe(true);
      });

      it('should return true for a range that is larger and includes the full range.', () => {
        const result = fn(dateCellRange(2, 12));
        expect(result).toBe(true);
      });

      it('should return false for a range that is smaller and does not overlap.', () => {
        const result = fn(dateCellRange(1, 4));
        expect(result).toBe(false);
      });

      it('should return true for a range that has a partial overlap.', () => {
        const result = fn(dateCellRange(5, 8));
        expect(result).toBe(true);
      });

      it('should return true for a range that is partial and bigger and does not include the full range.', () => {
        const result = fn(dateCellRange(6, 12));
        expect(result).toBe(true);
      });
    });
  });
});

interface UniqueDataDateCell extends UniqueDateCellRange {
  value: string;
}

function block(i: number, to?: number, id?: string | undefined) {
  return blockForIdFactory(id)(i, to);
}

function blockForIdFactory(id: string | undefined): (i: number, to?: number) => UniqueDataDateCell {
  return (i: number, to?: number) => {
    return { id, i, to, value: `${i}-${to ?? i}` };
  };
}

function blocks(i: number, to: number): UniqueDataDateCell[] {
  return range(i, to).map((x) => block(x));
}

const startAtIndex = 2;
const endAtIndex = 3;

const noBlocks: UniqueDataDateCell[] = blocks(0, 0);
const contiguousBlocks: UniqueDataDateCell[] = blocks(0, 5);
const blocksWithMiddleGap: UniqueDataDateCell[] = [block(0, 1), block(4, 5)];
const blocksWithStartGap: UniqueDataDateCell[] = [block(startAtIndex + 1, 5)];
const blocksWithEndGap: UniqueDataDateCell[] = [block(0, endAtIndex - 1)];
const blocksBeforeStartAtIndex: UniqueDataDateCell[] = [block(0, startAtIndex - 1)];
const blocksAfterEndAtIndex: UniqueDataDateCell[] = [block(endAtIndex + 1, endAtIndex + 5)];
const overlappingBlocksAtSameIndex: UniqueDataDateCell[] = [block(0, 0, 'a'), block(0, 0, 'b')];
const overlappingBlocksAtSameRange: UniqueDataDateCell[] = [block(0, 5, 'a'), block(0, 5, 'b')];
const overlappingBlocksAtDifferentRange: UniqueDataDateCell[] = [block(0, 3, 'a'), block(2, 5, 'b')];
const overlappingBlocksFirstEclipseSecond: UniqueDataDateCell[] = [block(0, 3, 'a'), block(2, 3, 'b')];

const manyOverlappingBlocksAtSameIndex: UniqueDataDateCell[] = [block(0, 0, 'a'), block(0, 0, 'b'), block(0, 0, 'c'), block(0, 0, 'd')];
const manyOverlappingBlocksAtSameRange: UniqueDataDateCell[] = [block(0, 5, 'a'), block(0, 5, 'b'), block(0, 5, 'c'), block(0, 5, 'd')];

describe('groupUniqueDateCells()', () => {
  it('should return the blocks sorted by index', () => {
    const result = groupUniqueDateCells(contiguousBlocks);
    expect(result.i).toBe(0);
    expect(result.to).toBe(4);

    contiguousBlocks.forEach((x, i) => expect(result.blocks[i].value).toBe(x.value));
  });
});

describe('expandUniqueDateCellsFunction', () => {
  describe('function', () => {
    describe('overwrite', () => {
      describe('next', () => {
        const overwriteNextExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({ retainOnOverlap: 'next', fillOption: 'extend' });

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
            const overwriteNextWithEndIndexExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({
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
        const overwriteNextExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({ retainOnOverlap: 'current', fillOption: 'extend' });

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
            const overwriteNextWithEndIndexExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({ endAtIndex, retainOnOverlap: 'current', fillOption: 'extend' });

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
        const fillOptionExpand = expandUniqueDateCellsFunction<UniqueDataDateCell>({ fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

        itShouldFail('if fillFactory is not provided.', () => {
          expectFail(() => expandUniqueDateCellsFunction({ fillOption: 'fill' }));
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
          const fillOptionExpandBlocksWithEndAtIndex = expandUniqueDateCellsFunction<UniqueDataDateCell>({ endAtIndex, fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

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
          const fillOptionExpandBlocksWithStartAndEnd = expandUniqueDateCellsFunction<UniqueDataDateCell>({ startAtIndex, endAtIndex, fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

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
        const expandOptionExpandBlocks = expandUniqueDateCellsFunction<UniqueDataDateCell>({ fillOption: 'extend' });

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
          const expandOptionWithEndIndexExpandBlocks = expandUniqueDateCellsFunction<UniqueDataDateCell>({ endAtIndex, fillOption: 'extend' });

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
          const expandOptionWithStartAndEndIndexExpandBlocks = expandUniqueDateCellsFunction<UniqueDataDateCell>({ startAtIndex, endAtIndex, fillOption: 'extend' });

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

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
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

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
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

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
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

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
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

        const requestedRangeBlocks = expandUniqueDateCellsFunction({
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

        const requestedRangeBlocks = expandUniqueDateCellsFunction<typeof currentBlocks[0]>({
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

        const requestedRangeBlocks = expandUniqueDateCellsFunction<typeof cancelledBlocks[0]>({
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

describe('sortDateCellRanges', () => {
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

    const sorted = sortDateCellRanges(allBlocks);

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

    const sorted = sortDateCellRanges(allBlocks);

    expect(sorted[0].id).toBe('a');
    expect(sorted[1].id).toBe('e');
    expect(sorted[2].id).toBe('b');
    expect(sorted[3].id).toBe('c');
    expect(sorted[4].id).toBe('d');
  });
});

describe('modifyDateCellsToFitRangeFunction()', () => {
  describe('function', () => {
    const range = { i: 2, to: 4 };
    const fn = modifyDateCellsToFitRangeFunction(range);

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

describe('modifyDateCellsToFitRange()', () => {
  it('should fit an input range of 0-1000 within a range of 0-0', () => {
    const result = modifyDateCellsToFitRange({ i: 0, to: 0 }, [{ i: 0, to: 1000 }]);
    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(0);
  });
});
