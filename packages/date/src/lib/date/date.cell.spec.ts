import { expectFail, itShouldFail } from '@dereekb/util/test';
import { DateRange, DateRangeInput } from './date.range';
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, endOfDay, addMilliseconds, millisecondsToHours } from 'date-fns';
import {
  dateCellTiming,
  DateCellTiming,
  isValidDateCellIndex,
  isValidDateCellTiming,
  isValidDateCellTimingStartDate,
  getDateCellTimingFirstEventDateRange,
  isSameDateCellTiming,
  FullDateCellTiming,
  getDateCellTimingHoursInEvent,
  changeDateCellTimingToTimezoneFunction,
  calculateExpectedDateCellTimingDuration,
  dateCellTimingTimezoneNormalInstance,
  calculateExpectedDateCellTimingDurationPair,
  isValidFullDateCellTiming,
  dateCellTimingStartPair,
  dateCellTimingStart,
  isDateCellTiming,
  isFullDateCellTiming
} from './date.cell';
import { MS_IN_DAY, MINUTES_IN_DAY, TimezoneString, MINUTES_IN_HOUR } from '@dereekb/util';
import { guessCurrentTimezone, requireCurrentTimezone, roundDownToHour, roundDownToMinute } from './date';
import { dateTimezoneUtcNormal, systemNormalDateToBaseDate } from './date.timezone';
import { plainToInstance } from 'class-transformer';

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

describe('DateCellTiming', () => {
  it('should be parsed by class validator.', () => {
    const data = dateCellTiming({ startsAt: new Date(), duration: 60 }, 10);
    const json: object = JSON.parse(JSON.stringify(data));

    const result = plainToInstance(DateCellTiming, json, {
      excludeExtraneousValues: true
    });

    expect(result.startsAt).toBeDefined();
    expect(result.end).toBeDefined();
    expect(result.duration).toBe(data.duration);
    expect(result.timezone).toBe(data.timezone);
    expect(result.startsAt).toBeSameSecondAs(data.startsAt);
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

        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
        expect(weekTiming.timezone).toBe(systemTimezone);
      });

      it('should generate the correct timing when inputting the distance of days.', () => {
        const weekTiming = dateCellTiming({ startsAt, duration }, { distance: 7 }); // Sunday-Saturday

        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
        expect(weekTiming.timezone).toBe(systemTimezone);
      });

      it('should generate the correct timing when inputting a DateRange.', () => {
        const weekTiming = dateCellTiming({ startsAt, duration }, { start: startsAt, end: endsAtDate }); // Sunday-Saturday

        expect(weekTiming.startsAt).toBeSameSecondAs(startsAt);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndsAt);
        expect(weekTiming.duration).toBe(60);
        expect(weekTiming.timezone).toBe(systemTimezone);
      });
    });

    describe('August 21 Midnight UTC', () => {
      it('should generate the correct timing when inputting the range of days.', () => {
        const timezone = 'UTC';
        const midnightUtc = new Date('2023-08-21T00:00:00.000Z');
        const expectedEndDate = new Date('2023-09-02T09:00:00.000Z'); // 13 days and 9 hours later
        const duration = 540;

        const weekTiming = dateCellTiming({ startsAt: midnightUtc, duration }, 13, timezone); // Sunday-Saturday

        expect(weekTiming.timezone).toBe(timezone);
        expect(weekTiming.start).toBeSameSecondAs(midnightUtc);
        expect(weekTiming.startsAt).toBeSameSecondAs(midnightUtc);
        expect(weekTiming.end).toBeSameSecondAs(expectedEndDate);
        expect(isValidFullDateCellTiming(weekTiming)).toBe(true);
        expect(isValidDateCellTiming(weekTiming)).toBe(true);
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

        const startOfDayInTimezone = timezoneInstance.startOfDayInTargetTimezone(startDay);
        const startOfEndDay = timezoneInstance.startOfDayInTargetTimezone(endDay);

        const duration = 60;

        describe(`${timezone}`, () => {
          it(`should create a proper timing given the timezone ${timezone}`, () => {
            const result = dateCellTiming({ startsAt: startOfDayInTimezone, duration }, totalDays, timezoneInstance);
            expect(isValidFullDateCellTiming(result)).toBe(true);
            expect(isValidDateCellTiming(result)).toBe(true);

            expect(timezoneInstance.configuredTimezoneString).toBe(timezone);
            expect(result.timezone).toBe(timezone);
            expect(result.start).toBeSameSecondAs(startOfDayInTimezone);
            expect(result.startsAt).toBeSameSecondAs(result.start); // starts at midnight, same instant
            expect(result.end).toBeSameSecondAs(addMinutes(startOfEndDay, duration));
            expect(result.duration).toBe(result.duration);
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

describe('isDateCellTiming()', () => {
  const timing = dateCellTiming({ startsAt: new Date(), duration: 60 }, 2);

  it('should return true for a DateCellTiming.', () => {
    expect(isDateCellTiming(timing)).toBe(true);
  });

  it('should return false for an object that is not a DateCellTiming.', () => {
    expect(isDateCellTiming({})).toBe(false);
  });
});

describe('isFullDateCellTiming()', () => {
  const timing: FullDateCellTiming = dateCellTiming({ startsAt: new Date(), duration: 60 }, 2);

  it('should return true for a FullDateCellTiming.', () => {
    expect(isFullDateCellTiming(timing)).toBe(true);
  });

  it('should return false for an object that is not a FullDateCellTiming.', () => {
    expect(isFullDateCellTiming({})).toBe(false);
  });
});

describe('dateCellTimingStartPair()', () => {
  describe('scenario', () => {
    describe('August 21 Midnight UTC', () => {
      it('should generate the correct timing when inputting the range of days.', () => {
        const timezone = 'UTC';
        const midnightUtc = new Date('2023-08-21T00:00:00.000Z');
        const weekTiming = dateCellTiming({ startsAt: midnightUtc, duration: 60 }, 13, timezone); // Sunday-Saturday

        const start = dateCellTimingStartPair(weekTiming);
        expect(start.start).toBeSameSecondAs(weekTiming.start);
      });
    });
  });
});

describe('dateCellTimingTimezoneNormalInstance()', () => {
  it('should create a DateTimezoneUtcNormalInstance for the system timezone if input is not defined.', () => {
    const systemTimezone = requireCurrentTimezone();
    const normalInstance = dateCellTimingTimezoneNormalInstance();
    expect(normalInstance).toBeDefined();
    expect(normalInstance.configuredTimezoneString).toBe(systemTimezone);
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

  it('should return false if the timezones are different', () => {
    expect(isSameDateCellTiming(timing, { ...timing, timezone: 'Invalid/Not_Real' })).toBe(false);
  });

  it('should return false if the startsAt are different', () => {
    expect(isSameDateCellTiming(timing, { ...timing, startsAt: new Date() })).toBe(false);
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
  const timing = dateCellTiming({ startsAt, duration: MINUTES_IN_HOUR * hours }, 2); // 2 days

  it('should return the hours in the timing.', () => {
    const result = getDateCellTimingHoursInEvent(timing);
    expect(result).toBe(hours);
  });

  describe('hours with fraction', () => {
    const hours = 4.5;
    const startsAt = startOfDay(new Date());
    const timing = dateCellTiming({ startsAt, duration: MINUTES_IN_HOUR * hours }, 2); // 2 days

    it('should return the hours in the timing.', () => {
      const result = getDateCellTimingHoursInEvent(timing);
      expect(result).toBe(hours);
    });
  });
});

describe('changeDateCellTimingToTimezoneFunction()', () => {
  describe('function', () => {
    const startOfToday = startOfDay(new Date());
    const timing = dateCellTiming({ startsAt: addHours(startOfToday, 3), duration: 60 }, 2); // 2 days

    describe('UTC', () => {
      const fn = changeDateCellTimingToTimezoneFunction('UTC');
      const utcTimezoneOffsetInHours = 0; // GMT-0

      it('should convert the start date to the UTC timezone.', () => {
        const result = fn(timing);
        const start = dateCellTimingStart(result);

        const utcHours = start.getUTCHours();
        expect(utcHours).toBe(utcTimezoneOffsetInHours);

        expect(result.timezone).toBe('UTC');
        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
        expect(result.end).toBeSameSecondAs(timing.end);
        expect(result.duration).toBe(timing.duration);
      });

      describe('UTC to America/Chicago', () => {
        const timezone = 'America/Chicago';
        const normalInstance = dateTimezoneUtcNormal(timezone);

        const startsAtInUtcDate = new Date('2022-01-02T00:00:00Z'); // 0 offset UTC date

        const duration = 60;
        const utcTiming: DateCellTiming = { timezone: 'UTC', startsAt: startsAtInUtcDate, end: addMinutes(startsAtInUtcDate, duration), duration: 60 };
        const fn = changeDateCellTimingToTimezoneFunction(utcTiming);

        it('should convert the start date to the America/Chicago timezone.', () => {
          const result = fn(timing);
          const start = dateCellTimingStart(result);

          const utcHours = start.getUTCHours();
          expect(utcHours).toBe(utcTimezoneOffsetInHours);

          expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
          expect(result.end).toBeSameSecondAs(timing.end);
          expect(result.duration).toBe(timing.duration);
        });
      });
    });

    describe('America/Denver', () => {
      const fn = changeDateCellTimingToTimezoneFunction('America/Denver');

      // GMT-6 or GMT-7 depending on time of year
      const denverTimezoneOffsetInHours = millisecondsToHours(dateTimezoneUtcNormal('America/Denver').targetDateToBaseDateOffset(startOfToday));

      it('should convert the start date to the America/Denver timezone.', () => {
        const result = fn(timing);
        const start = dateCellTimingStart(result);

        const utcHours = start.getUTCHours();
        expect(utcHours).toBe(denverTimezoneOffsetInHours);

        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);
        expect(result.end).toBeSameSecondAs(timing.end);
        expect(result.duration).toBe(timing.duration);
      });
    });
  });
});

describe('calculateExpectedDateCellTimingDurationPair()', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
  const duration = 60;
  const validTiming = dateCellTiming({ startsAt, duration }, 1);

  it('should calculate the proper duration.', () => {
    const result = calculateExpectedDateCellTimingDurationPair(validTiming);
    expect(result.duration).toBe(duration);
  });

  describe('scenarios', () => {
    it('midnight UTC 2023-08-14 - 2023-08-31', () => {
      const testDays = 17;

      const duration = 540;
      const timing: FullDateCellTiming = dateCellTiming(
        {
          startsAt: new Date('2023-08-14T00:00:00.000Z'),
          duration
        },
        testDays,
        'America/New_York'
      );

      const expectedFinalStartsAt = addMinutes(timing.end, -timing.duration);

      const result = calculateExpectedDateCellTimingDurationPair(timing);
      expect(result.expectedFinalStartsAt).toBeSameSecondAs(expectedFinalStartsAt);
      expect(result.duration).toBe(duration);
    });

    it('midnight UTC 2023-11-01 - 2023-11-18', () => {
      const testDays = 17;

      const duration = 540;
      const timing: FullDateCellTiming = dateCellTiming(
        {
          startsAt: new Date('2023-11-01T00:00:00.000Z'),
          duration
        },
        testDays,
        'America/New_York'
      );

      const expectedFinalStartsAt = addMinutes(timing.end, -timing.duration);

      const result = calculateExpectedDateCellTimingDurationPair(timing);
      expect(result.expectedFinalStartsAt).toBeSameSecondAs(expectedFinalStartsAt);
      expect(result.duration).toBe(duration);
    });
  });

  describe('daylight savings changes', () => {
    /**
     * Illustrates the effects of daylight savings changes
     */
    it('should return the expected duration even with a daylight savings changes', () => {
      const startsAt = new Date('2023-03-01T14:00:00.000Z');
      const days = 15; // difference of 15 day causes an issue
      const duration = 60;
      const timing = dateCellTiming({ startsAt, duration }, days);
      const result = calculateExpectedDateCellTimingDurationPair(timing);
      expect(result.duration).toBe(duration);
    });

    describe('timezones', () => {
      function describeTestsForTimezone(timezone: TimezoneString) {
        const timezoneInstance = dateTimezoneUtcNormal({ timezone });

        const startDay = '2023-11-03';
        const totalDays = 6;

        const startOfDayInTimezone = timezoneInstance.startOfDayInSystemDate(startDay);
        const duration = 60;

        describe(`${timezone}`, () => {
          it(`should return the expected duration for ${timezone}`, () => {
            const result = dateCellTiming({ startsAt: startOfDayInTimezone, duration }, totalDays, timezoneInstance);
            expect(result.duration).toBe(result.duration);
            expect(result.timezone).toBe(timezone);
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

describe('calculateExpectedDateCellTimingDuration()', () => {
  const validTiming = dateCellTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);

  it('should return the expected duration from the input.', () => {
    const result = calculateExpectedDateCellTimingDuration(validTiming);
    expect(result).toBe(validTiming.duration);
  });
});

describe('isValidDateCellTiming()', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
  const validTiming = dateCellTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);

  it('should return true if a valid timing is input.', () => {
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
      describe('America/New_York', () => {
        const timezone = 'America/New_York';

        it('midnight UTC 2023-08-14 - 2023-08-31', () => {
          const testDays = 17;

          const timing: FullDateCellTiming = dateCellTiming(
            {
              startsAt: new Date('2023-08-14T00:00:00.000Z'),
              duration: 540
            },
            testDays,
            timezone
          );

          expect(isValidFullDateCellTiming(timing)).toBe(true);
          expect(isValidDateCellTiming(timing)).toBe(true);
        });

        it('august 6 to august 21 2023', () => {
          const days = 15;
          const duration = MINUTES_IN_HOUR * 9; // 9 hours
          const timezoneNormal = dateTimezoneUtcNormal({ timezone });

          const start = timezoneNormal.startOfDayInTargetTimezone('2023-08-06');
          const startsAt = addHours(start, 12);
          const lastStartsAt = addDays(startsAt, days - 1);

          const manualTiming: FullDateCellTiming = {
            duration,
            timezone,
            start,
            startsAt, // 12PM
            end: addMinutes(lastStartsAt, duration)
          };

          expect(isValidDateCellTiming(manualTiming)).toBe(true);
          expect(isValidFullDateCellTiming(manualTiming)).toBe(true);

          const timing = dateCellTiming({ startsAt: manualTiming.startsAt, duration }, days, timezone);

          expect(timing.duration).toBe(manualTiming.duration);
          expect(timing.timezone).toBe(manualTiming.timezone);
          expect(timing.start).toBeSameSecondAs(manualTiming.start);
          expect(timing.startsAt).toBeSameSecondAs(manualTiming.startsAt);
          expect(timing.end).toBeSameSecondAs(manualTiming.end);

          expect(isValidFullDateCellTiming(timing)).toBe(true);
          expect(isValidDateCellTiming(timing)).toBe(true);
        });

        it('august 15 to december 21 2023', () => {
          const timing: FullDateCellTiming = {
            timezone,
            start: new Date('2023-08-15T05:00:00.000Z'),
            end: new Date('2023-12-21T22:30:00.000Z'),
            startsAt: new Date('2023-08-15T13:30:00.000Z'),
            duration: 480
          };

          const isValid = isValidDateCellTiming(timing);
          expect(isValid).toBe(true);
        });
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
