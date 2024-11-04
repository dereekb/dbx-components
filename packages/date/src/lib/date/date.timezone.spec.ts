import { isEndOfDayInUTC, isStartOfDayInUTC, requireCurrentTimezone } from '@dereekb/date';
import { addHours, millisecondsToHours, hoursToMilliseconds, minutesToMilliseconds, addMilliseconds, startOfDay, addSeconds, endOfDay } from 'date-fns';
import { MS_IN_HOUR, type ISO8601DayString, type Milliseconds } from '@dereekb/util';
import { DateTimezoneUtcNormalInstance, dateTimezoneUtcNormal, getCurrentSystemOffsetInMs, startOfDayInTimezoneDayStringFactory, copyHoursAndMinutesFromDateWithTimezoneNormal, systemDateTimezoneUtcNormal, transformDateRangeToTimezoneFunction, calculateTimezoneOffset, UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from './date.timezone';
import MockDate from 'mockdate';
import { formatToISO8601DayStringForSystem } from './date.format';
import { getTimezoneOffset } from 'date-fns-tz';

beforeEach(() => {
  MockDate.reset();
});

describe('getCurrentSystemOffsetInMs()', () => {
  it('should return the current system offset in milliseconds.', () => {
    // will fail during specific daylight savings times of the year
    const expected = -minutesToMilliseconds(new Date().getTimezoneOffset());
    const currentOffset = getCurrentSystemOffsetInMs(new Date());

    if (Math.abs(expected) === 0 && Math.abs(currentOffset) === 0) {
      // true, sometimes expected will be -0
    } else {
      expect(currentOffset).toBe(expected);
    }
  });
});

describe('calculateTimezoneOffset()', () => {
  describe('daylight savings', () => {
    describe('America/Chicago', () => {
      const timezone = 'America/Chicago';

      describe('march 10 2024', () => {
        const localMidnight = new Date('2024-03-10T06:00:00.000Z');
        const localJustBeforeOffsetChange = new Date('2024-03-10T07:59:59.000Z');
        const localAtOffsetChange = new Date('2024-03-10T08:00:00.000Z'); // 3AM in America/Chicago

        const offsetInHoursBeforeTimeChange = -6;
        const offsetInHoursAfterTimeChange = -5;

        it('should return an offset of -5 at midnight', () => {
          const offsetInMs = calculateTimezoneOffset(timezone, localMidnight);
          expect(offsetInMs).toBe(offsetInHoursBeforeTimeChange * MS_IN_HOUR);
        });

        it('should return an offset of -5 at just before 2', () => {
          const offsetInMs = calculateTimezoneOffset(timezone, localJustBeforeOffsetChange);
          expect(offsetInMs).toBe(offsetInHoursBeforeTimeChange * MS_IN_HOUR);
        });

        it('should return an offset of -6 after the change', () => {
          const offsetInMs = calculateTimezoneOffset(timezone, localAtOffsetChange);
          expect(offsetInMs).toBe(offsetInHoursAfterTimeChange * MS_IN_HOUR);
        });

        describe('date-fns: getTimezoneOffset()', () => {
          // NOTE: Once these tests fail this issue has been fixed and we can use calculateTimezoneOffset() in date-fns-tz

          it('should return the wrong offset for the first two hours', () => {
            const wrongOffset = getTimezoneOffset(timezone, localMidnight);
            expect(wrongOffset).toBe(offsetInHoursAfterTimeChange * MS_IN_HOUR);
          });

          it('should return the right offset after the daylight savings shift', () => {
            const correctOffset = getTimezoneOffset(timezone, localAtOffsetChange);
            expect(correctOffset).toBe(offsetInHoursAfterTimeChange * MS_IN_HOUR);
          });
        });
      });

      describe('nov 3 2024', () => {
        const localMidnight = new Date('2024-11-03T05:00:00.000Z');
        const localJustBeforeOffsetChange = new Date('2024-11-03T06:59:59.000Z');
        const localAtOffsetChange = new Date('2024-11-03T07:00:00.000Z'); // "second" 1AM in America/Chicago

        const offsetInHoursBeforeTimeChange = -5;
        const offsetInHoursAfterTimeChange = -6;

        it('should return an offset of -6 at midnight', () => {
          const offsetInMs = calculateTimezoneOffset(timezone, localMidnight);
          expect(offsetInMs).toBe(offsetInHoursBeforeTimeChange * MS_IN_HOUR);
        });

        it('should return an offset of -6 at just before 2', () => {
          const offsetInMs = calculateTimezoneOffset(timezone, localJustBeforeOffsetChange);
          expect(offsetInMs).toBe(offsetInHoursBeforeTimeChange * MS_IN_HOUR);
        });

        it('should return an offset of -5 after the change', () => {
          const offsetInMs = calculateTimezoneOffset(timezone, localAtOffsetChange);
          expect(offsetInMs).toBe(offsetInHoursAfterTimeChange * MS_IN_HOUR);
        });

        describe('date-fns: getTimezoneOffset()', () => {
          it('should return the wrong offset for the first two hours', () => {
            const wrongOffset = getTimezoneOffset(timezone, localMidnight);
            expect(wrongOffset).toBe(offsetInHoursAfterTimeChange * MS_IN_HOUR);
          });

          it('should return the right offset after the daylight savings shift', () => {
            const correctOffset = getTimezoneOffset(timezone, localAtOffsetChange);
            expect(correctOffset).toBe(offsetInHoursAfterTimeChange * MS_IN_HOUR);
          });
        });
      });
    });
  });
});

describe('DateTimezoneUtcNormalInstance', () => {
  let instance: DateTimezoneUtcNormalInstance;
  let systemTimezoneOffset: Milliseconds;

  beforeEach(() => {
    systemTimezoneOffset = getCurrentSystemOffsetInMs(new Date());

    // note: this isn't currently used.
    expect(systemTimezoneOffset).toBeDefined();
  });

  describe('targetTimezoneExperiencesDaylightSavings()', () => {
    it('should return false for "UTC" in 2023', () => {
      instance = new DateTimezoneUtcNormalInstance({
        timezone: 'UTC'
      });

      expect(instance.targetTimezoneExperiencesDaylightSavings(2023)).toBe(false);
    });

    it('should return true for "America/Denver" in 2023', () => {
      instance = new DateTimezoneUtcNormalInstance({
        timezone: 'America/Denver'
      });

      expect(instance.targetTimezoneExperiencesDaylightSavings(2023)).toBe(true);
    });
  });

  describe('startOfDayInBaseDate()', () => {
    it('should return the midnight of the date in UTC', () => {
      const date = new Date();
      const instance = dateTimezoneUtcNormal({ useSystemTimezone: true });

      const result = instance.startOfDayInBaseDate(date);
      expect(isStartOfDayInUTC(result)).toBe(true);
    });
  });

  describe('endOfDayInBaseDate()', () => {
    it('should return the last millisecond of the date in UTC', () => {
      const date = new Date();
      const instance = dateTimezoneUtcNormal({ useSystemTimezone: true });

      const result = instance.endOfDayInBaseDate(date);
      expect(isEndOfDayInUTC(result)).toBe(true);
    });
  });

  describe('startOfDayInSystemDate()', () => {
    it('should return the midnight of the date for the system', () => {
      const date = new Date();
      const instance = dateTimezoneUtcNormal({ useSystemTimezone: true });

      const result = instance.startOfDayInSystemDate(date);
      expect(result).toBeSameSecondAs(startOfDay(result));
    });
  });

  describe('endOfDayInSystemDate()', () => {
    it('should return the last millisecond of the date for the system', () => {
      const date = new Date();
      const instance = dateTimezoneUtcNormal({ useSystemTimezone: true });

      const result = instance.endOfDayInSystemDate(date);
      expect(result).toBeSameSecondAs(endOfDay(result));
    });
  });

  describe('scenarios', () => {
    describe('useSystemTimezone=true', () => {
      const instance = new DateTimezoneUtcNormalInstance({
        useSystemTimezone: true
      });

      it('should return the same timezone returned by guessCurrentTimezone()', () => {
        const currentTimezone = requireCurrentTimezone();
        expect(currentTimezone).toBeDefined();
        expect(instance.configuredTimezoneString).toBe(currentTimezone);
      });
    });

    describe('utc timezone', () => {
      const utcBaseDate = new Date('2022-02-11T00:00:00Z'); // date in utc
      let systemUtcDifference: Milliseconds;
      let systemTargetDifference: Milliseconds;

      beforeEach(() => {
        instance = new DateTimezoneUtcNormalInstance({
          timezone: 'UTC'
        });

        systemUtcDifference = getCurrentSystemOffsetInMs(utcBaseDate);
        systemTargetDifference = systemUtcDifference;

        // note: these aren't currently used.
        expect(systemUtcDifference).toBeDefined();
        expect(systemTargetDifference).toBeDefined();
      });

      it('conversion from base to target should be 0.', () => {
        expect(instance.getCurrentOffset(utcBaseDate, 'base', 'target')).toBe(0);
      });

      it('conversion from target to base should be 0.', () => {
        expect(instance.getCurrentOffset(utcBaseDate, 'base', 'target')).toBe(0);
      });

      // if testing from within UTC, offset is going to be 0
      if (utcBaseDate.getTimezoneOffset() !== 0) {
        it('conversion from base to system should be non-zero.', () => {
          expect(instance.getCurrentOffset(utcBaseDate, 'base', 'system')).not.toBe(0);
        });

        it('conversion from system to base should be non-zero.', () => {
          expect(instance.getCurrentOffset(utcBaseDate, 'system', 'base')).not.toBe(0);
        });

        it('conversion from target to system should be non-zero.', () => {
          expect(instance.getCurrentOffset(utcBaseDate, 'target', 'system')).not.toBe(0);
        });

        it('conversion from system to target should be non-zero.', () => {
          expect(instance.getCurrentOffset(utcBaseDate, 'system', 'target')).not.toBe(0);
        });
      }
    });

    describe('timezone scenario', () => {
      describe('daylight savings', () => {
        describe('march 10 2024', () => {
          describe('America/Chicago', () => {
            describe('midnight', () => {
              const expectedStartOfDay = new Date('2024-03-10T06:00:00.000Z');
              const expectedStartOfDayInUtc = new Date('2024-03-10T00:00:00.000Z');

              it('should calculate the proper start of day', () => {
                const timezoneInstance = dateTimezoneUtcNormal({ timezone: 'America/Chicago' });
                const startOfTodayInTimezone = timezoneInstance.startOfDayInTargetTimezone('2024-03-10');
                expect(startOfTodayInTimezone).toBeSameSecondAs(expectedStartOfDay);

                const startOfDateInUTC = timezoneInstance.startOfDayInBaseDate('2024-03-10');
                expect(startOfDateInUTC).toBeSameSecondAs(expectedStartOfDayInUtc);

                const offset = timezoneInstance.getOffsetInHours(startOfTodayInTimezone, 'baseDateToTargetDate');
                expect(offset).toBe(-6); // GMT-6 since it is not past 2AM yet

                const convertedToBaseDate = timezoneInstance.baseDateToTargetDate(startOfTodayInTimezone);
                expect(convertedToBaseDate).toBeSameSecondAs(expectedStartOfDayInUtc);
              });
            });

            describe('one second before 3AM', () => {
              const expected2AMLocal = new Date('2024-03-10T07:59:59.000Z');
              const expected2AMInUtc = new Date('2024-03-10T01:59:59.000Z');

              it('should calculate the two AM conversion properly', () => {
                const timezoneInstance = dateTimezoneUtcNormal({ timezone: 'America/Chicago' });
                const twoAMTodayInTimezone = addSeconds(addHours(timezoneInstance.startOfDayInTargetTimezone('2024-03-10'), 2), -1);
                expect(twoAMTodayInTimezone).toBeSameSecondAs(expected2AMLocal);

                const twoAMInUTC = addSeconds(addHours(timezoneInstance.startOfDayInBaseDate('2024-03-10'), 2), -1);
                expect(twoAMInUTC).toBeSameSecondAs(expected2AMInUtc);

                const offset = timezoneInstance.getOffsetInHours(twoAMTodayInTimezone, 'baseDateToTargetDate');
                expect(offset).toBe(-6); // GMT-6 since it is not past 2AM yet

                const convertedToBaseDate = timezoneInstance.baseDateToTargetDate(twoAMTodayInTimezone);
                expect(convertedToBaseDate).toBeSameSecondAs(expected2AMInUtc);
              });
            });

            describe('two AM UTC', () => {
              const expected2AMLocal = new Date('2024-03-10T08:00:00.000Z'); // 2AM becomes 3AM now in America/Chicago
              const expected2AMInUtc = new Date('2024-03-10T02:00:00.000Z'); // Base is at 2AM in UTC
              const twoAMIsActuallyThreeAMInUtc = new Date('2024-03-10T03:00:00.000Z'); // when converting to base date should show 3AM UTC

              it('should calculate two AM properly but convert it to 3AM when using the time conversion', () => {
                const timezoneInstance = dateTimezoneUtcNormal({ timezone: 'America/Chicago' });
                const twoAMTodayInTimezone = addHours(timezoneInstance.startOfDayInTargetTimezone('2024-03-10'), 2);
                expect(twoAMTodayInTimezone).toBeSameSecondAs(expected2AMLocal);

                const twoAMInUTC = addHours(timezoneInstance.startOfDayInBaseDate('2024-03-10'), 2);
                expect(twoAMInUTC).toBeSameSecondAs(expected2AMInUtc);

                const offset = timezoneInstance.getOffsetInHours(twoAMTodayInTimezone, 'baseDateToTargetDate');
                expect(offset).toBe(-5); // GMT-5 since it is now past 2AM...

                const convertedToBaseDate = timezoneInstance.baseDateToTargetDate(twoAMTodayInTimezone);
                expect(convertedToBaseDate).toBeSameSecondAs(twoAMIsActuallyThreeAMInUtc);
              });
            });
          });
        });

        describe('nov 3 2024', () => {
          describe('America/Chicago', () => {
            const timezone = 'America/Chicago';
            const expectedStartOfDay = new Date('2024-11-03T05:00:00.000Z');
            const expectedStartOfDayInUtc = new Date('2024-11-03T00:00:00.000Z');

            describe('midnight', () => {
              it('should calculate the proper start of day', () => {
                const timezoneInstance = dateTimezoneUtcNormal({ timezone });
                const startOfTodayInTimezone = timezoneInstance.startOfDayInTargetTimezone('2024-11-03');
                expect(startOfTodayInTimezone).toBeSameSecondAs(expectedStartOfDay);

                const startOfDateInUTC = timezoneInstance.startOfDayInBaseDate('2024-11-03');
                expect(startOfDateInUTC).toBeSameSecondAs(expectedStartOfDayInUtc);

                const offset = timezoneInstance.getOffsetInHours(startOfTodayInTimezone, 'baseDateToTargetDate');
                expect(offset).toBe(-5); // GMT-5 since it is not past 2AM yet

                const convertedToBaseDate = timezoneInstance.baseDateToTargetDate(startOfTodayInTimezone);
                expect(convertedToBaseDate).toBeSameSecondAs(expectedStartOfDayInUtc);
              });
            });

            describe('one second before 1AM', () => {
              // at 2AM it rolls back to 1AM
              const gmtOffset = -5;
              const expected2AMLocal = new Date('2024-11-03T06:59:59.000Z'); // the "first" 1:59AM
              const expected2AMInUtc = new Date('2024-11-03T01:59:59.000Z'); // addHours(expected2AMLocal, gmtOffset); // the "first" 1:59AM in Base UTC ()

              it('should calculate the two AM conversion properly', () => {
                const timezoneInstance = dateTimezoneUtcNormal({ timezone });

                const startOfDay = timezoneInstance.startOfDayInTargetTimezone('2024-11-03');
                expect(startOfDay).toBeSameSecondAs(expectedStartOfDay);
                expect(startOfDay.toISOString()).toBe(expectedStartOfDay.toISOString());

                const twoAMTodayInTimezone = addSeconds(addHours(timezoneInstance.startOfDayInTargetTimezone('2024-11-03'), 2), -1);
                expect(twoAMTodayInTimezone.toISOString()).toBe(expected2AMLocal.toISOString());
                expect(twoAMTodayInTimezone).toBeSameSecondAs(expected2AMLocal);

                const twoAMInUTC = addSeconds(addHours(timezoneInstance.startOfDayInBaseDate('2024-11-03'), 2), -1);
                expect(twoAMInUTC).toBeSameSecondAs(expected2AMInUtc);

                const offset = timezoneInstance.getOffsetInHours(twoAMTodayInTimezone, 'baseDateToTargetDate');
                expect(offset).toBe(gmtOffset); // GMT-5 since it is not past 2AM yet

                const convertedToBaseDate = timezoneInstance.baseDateToTargetDate(twoAMTodayInTimezone);
                const expectedWithOffset = addHours(expected2AMLocal, gmtOffset);

                expect(convertedToBaseDate).toBeSameSecondAs(expectedWithOffset);
                expect(convertedToBaseDate).toBeSameSecondAs(expected2AMInUtc);
              });
            });

            describe('one AM', () => {
              const expected1AMLocal = new Date('2024-11-03T07:00:00.000Z'); // the "second" 1AM
              const expected1AMInUtc = new Date('2024-11-03T02:00:00.000Z'); // 2AM in Base UTC
              const twoAMIsActuallyOneAMInUtc = new Date('2024-11-03T01:00:00.000Z'); // when converting to base date should show 1AM UTC

              it('should calculate two AM properly but convert it to 3AM when using the time conversion', () => {
                const timezoneInstance = dateTimezoneUtcNormal({ timezone });
                const twoAMTodayInTimezone = addHours(timezoneInstance.startOfDayInTargetTimezone('2024-11-03'), 2);
                expect(twoAMTodayInTimezone).toBeSameSecondAs(expected1AMLocal);

                const twoAMInUTC = addHours(timezoneInstance.startOfDayInBaseDate('2024-11-03'), 2);
                expect(twoAMInUTC).toBeSameSecondAs(expected1AMInUtc);

                const newOffset = millisecondsToHours(calculateTimezoneOffset(timezone, new Date('2024-11-03T07:00:00.000Z')));
                expect(newOffset).toBe(-6);

                const offset = timezoneInstance.getOffsetInHours(twoAMTodayInTimezone, 'baseDateToTargetDate');
                expect(offset).toBe(-6); // GMT-6 since it is now past 2AM...

                const convertedToBaseDate = timezoneInstance.baseDateToTargetDate(twoAMTodayInTimezone);
                expect(convertedToBaseDate).toBeSameSecondAs(twoAMIsActuallyOneAMInUtc);
              });
            });
          });
        });
      });
    });
  });

  describe('config with timezoneOffset', () => {
    function describeTestsForUtcOffset(utcOffset: number) {
      describe(`timezoneOffset = UTC ${utcOffset}`, () => {
        const utcBaseDate = new Date('2022-02-11T00:00:00Z'); // date in utc
        const systemTimezoneOffset = getCurrentSystemOffsetInMs(utcBaseDate);
        const targetTimezoneOffset = hoursToMilliseconds(utcOffset);
        const normalDate = addMilliseconds(utcBaseDate, targetTimezoneOffset); // date in proper timezone.

        const systemAndTargetTimezoneOffset: Milliseconds = -targetTimezoneOffset + systemTimezoneOffset;
        const systemDate: Date = addMilliseconds(normalDate, systemAndTargetTimezoneOffset);

        beforeEach(() => {
          instance = new DateTimezoneUtcNormalInstance({
            timezoneOffset: targetTimezoneOffset
          });

          // console.log('X: ', utcOffset, systemTimezoneOffset, targetTimezoneOffset, millisecondsToHours(systemAndTargetTimezoneOffset), utcBaseDate, normalDate, systemDate);
        });

        it('should return the configured offset.', () => {
          expect(instance.config.useSystemTimezone).toBeUndefined();
          expect(instance.config.timezone).toBeUndefined();
          expect(instance.config.timezoneOffset).toBe(targetTimezoneOffset);
        });

        describe('normalDateToBaseDate()', () => {
          it('should convert the date to the equivalent date in UTC, without any timezone offset', () => {
            const result = instance.targetDateToBaseDate(normalDate);
            const expectedDate = utcBaseDate;
            expect(result).toBeSameSecondAs(expectedDate);
          });
        });

        describe('baseDateToNormalDate()', () => {
          it('should convert the base UTC date to the equivalent date to now with timezone offset', () => {
            const result = instance.baseDateToTargetDate(utcBaseDate);
            const expectedDate = normalDate;
            expect(result).toBeSameSecondAs(expectedDate);
          });
        });

        describe('baseDateToSystemDate()', () => {
          it('should convert the base date to the equivalent date system date, without any timezone offset', () => {
            const expectedDate = systemDate;
            const result = instance.baseDateToSystemDate(utcBaseDate);
            expect(result).toBeSameSecondAs(expectedDate);
          });
        });

        describe('normalDateToSystemDate()', () => {
          it('should convert the date to the equivalent date in the system timezone, without any offset.', () => {
            const expectedDate = systemDate;
            const result = instance.targetDateToSystemDate(normalDate);
            expect(result).toBeSameSecondAs(expectedDate);
          });
        });

        describe('systemDateToNormalDate()', () => {
          it('should convert the system date to the equivalent date to now with timezone offset', () => {
            const expectedDate = normalDate;
            const result = instance.systemDateToTargetDate(systemDate);
            expect(result).toBeSameSecondAs(expectedDate);
          });
        });

        describe('systemDateToBaseDate()', () => {
          it('should convert the system date to the equivalent date in UTC, without any timezone offset', () => {
            const expectedDate = utcBaseDate;
            const result = instance.systemDateToBaseDate(systemDate);
            expect(result).toBeSameSecondAs(expectedDate);
          });
        });
      });
    }

    // https://www.timeanddate.com/worldclock/converter.html?iso=20220211T080000&p1=2284&p2=1440&p3=137&p4=3910
    // Test from UTC-12 to UTC+14
    for (let i = -12; i <= 14; i += 1) {
      describeTestsForUtcOffset(i);
    }

    // describeTestsForUtcOffset(-8);
  });
});

describe('dateTimezoneUtcNormal()', () => {
  it('should return a DateTimezoneUtcNormalInstance with the input TimezoneString', () => {
    const timezone = 'America/Denver';
    const result = dateTimezoneUtcNormal(timezone);
    expect(result.config.timezone).toBe(timezone);
    expect(result.configuredTimezoneString).toBe(timezone);
  });

  it('should return a DateTimezoneUtcNormalInstance with the input TimezoneOffset', () => {
    const timezoneOffset = hoursToMilliseconds(5);
    const result = dateTimezoneUtcNormal(timezoneOffset);
    expect(result.config.timezoneOffset).toBe(timezoneOffset);
    expect(result.configuredTimezoneString).toBe(undefined);
  });

  it('should return a DateTimezoneUtcNormalInstance with the input DateTimezoneUtcNormalInstance', () => {
    const timezone = 'America/Denver';
    const result = dateTimezoneUtcNormal(dateTimezoneUtcNormal(timezone));
    expect(result.config.timezone).toBe(timezone);
    expect(result.configuredTimezoneString).toBe(timezone);
  });

  it('should return a DateTimezoneUtcNormalInstance with the input DateTimezoneUtcNormalInstanceConfig', () => {
    const timezone = 'America/Denver';
    const result = dateTimezoneUtcNormal({ timezone });
    expect(result.config.timezone).toBe(timezone);
    expect(result.configuredTimezoneString).toBe(timezone);
  });
});

describe('systemDateTimezoneUtcNormal()', () => {
  it('should use the system timezone', () => {
    const instance = systemDateTimezoneUtcNormal();

    const currentTimezone = requireCurrentTimezone();
    expect(currentTimezone).toBeDefined();
    expect(instance.configuredTimezoneString).toBe(currentTimezone);
  });
});

describe('startOfDayInTimezoneDayStringFactory()', () => {
  describe('function', () => {
    describe('UTC', () => {
      const timezone = 'UTC';
      const fn = startOfDayInTimezoneDayStringFactory(timezone);
      const instance = new DateTimezoneUtcNormalInstance({ timezone });

      const expectedDay: ISO8601DayString = `2023-03-12`;
      const utcDateString = `${expectedDay}T00:00:00.000Z`;
      const utcStart = new Date(utcDateString);

      it('should return the start of the day date in UTC.', () => {
        const systemStart = instance.systemDateToBaseDate(utcStart); // convert to the system start time to make sure we format it to the proper day string
        const inputDayString = formatToISO8601DayStringForSystem(systemStart); // format to ensure that the same day is being passed

        expect(expectedDay).toBe(inputDayString);
        expect(systemStart).toBeSameSecondAs(startOfDay(systemStart));

        const result = fn(inputDayString);
        expect(result).toBeSameSecondAs(utcStart);
        expect(result.toISOString()).toBe(utcDateString);
      });
    });

    describe('America/Denver', () => {
      const timezone = 'America/Denver';
      const fn = startOfDayInTimezoneDayStringFactory(timezone);
      const instance = new DateTimezoneUtcNormalInstance({ timezone });

      const expectedDay: ISO8601DayString = `2023-03-12`;
      const utcDateString = `${expectedDay}T00:00:00.000Z`;
      const utcStart = new Date(utcDateString);

      const systemStart = instance.systemDateToBaseDate(utcStart);
      const expectedStart = instance.targetDateToBaseDate(utcStart);

      it('should return the start of the day date in America/Denver.', () => {
        const inputDayString = formatToISO8601DayStringForSystem(systemStart); // format to ensure that the same day is being passed
        expect(expectedDay).toBe(inputDayString);
        expect(systemStart).toBeSameSecondAs(startOfDay(systemStart));

        const result = fn(inputDayString);
        expect(result).toBeSameSecondAs(expectedStart);
        expect(result.toISOString()).not.toBe(utcDateString);
      });
    });

    describe('America/New_York', () => {
      const timezone = 'America/New_York';
      const fn = startOfDayInTimezoneDayStringFactory(timezone);
      const instance = new DateTimezoneUtcNormalInstance({ timezone });

      const expectedDay: ISO8601DayString = `2023-03-12`;
      const utcDateString = `${expectedDay}T00:00:00.000Z`;
      const utcStart = new Date(utcDateString);

      const systemStart = instance.systemDateToBaseDate(utcStart);
      const expectedStart = instance.targetDateToBaseDate(utcStart);

      it('should return the start of the day date in America/New_York.', () => {
        const inputDayString = formatToISO8601DayStringForSystem(systemStart); // format to ensure that the same day is being passed
        expect(expectedDay).toBe(inputDayString);
        expect(systemStart).toBeSameSecondAs(startOfDay(systemStart));

        const result = fn(inputDayString);
        expect(result).toBeSameSecondAs(expectedStart);
        expect(result.toISOString()).not.toBe(utcDateString);
      });
    });
  });
});

describe('transformDateRangeToTimezone()', () => {
  describe('function', () => {
    const fn = transformDateRangeToTimezoneFunction('America/Denver', 'systemDateToTargetDate');

    const dateRangeInUTC = {
      start: new Date('2023-03-11T06:00:00.000Z'),
      end: new Date('2023-03-12T06:00:00.000Z')
    };

    it('should transform the date range.', () => {
      const expectedStart = fn._timezoneInstance.systemDateToTargetDate(dateRangeInUTC.start);
      const expectedEnd = fn._timezoneInstance.systemDateToTargetDate(dateRangeInUTC.end);

      const result = fn(dateRangeInUTC);

      expect(result.start).toBeSameSecondAs(expectedStart);
      expect(result.end).toBeSameSecondAs(expectedEnd);
    });
  });
});

describe('setOnDateWithTimezoneNormalFunction()', () => {
  describe('system timezone', () => {
    const systemInstance = dateTimezoneUtcNormal({ useSystemTimezone: true });

    it('should set the hours on the date', () => {
      const date = systemInstance.systemDateToBaseDate(new Date('2024-01-01T01:05:07.123Z'));

      const hours = 5; // 5AM system
      const expectedDate = systemInstance.systemDateToBaseDate(new Date('2024-01-01T05:05:07.123Z'));

      const result = systemInstance.setOnDate({
        date,
        hours
      });

      expect(result).toBeSameSecondAs(expectedDate);
    });

    it('should set the hours and minutes on the date', () => {
      const date = systemInstance.systemDateToBaseDate(new Date('2024-01-01T01:05:07.123Z'));

      const hours = 5; // 5AM system
      const minutes = 10;
      const expectedDate = systemInstance.systemDateToBaseDate(new Date('2024-01-01T05:10:07.123Z'));

      const result = systemInstance.setOnDate({
        date,
        hours,
        minutes
      });

      expect(result).toBeSameSecondAs(expectedDate);
    });

    it('should set the hours and minutes on the date and round to the minute', () => {
      const date = systemInstance.systemDateToBaseDate(new Date('2024-01-01T01:05:07.123Z'));

      const hours = 5; // 5AM system
      const minutes = 10;
      const expectedDate = systemInstance.systemDateToBaseDate(new Date('2024-01-01T05:10:00.000Z'));

      const result = systemInstance.setOnDate({
        date,
        hours,
        minutes,
        roundDownToMinute: true
      });

      expect(result).toBeSameSecondAs(expectedDate);
    });

    it('should copy the input date exactly', () => {
      const date = systemInstance.systemDateToBaseDate(new Date('2024-01-01T01:05:07.123Z'));
      const expectedDate = date;

      const result = systemInstance.setOnDate({
        date,
        copyFrom: date
        // roundDownToMinute: false   // default behavior
      });

      expect(result).toBeSameSecondAs(expectedDate);
    });
  });

  describe('base timezone', () => {
    const baseInstance = UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE;

    it('should set the hours on the date', () => {
      const date = new Date('2024-01-01T01:05:07.123Z');

      const hours = 5; // 5AM system
      const expectedDate = new Date('2024-01-01T05:05:07.123Z');

      const result = baseInstance.setOnDate({
        date,
        hours
      });

      expect(result).toBeSameSecondAs(expectedDate);
    });
  });
});

describe('copyHoursAndMinutesFromDateWithTimezoneNormal()', () => {
  describe('scenario', () => {
    describe('UTC', () => {
      const timezone = 'UTC';
      const timezoneInstance = dateTimezoneUtcNormal({ timezone });

      it('should copy the hours and minutes to the expected time', () => {
        const expectedDate = new Date('2023-08-13T21:31:00.000Z');
        const day = new Date('2023-08-13T00:00:00.000Z');

        const result = copyHoursAndMinutesFromDateWithTimezoneNormal(day, expectedDate, timezoneInstance);
        expect(result).toBeSameSecondAs(expectedDate);
      });
    });

    describe('timezone changes', () => {
      describe('America/Chicago', () => {
        const timezone = 'America/Chicago';
        const timezoneInstance = dateTimezoneUtcNormal({ timezone });

        describe('nov 3 2024', () => {
          // America/Denver goes from -5 to -6
          const expectedStartOfDay = new Date('2024-11-03T05:00:00.000Z');
          const expectedStartOfNextDay = new Date('2024-11-04T06:00:00.000Z');

          it('copying midnight to midnight should return the expected day', () => {
            const startOfDayInTimezone = timezoneInstance.startOfDayInTargetTimezone('2024-11-03');
            expect(startOfDayInTimezone).toBeSameSecondAs(expectedStartOfDay);

            const result = copyHoursAndMinutesFromDateWithTimezoneNormal(startOfDayInTimezone, expectedStartOfNextDay, timezone);
            expect(result).toBeSameSecondAs(startOfDayInTimezone);
          });

          it('copying 1AM to 1AM should return the expected day', () => {
            const expectedOneAM = new Date('2024-11-03T06:00:00.000Z');
            const oneAMInTimezone = addHours(timezoneInstance.startOfDayInTargetTimezone('2024-11-03'), 1);
            expect(expectedOneAM).toBeSameSecondAs(oneAMInTimezone);

            const result = copyHoursAndMinutesFromDateWithTimezoneNormal(expectedOneAM, oneAMInTimezone, timezone);
            expect(result).toBeSameSecondAs(oneAMInTimezone);
          });

          it('copying 2AM to 2AM should return the expected day', () => {
            const expectedTwoAM = new Date('2024-11-03T07:00:00.000Z');
            const twoAMInTimezone = addHours(timezoneInstance.startOfDayInTargetTimezone('2024-11-03'), 2);
            expect(expectedTwoAM).toBeSameSecondAs(twoAMInTimezone);

            const result = copyHoursAndMinutesFromDateWithTimezoneNormal(expectedTwoAM, twoAMInTimezone, timezone);
            expect(result).toBeSameSecondAs(twoAMInTimezone);
          });

          it('copying 3AM to 3AM should return the expected day', () => {
            const expectedThreeAM = new Date('2024-11-03T08:00:00.000Z');
            const threeAMInTimezone = addHours(timezoneInstance.startOfDayInTargetTimezone('2024-11-03'), 3);
            expect(expectedThreeAM).toBeSameSecondAs(threeAMInTimezone);

            const result = copyHoursAndMinutesFromDateWithTimezoneNormal(expectedThreeAM, threeAMInTimezone, timezone);
            expect(result).toBeSameSecondAs(threeAMInTimezone);
          });

          it('copying the midnight should return the midnight', () => {
            const startOfDayInTimezone = timezoneInstance.startOfDayInTargetTimezone('2024-11-03');

            const result = copyHoursAndMinutesFromDateWithTimezoneNormal(startOfDayInTimezone, startOfDayInTimezone, timezone);
            expect(result).toBeSameSecondAs(startOfDayInTimezone);
          });

          it('copying the noon should return the noon', () => {
            const expectedNoonOfDay = new Date('2024-11-03T18:00:00.000Z');
            const startOfDayInTimezone = timezoneInstance.startOfDayInTargetTimezone('2024-11-03');

            const result = copyHoursAndMinutesFromDateWithTimezoneNormal(startOfDayInTimezone, expectedNoonOfDay, timezone);
            expect(result).toBeSameSecondAs(expectedNoonOfDay);
          });
        });
      });
    });
  });
});
