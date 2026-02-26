import { dateTimezoneUtcNormal, expandDaysForDateRange, isSameDateDay } from '@dereekb/date';
import { Day, MS_IN_MINUTE, MS_IN_SECOND, isISO8601DateString, isUTCDateString } from '@dereekb/util';
import { parseISO, addMinutes, addDays, endOfWeek, startOfWeek, set as setDateValues, addHours } from 'date-fns';
import { parseJsDateString, readDaysOfWeek, requireCurrentTimezone, roundDateToDate, roundDateToUnixDateTimeNumber } from './date';
import { wrapDateTests } from '../../test.spec';

wrapDateTests(() => {
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
