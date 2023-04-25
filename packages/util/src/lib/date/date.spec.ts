import { isISO8601DateString, isISO8601DayString, isUTCDateString } from '@dereekb/util';

describe('isISO8601DateString()', () => {
  it('should validate date strings', () => {
    expect(isISO8601DateString('2020-04-30T00:00:00.000')).toBe(true);
    expect(isISO8601DateString('2020-04-30T00:00:00.000Z')).toBe(true);
    expect(isISO8601DateString('Sat, 03 Feb 2001 04:05:06 GMT')).toBe(false);
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
    expect(isISO8601DayString('1970-01-01')).toBe(true);
    expect(isISO8601DayString('1970-1-1')).toBe(false);
  });
});
