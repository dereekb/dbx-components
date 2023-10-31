import { hasSameTimezone, isISO8601DateString, isISO8601DayString, isMonthDaySlashDate, isUTCDateString } from '@dereekb/util';

describe('hasSameTimezone', () => {
  it('should return true if both timezone refs have the same timezone.', () => {
    const a = { timezone: 'UTC' };
    const b = { timezone: 'UTC' };

    expect(hasSameTimezone(a, b)).toBe(true);
  });

  it('should return true if both timezone refs have the same undefined timezone.', () => {
    const a = { timezone: undefined };
    const b = {};

    expect(hasSameTimezone(a, b)).toBe(true);
  });

  it('should return true if both timezone refs are null/undefined', () => {
    const a = null;
    const b = undefined;

    expect(hasSameTimezone(a, b)).toBe(true);
  });

  it('should return false if both timezone refs do not have the same timezone.', () => {
    const a = { timezone: 'UTC' };
    const b = { timezone: 'America/Denver' };

    expect(hasSameTimezone(a, b)).toBe(false);
  });

  it('should return false if one input is null and the other is defined', () => {
    const a = { timezone: 'UTC' };
    const b = null;

    expect(hasSameTimezone(a, b)).toBe(false);
  });
});

describe('isISO8601DateString()', () => {
  it('should validate date strings', () => {
    expect(isISO8601DateString('2020-04-30T00:00:00.000')).toBe(true);
    expect(isISO8601DateString('2020-04-30T00:00:00.000Z')).toBe(true);
    expect(isISO8601DateString('Sat, 03 Feb 2001 04:05:06 GMT')).toBe(false);
  });

  it('should validate date strings with more than 4 digits', () => {
    expect(isISO8601DateString('20202020-04-30T00:00:00.000')).toBe(true);
  });
});

describe('isUTCDateString()', () => {
  it('should validate date strings', () => {
    expect(isUTCDateString('Sat, 03 Feb 2001 04:05:06 GMT')).toBe(true);
    expect(isUTCDateString('Tue, 14 Mar 2023 12:34:56 UTC')).toBe(true);
    expect(isUTCDateString('Wed, 25 May 2024 20:45:07 EST')).toBe(true);
    expect(isUTCDateString('2020-04-30T00:00:00.000Z')).toBe(false);
  });
});

describe('isISO8601DayString()', () => {
  it('should validate day strings', () => {
    expect(isISO8601DayString('221970-01-01')).toBe(true);
    expect(isISO8601DayString('1970-01-01')).toBe(true);
    expect(isISO8601DayString('1970-1-1')).toBe(false);
  });
});

describe('isMonthDaySlashDate()', () => {
  it('should not validate non-date strings', () => {
    expect(isMonthDaySlashDate('11/')).toBe(false);
    expect(isMonthDaySlashDate('01/01')).toBe(false);
    expect(isMonthDaySlashDate('1/1')).toBe(false);
  });

  it('should validate the short year string', () => {
    expect(isMonthDaySlashDate('1/1/22')).toBe(true);
    expect(isMonthDaySlashDate('01/01/22')).toBe(true);
  });

  it('should validate the long year string', () => {
    const result = isMonthDaySlashDate('01/01/1970');
    expect(result).toBe(true);
  });
});
