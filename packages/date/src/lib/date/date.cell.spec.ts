import { expectFail, itShouldFail } from '@dereekb/util/test';
import { DateRange, DateRangeInput, isDateInDateRange } from './date.range';
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, endOfDay, addSeconds, addMilliseconds, millisecondsToHours, minutesToHours, isBefore, isAfter, addBusinessDays, startOfWeek, differenceInSeconds, differenceInMilliseconds } from 'date-fns';
import { changeTimingToTimezoneFunction, DateCell, DateCellIndex, dateCellTiming, DateCellTiming, isValidDateCellIndex, isValidDateCellTiming, isValidDateCellTimingStartDate, getDateCellTimingFirstEventDateRange, isSameDateCellTiming, FullDateCellTiming, getDateCellTimingHoursInEvent } from './date.cell';
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

describe('dateCellTiming()', () => {
  const systemTimezone = guessCurrentTimezone();
  const startsAt = setMinutes(setHours(systemNormalDateToBaseDate(new Date()), 12), 0); // keep seconds to show rounding
  const start = systemNormalDateToBaseDate(startOfDay(startsAt));
  const days = 5;
  const minutes = 60;

  it('should allow a duration of 24 hours', () => {
    const result = dateCellTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
    expect(result).toBeDefined();
    expect(result.duration).toBe(MINUTES_IN_DAY);
    expect(result.timezone).toBe(systemTimezone);
  });

  describe('range input', () => {
    describe('number of days', () => {
      it('should start at the beginning of the startsAt date', () => {
        const result = dateCellTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
        expect(result.start).toBeSameSecondAs(startOfDay(startsAt));
        expect(result.timezone).toBe(systemTimezone);
      });

      it('should retain the startsAt time', () => {
        const result = dateCellTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
        expect(result.startsAt).toBeSameSecondAs(roundDownToHour(startsAt));
        expect(result.timezone).toBe(systemTimezone);
      });

      it('should create a timing for a specific time that last 1 day', () => {
        const days = 1;
        const result = dateCellTiming({ startsAt, duration: minutes }, days);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.end).toBeSameMinuteAs(addMinutes(startsAt, minutes));
        expect(result.duration).toBe(minutes);
        expect(result.timezone).toBe(systemTimezone);
      });

      it('should create a timing for a specific time that last 5 days', () => {
        const result = dateCellTiming({ startsAt, duration: minutes }, days);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days - 1), minutes));
        expect(result.timezone).toBe(systemTimezone);
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
        expect(result.timezone).toBe(systemTimezone);
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
        expect(result.timezone).toBe(systemTimezone);
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
        expect(result.timezone).toBe(systemTimezone);
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
        expect(result.timezone).toBe(systemTimezone);
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
        expect(result.timezone).toBe(systemTimezone);
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
        expect(weekTiming.timezone).toBe(systemTimezone);
      });

      it('should generate the correct timing when inputting the range of days.', () => {
        const weekTiming = dateCellTiming({ startsAt, duration }, { start: startsAt, end: endsAtDate }); // Sunday-Saturday

        expect(weekTiming.start).toBeSameSecondAs(startsAt); // also the start of the day
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
        expect(weekTiming.timezone).toBe(systemTimezone);
      });

      it('should generate the correct timing when inputting the range of days.', () => {
        const weekTiming = dateCellTiming({ startsAt, duration }, { distance: 7 }); // Sunday-Saturday

        expect(weekTiming.start).toBeSameSecondAs(startsAt); // also the start of the day
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
        expect(weekTiming.timezone).toBe(systemTimezone);
      });
    });

    describe('August 21 Midnight UTC', () => {
      it('should generate the correct timing when inputting the range of days.', () => {
        const startsAt = new Date('2023-08-21T00:00:00.000Z'); // 08-20-23 7PM CDT, should be for 08-20-23 UTC
        const duration = 540;

        const weekTiming = dateCellTiming({ startsAt, duration }, 13); // Sunday-Saturday

        expect(isValidDateCellTiming(weekTiming)).toBe(true);
        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.timezone).toBe(systemTimezone);
      });
    });

    describe('Sun Nov 6, 2022, 5:04PM', () => {
      // daylight savings starts
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
        expect(weekTiming.timezone).toBe(systemTimezone);
      });
    });

    describe('daylight savings changes', () => {
      function describeTestsForTimezone(timezone: TimezoneString) {
        const timezoneInstance = dateTimezoneUtcNormal({ timezone });

        const startDay = '2023-11-03';
        const endDay = '2023-11-08';
        const totalDays = 6;

        const startOfDayInTimezone = timezoneInstance.startOfDayInSystemDate(startDay);
        const startOfEndDay = timezoneInstance.startOfDayInTargetDate(endDay);

        const duration = 60;

        describe(`${timezone}`, () => {
          it(`should create a proper timing given the timezone ${timezone}`, () => {
            const result = dateCellTiming({ startsAt: startOfDayInTimezone, duration }, totalDays, timezoneInstance);
            expect(isValidDateCellTiming(result)).toBe(true);

            expect(result.start).toBeSameSecondAs(startOfDayInTimezone);
            expect(result.startsAt).toBeSameSecondAs(result.start); // starts at midnight, same instant
            expect(result.end).toBeSameSecondAs(addMinutes(startOfEndDay, duration));
            expect(result.duration).toBe(result.duration);
            expect(result.timezone).toBe(timezone);

            expect(isValidDateCellTiming(result)).toBe(true);
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

/*
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
*/

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

  it('should return false if the timezones are different', () => {
    expect(isSameDateCellTiming(timing, { ...timing, timezone: 'Invalid/Not_Real' })).toBe(false);
  });

  it('should return false if the startsAt are different', () => {
    expect(isSameDateCellTiming(timing, { ...timing, startsAt: new Date() })).toBe(false);
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

describe('isValidDateCellTiming()', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
  const validTiming = dateCellTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);

  it('should return true if a valid timing is input.', () => {
    const validTiming = dateCellTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);
    const isValid = isValidDateCellTiming(validTiming);
    expect(isValid).toBe(true);
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
        const timing: FullDateCellTiming = {
          duration: 540,
          timezone: 'America/New_York',
          start: new Date('2023-08-06T04:00:00.000Z'),
          startsAt: new Date('2023-08-07T00:00:00.000Z'), // should be a 24 hour difference (invalid)
          end: new Date('2023-08-21T09:00:00.000Z')
        };

        const isValid = isValidDateCellTiming(timing);
        expect(isValid).toBe(true);
      });

      it('august 15 to december 21 2023', () => {
        const timing: FullDateCellTiming = {
          timezone: 'America/New_York',
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
