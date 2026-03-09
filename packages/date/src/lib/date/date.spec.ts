import { dateTimezoneUtcNormal, expandDaysForDateRange, isSameDateDay } from '@dereekb/date';
import { Day, MS_IN_MINUTE, MS_IN_SECOND, isISO8601DateString, isUTCDateString } from '@dereekb/util';
import { parseISO, addMinutes, addDays, endOfWeek, startOfWeek, set as setDateValues, addHours , min as minDate } from 'date-fns';
import {
  parseJsDateString,
  readDaysOfWeek,
  requireCurrentTimezone,
  roundDateToDate,
  roundDateToUnixDateTimeNumber,
  isDate,
  msToMinutes,
  msToSeconds,
  hoursToMs,
  minutesToMs,
  daysToMinutes,
  maxFutureDate,
  isMaxFutureDate,
  MAX_FUTURE_DATE,
  latestMinute,
  toISODateString,
  guessCurrentTimezone,
  safeToJsDate,
  toJsDate,
  earliestDate,
  latestDate,
  isAfter,
  isBefore,
  isSameDate,
  isSameDateHoursAndMinutes,
  utcDayForDate,
  copyHoursAndMinutesFromUTCDate,
  copyHoursAndMinutesToDate,
  roundDownToMinute,
  roundDownToHour,
  findMinDate,
  findMaxDate,
  readDaysOfWeekNames,
  isStartOfDayInUTC,
  isEndOfDayInUTC,
  isStartOfDayForSystem,
  reduceDatesFunction
} from './date';
import { wrapDateTests } from '../../test.spec';

wrapDateTests(() => {
  describe('isDate()', () => {
    it('should return true for a Date instance', () => {
      expect(isDate(new Date())).toBe(true);
    });

    it('should return false for a string', () => {
      expect(isDate('2020-01-01')).toBe(false);
    });
  });

  describe('msToMinutes()', () => {
    it('should convert milliseconds to minutes', () => {
      expect(msToMinutes(60000)).toBe(1);
      expect(msToMinutes(120000)).toBe(2);
    });
  });

  describe('msToSeconds()', () => {
    it('should convert milliseconds to seconds', () => {
      expect(msToSeconds(1000)).toBe(1);
      expect(msToSeconds(2500)).toBe(2.5);
    });
  });

  describe('hoursToMs()', () => {
    it('should convert hours to milliseconds', () => {
      expect(hoursToMs(1)).toBe(3600000);
      expect(hoursToMs(2)).toBe(7200000);
    });
  });

  describe('minutesToMs()', () => {
    it('should convert minutes to milliseconds', () => {
      expect(minutesToMs(1)).toBe(60000);
      expect(minutesToMs(5)).toBe(300000);
    });
  });

  describe('daysToMinutes()', () => {
    it('should convert days to minutes', () => {
      expect(daysToMinutes(1)).toBe(1440);
      expect(daysToMinutes(7)).toBe(10080);
    });
  });

  describe('maxFutureDate()', () => {
    it('should return the MAX_FUTURE_DATE sentinel', () => {
      expect(maxFutureDate()).toBe(MAX_FUTURE_DATE);
    });
  });

  describe('isMaxFutureDate()', () => {
    it('should return true for MAX_FUTURE_DATE', () => {
      expect(isMaxFutureDate(MAX_FUTURE_DATE)).toBe(true);
    });

    it('should return false for a normal date', () => {
      expect(isMaxFutureDate(new Date())).toBe(false);
    });
  });

  describe('latestMinute()', () => {
    it('should truncate seconds and milliseconds', () => {
      const date = new Date('2024-01-01T12:30:45.123Z');
      const result = latestMinute(date);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
      expect(result.getUTCMinutes()).toBe(30);
    });
  });

  describe('toISODateString()', () => {
    it('should convert a Date to an ISO string', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      expect(toISODateString(date)).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should throw for an invalid date string', () => {
      expect(() => toISODateString('not-a-date')).toThrow();
    });
  });

  describe('guessCurrentTimezone()', () => {
    it('should return a timezone string', () => {
      const tz = guessCurrentTimezone();
      expect(tz).toBeDefined();
      expect(typeof tz).toBe('string');
    });
  });

  describe('safeToJsDate()', () => {
    it('should return a Date for a valid string', () => {
      const result = safeToJsDate('2024-01-01T00:00:00.000Z');
      expect(result).toBeInstanceOf(Date);
    });

    it('should return undefined for undefined input', () => {
      expect(safeToJsDate(undefined)).toBeUndefined();
    });
  });

  describe('toJsDate()', () => {
    it('should return the same Date for Date input', () => {
      const date = new Date();
      expect(toJsDate(date)).toBe(date);
    });

    it('should parse an ISO string', () => {
      const result = toJsDate('2024-01-01T00:00:00.000Z');
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse a unix milliseconds number', () => {
      const ms = 1704067200000;
      const result = toJsDate(ms);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(ms);
    });
  });

  describe('earliestDate()', () => {
    it('should return the earliest date', () => {
      const a = new Date('2024-01-01');
      const b = new Date('2024-06-01');
      expect(earliestDate([a, b])).toBeSameSecondAs(a);
    });

    it('should return the default when no valid dates exist', () => {
      const defaultDate = new Date();
      expect(earliestDate([null, undefined], defaultDate)).toBe(defaultDate);
    });
  });

  describe('latestDate()', () => {
    it('should return the latest date', () => {
      const a = new Date('2024-01-01');
      const b = new Date('2024-06-01');
      expect(latestDate([a, b])).toBeSameSecondAs(b);
    });

    it('should return the default when no valid dates exist', () => {
      const defaultDate = new Date();
      expect(latestDate([null], defaultDate)).toBe(defaultDate);
    });
  });

  describe('isAfter()', () => {
    it('should return true when a is after b', () => {
      const jan = new Date('2024-01-01');
      const feb = new Date('2024-02-01');
      expect(isAfter(feb, jan)).toBe(true);
    });

    it('should return undefined when a date is null', () => {
      expect(isAfter(null, new Date())).toBeUndefined();
    });

    it('should return the default value when a date is null', () => {
      expect(isAfter(null, new Date(), false)).toBe(false);
    });
  });

  describe('isBefore()', () => {
    it('should return true when a is before b', () => {
      const jan = new Date('2024-01-01');
      const feb = new Date('2024-02-01');
      expect(isBefore(jan, feb)).toBe(true);
    });

    it('should return undefined when a date is null', () => {
      expect(isBefore(null, new Date())).toBeUndefined();
    });
  });

  describe('isSameDate()', () => {
    it('should return true for identical dates', () => {
      const d = new Date('2024-01-01T00:00:00.000Z');
      expect(isSameDate(d, new Date(d.getTime()))).toBe(true);
    });

    it('should return true for both null', () => {
      expect(isSameDate(null, null)).toBe(true);
    });
  });

  describe('isSameDateHoursAndMinutes()', () => {
    it('should return true for dates in the same minute', () => {
      const a = new Date('2024-01-01T12:30:00.000Z');
      const b = new Date('2024-01-01T12:30:45.999Z');
      expect(isSameDateHoursAndMinutes(a, b)).toBe(true);
    });
  });

  describe('utcDayForDate()', () => {
    it('should return midnight UTC for the same calendar day', () => {
      const local = new Date(2021, 0, 1, 15, 30);
      const utcDay = utcDayForDate(local);
      expect(utcDay.getUTCHours()).toBe(0);
      expect(utcDay.getUTCMinutes()).toBe(0);
      expect(utcDay.getUTCFullYear()).toBe(2021);
      expect(utcDay.getUTCMonth()).toBe(0);
      expect(utcDay.getUTCDate()).toBe(1);
    });
  });

  describe('copyHoursAndMinutesFromUTCDate()', () => {
    it('should copy UTC hours/minutes from source to target day', () => {
      const target = new Date('2024-03-15T00:00:00.000Z');
      const source = new Date('2024-01-01T14:30:45.000Z');
      const result = copyHoursAndMinutesFromUTCDate(target, source, true);
      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCDate()).toBe(15);
    });
  });

  describe('copyHoursAndMinutesToDate()', () => {
    it('should set hours and minutes on the target date', () => {
      const target = new Date('2024-01-01T00:00:00.000Z');
      const result = copyHoursAndMinutesToDate({ hours: 14, minutes: 30 }, target);
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe('roundDownToMinute()', () => {
    it('should remove seconds and milliseconds', () => {
      const date = new Date('2024-01-01T12:30:45.123Z');
      const result = roundDownToMinute(date);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });
  });

  describe('roundDownToHour()', () => {
    it('should remove minutes, seconds and milliseconds', () => {
      const date = new Date('2024-01-01T12:30:45.123Z');
      const result = roundDownToHour(date);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });
  });

  describe('findMinDate()', () => {
    it('should find the earliest date', () => {
      const a = new Date('2024-06-01');
      const b = new Date('2024-01-01');
      expect(findMinDate([a, b])).toBeSameSecondAs(b);
    });

    it('should return undefined for null input', () => {
      expect(findMinDate([null])).toBeUndefined();
    });
  });

  describe('findMaxDate()', () => {
    it('should find the latest date', () => {
      const a = new Date('2024-01-01');
      const b = new Date('2024-06-01');
      expect(findMaxDate([a, b])).toBeSameSecondAs(b);
    });

    it('should return undefined for null input', () => {
      expect(findMaxDate([null])).toBeUndefined();
    });
  });

  describe('reduceDatesFunction()', () => {
    it('should create a reduce function using the provided reducer', () => {
      const findMin = reduceDatesFunction(minDate);
      const a = new Date('2024-01-01');
      const b = new Date('2024-06-01');
      expect(findMin([a, b])).toBeSameSecondAs(a);
    });

    it('should return undefined for empty input', () => {
      const findMin = reduceDatesFunction(minDate);
      expect(findMin([null, undefined])).toBeUndefined();
    });
  });

  describe('readDaysOfWeekNames()', () => {
    it('should return sorted day names for the given dates', () => {
      const start = startOfWeek(new Date(), { weekStartsOn: 0 });
      const dates = [addDays(start, 2), addDays(start, 1)]; // Tue, Mon (unsorted)
      const namesFn = (day: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
      const names = readDaysOfWeekNames(dates, (d) => d, namesFn);
      expect(names[0]).toBe('Mon');
      expect(names[1]).toBe('Tue');
    });
  });

  describe('isStartOfDayInUTC()', () => {
    it('should return true for midnight UTC', () => {
      expect(isStartOfDayInUTC(new Date('2024-01-01T00:00:00.000Z'))).toBe(true);
    });

    it('should return false for non-midnight UTC', () => {
      expect(isStartOfDayInUTC(new Date('2024-01-01T00:00:01.000Z'))).toBe(false);
    });
  });

  describe('isEndOfDayInUTC()', () => {
    it('should return true for 23:59:59.999 UTC', () => {
      expect(isEndOfDayInUTC(new Date('2024-01-01T23:59:59.999Z'))).toBe(true);
    });

    it('should return true for 23:59 in minutes-only mode', () => {
      expect(isEndOfDayInUTC(new Date('2024-01-01T23:59:00.000Z'), true)).toBe(true);
    });
  });

  describe('isStartOfDayForSystem()', () => {
    it('should return true for local midnight', () => {
      const midnight = new Date(2024, 0, 1, 0, 0, 0, 0);
      expect(isStartOfDayForSystem(midnight)).toBe(true);
    });
  });
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

        /**
         * Finds the DST transition dates for the current timezone in the given year.
         * Returns both the spring-forward and fall-back date strings, or undefined if the timezone has no DST.
         *
         * Spring forward: clocks jump ahead (offset decreases), typically in the first half of the year.
         * Fall back: clocks go back (offset increases), typically in the second half of the year.
         */
        function findDstTransitionDates(year: number): { springForward: string; fallBack: string; springForwardGapStartLocalHour: number } | undefined {
          let springForward: string | undefined;
          let springForwardGapStartLocalHour = -1;
          let fallBack: string | undefined;

          for (let month = 0; month < 12; month++) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
              const current = new Date(year, month, day);
              const next = new Date(year, month, day + 1);
              const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

              if (next.getTimezoneOffset() < current.getTimezoneOffset()) {
                // Spring forward = offset decreases (clocks jump ahead)
                springForward = dateString;

                // Find the local hour where the gap starts
                for (let hour = 0; hour < 24; hour++) {
                  const h = new Date(year, month, day, hour);
                  const hNext = new Date(year, month, day, hour + 1);
                  if (hNext.getTimezoneOffset() < h.getTimezoneOffset()) {
                    springForwardGapStartLocalHour = hour + 1;
                    break;
                  }
                }
              } else if (next.getTimezoneOffset() > current.getTimezoneOffset()) {
                // Fall back = offset increases (clocks go back)
                fallBack = dateString;
              }
            }
          }

          if (springForward && fallBack) {
            return { springForward, fallBack, springForwardGapStartLocalHour };
          }

          return undefined;
        }

        const dstDates = findDstTransitionDates(2024);

        if (dstDates) {
          // Fall back tests
          const fallBackMidnight = timezoneInstance.startOfDayInTargetTimezone(dstDates.fallBack);
          const timezoneFirstHourBeforeShift = addHours(fallBackMidnight, 1); // 1AM
          const timezoneShiftTime = addHours(fallBackMidnight, 2); // 2AM, second 1AM after rollback

          describe(`fall-back date: ${dstDates.fallBack}`, () => {
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

          // Spring forward tests
          const gapStartLocalHour = dstDates.springForwardGapStartLocalHour;
          const [sfYear, sfMonth, sfDay] = dstDates.springForward.split('-').map(Number);

          // Use native Date constructor to compute the spring forward transition moment.
          // startOfDayInTargetTimezone can use the wrong DST offset on the transition date
          // for southern hemisphere timezones (e.g. Pacific/Auckland), so we avoid it here.
          // Creating a Date at the gap hour causes JavaScript to resolve it to the first valid time after the gap.
          const timezoneFirstHourAfterSpring = new Date(sfYear, sfMonth - 1, sfDay, gapStartLocalHour, 0, 0, 0);

          describe(`spring-forward date: ${dstDates.springForward}`, () => {
            describe('date-fns: set()', () => {
              it('should erroneously resolve gap time forward when setting hours to the gap', () => {
                // Take a valid time after the gap and try to set its hour to the gap hour
                const validTimeAfterGap = addHours(timezoneFirstHourAfterSpring, 1);
                const result = setDateValues(validTimeAfterGap, { hours: gapStartLocalHour, minutes: 0 });

                // JavaScript resolves the non-existent local time forward past the gap
                expect(result).toBeSameSecondAs(timezoneFirstHourAfterSpring);
              });
            });

            describe('Date.setHours()', () => {
              it('should erroneously resolve gap time forward when setting hours to the gap', () => {
                const validTimeAfterGap = addHours(timezoneFirstHourAfterSpring, 1);
                const result = new Date(new Date(validTimeAfterGap).setHours(gapStartLocalHour, 0, 0, 0));

                expect(result).toBeSameSecondAs(timezoneFirstHourAfterSpring);
              });
            });

            describe('function', () => {
              it('should properly round down the hour after spring forward', () => {
                const result = roundDateToUnixDateTimeNumber(new Date(timezoneFirstHourAfterSpring.getTime() + MS_IN_MINUTE), 'hour', 'floor');
                expect(new Date(result)).toBeSameSecondAs(timezoneFirstHourAfterSpring);
              });

              it('should properly round down the minute after spring forward', () => {
                const result = roundDateToUnixDateTimeNumber(new Date(timezoneFirstHourAfterSpring.getTime() + MS_IN_SECOND), 'minute', 'floor');
                expect(new Date(result)).toBeSameSecondAs(timezoneFirstHourAfterSpring);
              });

              it('should properly round down the second after spring forward', () => {
                const oneHundredMs = 100;
                const result = roundDateToUnixDateTimeNumber(new Date(timezoneFirstHourAfterSpring.getTime() + oneHundredMs), 'second', 'floor');
                expect(new Date(result)).toBeSameSecondAs(timezoneFirstHourAfterSpring);
              });
            });
          });
        } else {
          it('this timezone has no daylight savings effect', () => {});
        }
      });
    });
  });
});
