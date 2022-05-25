import { hoursToMilliseconds, minutesToMilliseconds, addMilliseconds } from 'date-fns';
import { Milliseconds } from '@dereekb/util';
import { DateTimezoneUtcNormalInstance, getCurrentSystemOffsetInMs } from './date.timezone';
import MockDate from 'mockdate';

beforeEach(() => {
  MockDate.reset();
});

describe('getCurrentSystemOffsetInMs()', () => {

  it('should return the current system offset in milliseconds.', () => {
    const expected = -minutesToMilliseconds(new Date().getTimezoneOffset());
    expect(getCurrentSystemOffsetInMs(new Date())).toBe(expected);
  })

});

describe('DateTimezoneUtcNormalInstance', () => {

  let instance: DateTimezoneUtcNormalInstance;
  let systemTimezoneOffset: Milliseconds;

  beforeEach(() => {
    systemTimezoneOffset = getCurrentSystemOffsetInMs(new Date());

    // note: this isn't currently used.
    expect(systemTimezoneOffset).toBeDefined();
  });

  describe('scenarios', () => {

    describe('utc timezone', () => {

      const utcBaseDate = new Date('2022-02-11T00:00:00Z');   // date in utc
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

    });

  });

  describe('config with timezoneOffset', () => {

    function describeTestsForUtcOffset(utcOffset: number) {

      describe(`timezoneOffset equal to UTC${utcOffset}`, () => {

        const utcBaseDate = new Date('2022-02-11T00:00:00Z');   // date in utc
        const systemTimezoneOffset = getCurrentSystemOffsetInMs(utcBaseDate);
        const targetTimezoneOffset = hoursToMilliseconds(utcOffset);
        const normalDate = addMilliseconds(utcBaseDate, targetTimezoneOffset);      // date in proper timezone.

        const systemAndTargetTimezoneOffset: Milliseconds = -targetTimezoneOffset + systemTimezoneOffset;
        const systemDate: Date = addMilliseconds(normalDate, systemAndTargetTimezoneOffset);

        beforeEach(() => {
          instance = new DateTimezoneUtcNormalInstance({
            timezoneOffset: targetTimezoneOffset
          });

          // console.log('X: ', utcOffset, systemTimezoneOffset, targetTimezoneOffset, millisecondsToHours(systemAndTargetTimezoneOffset), utcBaseDate, normalDate, systemDate);
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
