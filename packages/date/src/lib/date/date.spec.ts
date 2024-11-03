import { dateTimezoneUtcNormal, expandDaysForDateRange, isSameDateDay, systemExperiencesDaylightSavings } from '@dereekb/date';
import { Day, MS_IN_MINUTE, MS_IN_SECOND, isISO8601DateString, isUTCDateString } from '@dereekb/util';
import { parseISO, addMinutes, addDays, endOfWeek, startOfWeek, set as setDateValues, addHours } from 'date-fns';
import { copyHoursAndMinutesToDate, parseJsDateString, readDaysOfWeek, requireCurrentTimezone, roundDateToDate, roundDateToUnixDateTimeNumber } from './date';

describe('isSameDateDay()', () => {
  const dateAString = '2020-04-30T00:00:00.000';
  const dateA = new Date(dateAString);

  const dateBString = '2020-03-30T00:00:00.000'; // month before
  const dateB = new Date(dateBString);

  it('should return true for both null', () => {
    expect(isSameDateDay(null, null)).toBe(true);
  });

  it('should return true for both null or undefined', () => {
    expect(isSameDateDay(null, undefined)).toBe(true);
  });

  it('should return true for the same time', () => {
    expect(isSameDateDay(dateA, dateA)).toBe(true);
  });

  it('should return true for the same day, different time', () => {
    expect(isSameDateDay(dateA, addMinutes(dateA, 120))).toBe(true);
  });

  it('should return false for different days', () => {
    expect(isSameDateDay(dateA, addDays(dateA, 1))).toBe(false);
  });

  it('should return false for the same calendar day date of the month but not the same month', () => {
    expect(isSameDateDay(dateA, dateB)).toBe(false);
  });
});

describe('parseJsDateString()', () => {
  it('should parse an ISO8601DateString to a Date', () => {
    const dateString = '2020-04-30T00:00:00.000';

    expect(isISO8601DateString(dateString)).toBe(true);

    const result = parseJsDateString(dateString);
    expect(result).toBeSameSecondAs(parseISO(dateString));
  });

  it('should parse an UTCDateString to a Date', () => {
    const dateString = 'Sat, 03 Feb 2001 04:05:06 GMT';

    expect(isUTCDateString(dateString)).toBe(true);

    const result = parseJsDateString(dateString);
    expect(result).toBeSameSecondAs(new Date(dateString));
  });
});

describe('readDaysOfWeek()', () => {
  it('should return the days of the week given the input days.', () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 0 });
    const end = endOfWeek(new Date(), { weekStartsOn: 0 });
    const allDatesInRange = expandDaysForDateRange({ start, end });

    const result = readDaysOfWeek(allDatesInRange, (x) => x);
    expect(result.size).toBe(7);
    expect(result).toContain(0);
    expect(result).toContain(6);
  });

  it('should return the days of the week given the input days for a month.', () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 0 });
    const end = addDays(start, 30);
    const allDatesInRange = expandDaysForDateRange({ start, end });

    const result = readDaysOfWeek(allDatesInRange, (x) => x);
    expect(result.size).toBe(7);
    expect(result).toContain(0);
    expect(result).toContain(6);
  });

  it('should return the days of the week given the input days from sunday.', () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 0 });
    const end = addDays(start, 2);
    const allDatesInRange = expandDaysForDateRange({ start, end });

    const result = readDaysOfWeek(allDatesInRange, (x) => x);
    expect(result.size).toBe(3);
    expect(result).toContain(0);
    expect(result).toContain(1);
    expect(result).toContain(2);
  });

  it('should return the days of the week given the input days from wednesday.', () => {
    const start = startOfWeek(new Date(), { weekStartsOn: Day.WEDNESDAY });
    const end = addDays(start, 2);
    const allDatesInRange = expandDaysForDateRange({ start, end });

    const result = readDaysOfWeek(allDatesInRange, (x) => x);
    expect(result.size).toBe(3);
    expect(result).toContain(Day.WEDNESDAY);
    expect(result).toContain(Day.THURSDAY);
    expect(result).toContain(Day.FRIDAY);
  });
});

describe('roundDateToUnixDateTimeNumber()', () => {
  describe('floor', () => {
    it('should round the date down to the hour', () => {
      const date = new Date('2024-01-01T01:05:07.123Z');
      const expectedDate = new Date('2024-01-01T01:00:00.000Z');

      const result = roundDateToDate(date, 'hour', 'floor');
      expect(result).toBeSameSecondAs(expectedDate);
    });

    it('should round the date down to the minute', () => {
      const date = new Date('2024-01-01T01:05:07.123Z');
      const expectedDate = new Date('2024-01-01T01:05:00.000Z');

      const result = roundDateToDate(date, 'minute', 'floor');
      expect(result).toBeSameSecondAs(expectedDate);
    });

    it('should round the date down to the second', () => {
      const date = new Date('2024-01-01T01:05:07.123Z');
      const expectedDate = new Date('2024-01-01T01:05:07.000Z');

      const result = roundDateToDate(date, 'second', 'floor');
      expect(result).toBeSameSecondAs(expectedDate);
    });
  });

  describe('ceil', () => {
    it('should round the date up to the hour', () => {
      const date = new Date('2024-01-01T01:05:07.123Z');
      const expectedDate = new Date('2024-01-01T02:00:00.000Z');

      const result = roundDateToDate(date, 'hour', 'ceil');
      expect(result).toBeSameSecondAs(expectedDate);
    });

    it('should round the date up to the minute', () => {
      const date = new Date('2024-01-01T01:05:07.123Z');
      const expectedDate = new Date('2024-01-01T01:06:00.000Z');

      const result = roundDateToDate(date, 'minute', 'ceil');
      expect(result).toBeSameSecondAs(expectedDate);
    });

    it('should round the date up to the second', () => {
      const date = new Date('2024-01-01T01:05:07.123Z');
      const expectedDate = new Date('2024-01-01T01:05:08.000Z');

      const result = roundDateToDate(date, 'second', 'ceil');
      expect(result).toBeSameSecondAs(expectedDate);
    });
  });

  describe('scenario', () => {
    describe('daylight savings', () => {
      const timezone = requireCurrentTimezone();
      const timezoneInstance = dateTimezoneUtcNormal(timezone);

      if (timezoneInstance.targetTimezoneExperiencesDaylightSavings(new Date('2024-11-03T00:00:00.000Z'))) {
        const midnight = timezoneInstance.startOfDayInTargetTimezone('2024-11-03');

        const timezoneFirstHourBeforeShift = addHours(midnight, 1); // 1AM
        const timezoneShiftTime = addHours(midnight, 2); // 2AM, second 1AM after rollback

        describe('nov 3 2024', () => {
          // America/Chicago

          describe('date-fns: set()', () => {
            it('should erraneously roll the hour back', () => {
              const result = setDateValues(timezoneFirstHourBeforeShift, {
                minutes: 0
              });

              expect(result).toBeSameSecondAs(timezoneShiftTime);
            });
          });

          describe('Date.setMinute(0)', () => {
            it('should erraneously roll the hour back', () => {
              const result = new Date(new Date(timezoneFirstHourBeforeShift).setMinutes(0));
              expect(result).toBeSameSecondAs(timezoneShiftTime);
            });
          });

          describe('function', () => {
            it('should properly round down the hour without losing the timezone shift', () => {
              const result = roundDateToUnixDateTimeNumber(new Date(timezoneShiftTime.getTime() + MS_IN_MINUTE), 'hour', 'floor');
              expect(new Date(result)).toBeSameSecondAs(timezoneShiftTime);
            });

            it('should properly round down the minute without losing the timezone shift', () => {
              const result = roundDateToUnixDateTimeNumber(new Date(timezoneShiftTime.getTime() + MS_IN_SECOND), 'minute', 'floor');
              expect(new Date(result)).toBeSameSecondAs(timezoneShiftTime);
            });

            it('should properly round down the second without losing the timezone shift', () => {
              const oneHundredMs = 100;
              const result = roundDateToUnixDateTimeNumber(new Date(timezoneShiftTime.getTime() + oneHundredMs), 'second', 'floor');
              expect(new Date(result)).toBeSameSecondAs(timezoneShiftTime);
            });
          });
        });
      } else {
        it('this timezone has no daylight savings effect', () => {});
      }
    });
  });
});
