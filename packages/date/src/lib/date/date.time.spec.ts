import { guessCurrentTimezone } from '@dereekb/date';
import { addMinutes, startOfDay } from 'date-fns';
import { TimeAM } from '@dereekb/util';
import { dateTimeInstanceUtc, getCurrentSystemOffsetInMs, getTimeAM, parseReadableTimeString, readableTimeStringToDate, systemNormalDateToBaseDate, toReadableTimeString } from '.';
import MockDate from 'mockdate';

beforeEach(() => {
  MockDate.reset();
});

describe('getTimeAM()', () => {
  describe('no timezone', () => {
    it('should return the proper AM for 11AM UTC', () => {
      const date = new Date('2021-08-16T11:00:00.000Z');
      expect(getTimeAM(date)).toBe(TimeAM.AM);
    });

    it('should return the proper PM for 12PM UTC', () => {
      const date = new Date('2021-08-16T12:00:00.000Z');
      expect(getTimeAM(date)).toBe(TimeAM.PM);
    });
  });

  describe('timezone', () => {
    it('should return the proper AM for 1AM America/New_York', () => {
      const date = new Date('2021-08-16T05:00:00.000Z');
      expect(getTimeAM(date, 'America/New_York')).toBe(TimeAM.AM);
    });

    it('should return the proper PM for 12PM America/New_York', () => {
      const date = new Date('2021-08-16T16:00:00.000Z');
      expect(getTimeAM(date, 'America/New_York')).toBe(TimeAM.PM);
    });

    it('should return the proper AM for 11AM UTC', () => {
      const date = new Date('2021-08-16T11:00:00.000Z');
      expect(getTimeAM(date, 'UTC')).toBe(TimeAM.AM);
    });

    it('should return the proper PM for 12PM UTC', () => {
      const date = new Date('2021-08-16T12:00:00.000Z');
      expect(getTimeAM(date, 'UTC')).toBe(TimeAM.PM);
    });
  });
});

describe('parseReadableTimeString()', () => {
  const date = new Date('2021-08-16T00:00:00.000Z');

  describe('12:00PM', () => {
    describe('no config provided', () => {
      it('should parse 12PM for UTC', () => {
        const result = parseReadableTimeString('12PM', { date })!;

        expect(result.utc).toBeSameMinuteAs(new Date('2021-08-16T12:00:00.000Z'));
        expect(result.date).toBeSameMinuteAs(new Date('2021-08-16T12:00:00.000Z'));
        expect(result.minutesSinceStartOfDay).toBe(720);
        expect(result.am).toBe(TimeAM.PM);
      });
    });

    describe('use system timezone', () => {
      const systemTimezone = guessCurrentTimezone();

      it(`should parse 12PM for the system timezone (${systemTimezone})`, () => {
        expect(systemTimezone).toBeTruthy();

        const systemOffset = getCurrentSystemOffsetInMs(date);

        const result = parseReadableTimeString('12PM', { date, useSystemTimezone: true })!;

        // if the offset is after midnight, the parsed date will be on the 15th
        const expectedUtcDate = systemOffset >= 0 ? new Date('2021-08-16T12:00:00.000Z') : new Date('2021-08-15T12:00:00.000Z');
        const expectedTimezoneDate = systemNormalDateToBaseDate(expectedUtcDate);

        expect(result.utc).toBeSameMinuteAs(expectedUtcDate);
        expect(result.date).toBeSameMinuteAs(expectedTimezoneDate);
        expect(result.minutesSinceStartOfDay).toBe(720);
        expect(result.am).toBe(TimeAM.PM);
      });
    });

    describe('timezone', () => {
      it('should parse 12PM for America/New_York', () => {
        const result = parseReadableTimeString('12PM', { date, timezone: 'America/New_York' })!;
        expect(result.utc).toBeSameMinuteAs(new Date('2021-08-15T12:00:00.000Z'));
        expect(result.date).toBeSameMinuteAs(new Date('2021-08-15T16:00:00.000Z'));
        expect(result.minutesSinceStartOfDay).toBe(720);
        expect(result.am).toBe(TimeAM.PM);
      });
    });
  });
});

describe('DateTimeUtilityInstance', () => {
  describe('_timeStringToDate()', () => {
    describe('use system timezone', () => {
      describe('raw', () => {
        const date = new Date('2021-08-16T00:00:00.000Z');
        const expectedDateOn16th = new Date('2021-08-16T01:23:00.000Z'); // for timezone offsets > 0
        const expectedDateOn15th = new Date('2021-08-15T01:23:00.000Z'); // for timezone offsets < 0

        // https://www.timeanddate.com/worldclock/converter.html?iso=20220115T172300&p1=237&p2=179&p3=1440&p4=64&p5=770&p6=70
        it('should parse 1:23AM as raw = 1:23AM UTC for Asia/Shanghai', () => {
          const result = dateTimeInstanceUtc()._timeStringToDate('1:23AM', { date, timezone: 'Asia/Shanghai' }).raw;
          expect(result).toBeSameMinuteAs(expectedDateOn16th);
        });

        it('should parse 1:23AM as raw = 1:23AM UTC for Europe/Dublin', () => {
          const timezone = 'Europe/Dublin';
          const result = dateTimeInstanceUtc()._timeStringToDate('1:23AM', { date, timezone }).raw;
          expect(result).toBeSameMinuteAs(expectedDateOn16th);
        });

        it('should parse 1:23AM as raw = 1:23AM UTC for Europe/Amsterdam', () => {
          const timezone = 'Europe/Amsterdam';
          const result = dateTimeInstanceUtc()._timeStringToDate('1:23AM', { date, timezone }).raw;
          expect(result).toBeSameMinuteAs(expectedDateOn16th);
        });

        it('should parse 1:23AM as raw = 1:23AM UTC for UTC', () => {
          const result = dateTimeInstanceUtc()._timeStringToDate('1:23AM', { date, timezone: 'UTC' }).raw;
          expect(result).toBeSameMinuteAs(expectedDateOn16th);
        });

        it('should parse 1:23AM as raw = 1:23AM UTC for America/Los_Angeles', () => {
          const timezone = 'America/Los_Angeles';
          const result = dateTimeInstanceUtc()._timeStringToDate('1:23AM', { date, timezone }).raw;
          expect(result).toBeSameMinuteAs(expectedDateOn15th);
        });

        it('should parse 1:23AM as raw = 1:23AM UTC for America/Chicago', () => {
          const timezone = 'America/Chicago';
          const result = dateTimeInstanceUtc()._timeStringToDate('1:23AM', { date, timezone }).raw;
          expect(result).toBeSameMinuteAs(expectedDateOn15th);
        });

        it('should parse 1:23AM as raw = 1:23AM UTC for America/New_York', () => {
          const timezone = 'America/New_York';
          const result = dateTimeInstanceUtc()._timeStringToDate('1:23AM', { date, timezone }).raw;
          expect(result).toBeSameMinuteAs(expectedDateOn15th);
        });
      });
    });
  });
});

describe('readableTimeStringToDate()', () => {
  describe('time strings', () => {
    describe('1:00AM', () => {
      const expectation = '1:00AM';

      it('should parse 1:00AM as 1AM', () => {
        const date = readableTimeStringToDate('1:00AM')!;
        expect(toReadableTimeString(date)).toBe(expectation);
      });

      it('should parse 1:00 AM as 1AM', () => {
        const date = readableTimeStringToDate('1:00 AM')!;
        expect(toReadableTimeString(date)).toBe(expectation);
      });

      it('should parse 100 as 1AM', () => {
        const date = readableTimeStringToDate('100')!;
        expect(toReadableTimeString(date)).toBe(expectation);
      });

      it('should parse 1 as 1AM', () => {
        const date = readableTimeStringToDate('1')!;
        expect(toReadableTimeString(date)).toBe(expectation);
      });

      it('should parse 1:00 as 1(AM/PM)', () => {
        const date = readableTimeStringToDate('1:00')!;
        const am = getTimeAM(date);
        expect(toReadableTimeString(date)).toBe(`1:00${am}`);
      });
    });

    describe('5:00PM', () => {
      const expectation = '5:00PM';

      it('should parse 5:00PM as 5PM', () => {
        const date = readableTimeStringToDate('5:00PM')!;
        expect(toReadableTimeString(date)).toBe(expectation);
      });

      it('should parse 5:00 PM as 5PM', () => {
        const date = readableTimeStringToDate('5:00 PM')!;
        expect(toReadableTimeString(date)).toBe(expectation);
      });

      /*
      it('should parse 1700 as 5AM', () => {
        const date = readableTimeStringToDate('1700');
        expect(toReadableTimeString(date)).toBe(expectation);
      });

      it('should parse 17:00 as 1(AM/PM)', () => {
        const date = readableTimeStringToDate('17:00');
        expect(toReadableTimeString(date)).toBe(`5:00PM`);
      });
      */
    });

    describe('use system timezone', () => {
      it('should parse 12:00AM as 12AM today using the system timezone', () => {
        const date = new Date();
        const _startOfDay = startOfDay(date); // start of day is for current timezone (2022-02-11T06:00:00.000Z for america/chicago)
        const timezoneOffset = -date.getTimezoneOffset();
        const utcStartOfDay = addMinutes(_startOfDay, timezoneOffset);

        const expectedDate = addMinutes(utcStartOfDay, -timezoneOffset);
        const result = readableTimeStringToDate('12:00AM', { date, useSystemTimezone: true });
        expect(result).toBeSameMinuteAs(expectedDate); // 2022-02-11 12PM, in UTC time.
      });

      describe('scenario', () => {
        describe('The New Date Border', () => {
          /**
           * Describes a test that fails during a certain time of day, and passes during another (in this case, 5 minutes later.)
           */

          beforeEach(() => {
            MockDate.set(new Date('2022-02-11T07:55:21.200Z'));
          });

          // The date is considered 2022-02-11
          it('should parse 12:00AM as 12AM 2022-02-11 using the system timezone at 11:55PM in LA', () => {
            const date = new Date();
            const expectedDate = new Date('2022-02-10T08:00:00.000Z');
            const timezone = 'America/Los_Angeles';
            const result = readableTimeStringToDate('12:00AM', { date, timezone });
            expect(result).toBeSameMinuteAs(expectedDate); // 2022-02-11 12PM, in UTC time.
          });
        });
      });
    });

    describe('no timezone', () => {
      it('should parse 1:00AM as 1AM in UTC time', () => {
        const date = new Date('2021-08-16T00:00:00.000Z');
        const result = readableTimeStringToDate('1:00AM', { date, timezone: 'UTC' });
        expect(result).toBeSameMinuteAs(new Date('2021-08-16T01:00:00.000Z'));
      });
    });

    describe('timezone', () => {
      const date = new Date('2021-08-16T00:00:00.000Z');

      // https://www.timeanddate.com/worldclock/converter.html?iso=20220115T172300&p1=237&p2=179&p3=1440&p4=64&p5=770&p6=70
      it('should parse 1:23AM as 1:23AM for Asia/Shanghai', () => {
        const result = readableTimeStringToDate('1:23AM', { date, timezone: 'Asia/Shanghai' });
        expect(result).toBeSameMinuteAs(new Date('2021-08-15T17:23:00.000Z')); // 1:23AM in Shanghai
      });

      it('should parse 1:23AM as 1:23AM for Europe/Dublin', () => {
        const timezone = 'Europe/Dublin';
        const result = readableTimeStringToDate('1:23AM', { date, timezone }); // +00:00
        expect(result).toBeSameMinuteAs(new Date('2021-08-16T00:23:00.000Z'));
      });

      it('should parse 1:23AM as 1:23AM for Europe/Amsterdam', () => {
        const timezone = 'Europe/Amsterdam';
        const result = readableTimeStringToDate('1:23AM', { date, timezone }); // +01:00
        expect(result).toBeSameMinuteAs(new Date('2021-08-15T23:23:00.000Z'));
      });

      it('should parse 1:23AM as 1:23AM for UTC', () => {
        const result = readableTimeStringToDate('1:23AM', { date, timezone: 'UTC' });
        expect(result).toBeSameMinuteAs(new Date('2021-08-16T01:23:00.000Z'));
      });

      it('should parse 1:23AM as 1:23AM for America/Los_Angeles', () => {
        const timezone = 'America/Los_Angeles';
        const result = readableTimeStringToDate('1:23AM', { date, timezone }); // +08:00
        expect(result).toBeSameMinuteAs(new Date('2021-08-15T08:23:00.000Z'));
      });

      it('should parse 1:23AM as 1:23AM for America/Chicago', () => {
        const timezone = 'America/Chicago';
        const result = readableTimeStringToDate('1:23AM', { date, timezone }); // +06:00
        expect(result).toBeSameMinuteAs(new Date('2021-08-15T06:23:00.000Z'));
      });

      it('should parse 1:23AM as 1:23AM for America/New_York', () => {
        const timezone = 'America/New_York';
        const result = readableTimeStringToDate('1:23AM', { date, timezone }); // +05:00
        expect(result).toBeSameMinuteAs(new Date('2021-08-15T05:23:00.000Z'));
      });
    });
  });
});
