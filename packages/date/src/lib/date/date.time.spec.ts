import { TimeAM } from '@dereekb/util';
import { utcToZonedTime } from 'date-fns-tz';
import { getTimeAM, parseReadableTimeString, readableTimeStringToDate, toReadableTimeString } from '.';

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

    describe('no timezone', () => {

      it('should parse 12PM for UTC', () => {
        const result = parseReadableTimeString('12PM', { date })!;
        expect(result.utc).toBeSameMinuteAs(new Date('2021-08-16T12:00:00.000Z'));
        expect(result.date).toBeSameMinuteAs(new Date('2021-08-16T12:00:00.000Z'));
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
        expect(result).toBeSameMinuteAs(new Date('2021-08-15T17:23:00.000Z'));  // 1:23AM in Shanghai
      });

      it('should parse 1:23AM as 1:23AM for Europe/Amsterdam', () => {
        const result = readableTimeStringToDate('1:23AM', { date, timezone: 'Europe/Amsterdam' });    // +01:00
        expect(result).toBeSameMinuteAs(new Date('2021-08-15T23:23:00.000Z'));
      });

      it('should parse 1:23AM as 1:23AM for UTC', () => {
        const result = readableTimeStringToDate('1:23AM', { date, timezone: 'UTC' });
        expect(result).toBeSameMinuteAs(new Date('2021-08-16T01:23:00.000Z'));
      });

      it('should parse 1:23AM as 1:23AM for America/Chicago', () => {
        const timezone = 'America/Chicago';
        const result = readableTimeStringToDate('1:23AM', { date, timezone: 'America/Chicago' });    // +06:00
        const expectedDay = utcToZonedTime(date, timezone).getDay();
        expect(result).toBeSameMinuteAs(new Date('2021-08-15T06:23:00.000Z'));
        expect(result!.getDay()).toBe(expectedDay);
      });

      it('should parse 1:23AM as 1:23AM for America/New_York', () => {
        const timezone = 'America/New_York';
        const result = readableTimeStringToDate('1:23AM', { date, timezone });    // +05:00
        const expectedDay = utcToZonedTime(date, timezone).getDay();
        expect(result).toBeSameMinuteAs(new Date('2021-08-15T05:23:00.000Z'));
        expect(result!.getDay()).toBe(expectedDay);
      });

    });

  });

});
