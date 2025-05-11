import { hasSameTimezone, isDate, isEqualDate, isISO8601DateString, isISO8601DayString, isMonthDaySlashDate, isUTCDateString, isConsideredUtcTimezoneString, UTC_TIMEZONE_STRING, startOfDayForUTCDateInUTC, startOfDayForSystemDateInUTC, parseISO8601DayStringToUTCDate, isISO8601DayStringStart, monthDaySlashDateToDateString, monthOfYearFromDate, monthOfYearFromDateMonth, makeDateMonthForMonthOfYear, isPast, addMilliseconds, monthOfYearFromUTCDate } from '@dereekb/util';

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

describe('isDate()', () => {
  it('should return true if the input is a Date.', () => {
    expect(isDate(new Date())).toBe(true);
  });

  it('should return false if the input is an object.', () => {
    expect(isDate({})).toBe(false);
  });
});

describe('isEqualDate()', () => {
  it('should return true if the two input dates are equal.', () => {
    expect(isEqualDate(new Date(0), new Date(0))).toBe(true);
  });

  it('should return false if the two input dates are not equal.', () => {
    expect(isEqualDate(new Date(0), new Date(1))).toBe(false);
  });
});

describe('isConsideredUtcTimezoneString()', () => {
  it('should return true for null', () => {
    expect(isConsideredUtcTimezoneString(null)).toBe(true);
  });

  it('should return true for undefined', () => {
    expect(isConsideredUtcTimezoneString(undefined)).toBe(true);
  });

  it('should return true for UTC_TIMEZONE_STRING', () => {
    expect(isConsideredUtcTimezoneString(UTC_TIMEZONE_STRING)).toBe(true);
  });

  it('should return false for other timezone strings', () => {
    expect(isConsideredUtcTimezoneString('America/Denver')).toBe(false);
    expect(isConsideredUtcTimezoneString('Europe/Paris')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isConsideredUtcTimezoneString('')).toBe(false);
  });
});

describe('startOfDayForUTCDateInUTC()', () => {
  it('should return the same date if it is already the start of the day in UTC', () => {
    const date = new Date('2023-01-01T00:00:00.000Z');
    const result = startOfDayForUTCDateInUTC(date);
    expect(result.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should return the start of the day in UTC for a date with time components', () => {
    const date = new Date('2023-01-01T12:34:56.789Z');
    const result = startOfDayForUTCDateInUTC(date);
    expect(result.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should return the start of the day in UTC for a date near the end of the day', () => {
    const date = new Date('2023-01-01T23:59:59.999Z');
    const result = startOfDayForUTCDateInUTC(date);
    expect(result.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should handle dates from different timezones correctly by converting to UTC first', () => {
    // System timezone is America/Los_Angeles (PST/PDT) for this example based on user OS
    // 2023-01-01T10:00:00.000-08:00 is 2023-01-01T18:00:00.000Z
    const dateInNonUTC = new Date('2023-01-01T10:00:00.000-08:00'); // Example: PST
    const result = startOfDayForUTCDateInUTC(dateInNonUTC);
    // The function is expected to consider the UTC date part. So 2023-01-01 in UTC.
    expect(result.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });
});

describe('startOfDayForSystemDateInUTC()', () => {
  it('should return the UTC start of the system local date for a given Date object', () => {
    // Example: Test with a date that is 2 AM UTC on Jan 10, 2023
    const inputDate = new Date('2023-01-10T02:00:00.000Z');

    // Determine the local year, month, and day from inputDate
    // These depend on the timezone of the system running the test.
    const localYear = inputDate.getFullYear();
    const localMonth = inputDate.getMonth(); // 0-indexed
    const localDay = inputDate.getDate();

    // The expected result is a UTC Date at midnight of that local day.
    const expectedDate = new Date(Date.UTC(localYear, localMonth, localDay, 0, 0, 0, 0));

    const result = startOfDayForSystemDateInUTC(inputDate);
    expect(result.toISOString()).toBe(expectedDate.toISOString());
  });

  it('should correctly handle cases where UTC date is different from system local date', () => {
    // Example: Test with a date that is 10 PM UTC on Jan 10, 2023.
    // In a timezone like PST (UTC-8), this would be Jan 10, 2 PM local time.
    // The local date is Jan 10.
    const inputDate1 = new Date('2023-01-10T22:00:00.000Z');
    const localYear1 = inputDate1.getFullYear();
    const localMonth1 = inputDate1.getMonth();
    const localDay1 = inputDate1.getDate();
    const expectedDate1 = new Date(Date.UTC(localYear1, localMonth1, localDay1));
    const result1 = startOfDayForSystemDateInUTC(inputDate1);
    expect(result1.toISOString()).toBe(expectedDate1.toISOString());

    // Example: Test with a date that is 1 AM UTC on Jan 11, 2023.
    // In a timezone like PST (UTC-8), this would be Jan 10, 5 PM local time.
    // The local date is Jan 10.
    const inputDate2 = new Date('2023-01-11T01:00:00.000Z');
    const localYear2 = inputDate2.getFullYear();
    const localMonth2 = inputDate2.getMonth();
    const localDay2 = inputDate2.getDate();
    const expectedDate2 = new Date(Date.UTC(localYear2, localMonth2, localDay2));
    const result2 = startOfDayForSystemDateInUTC(inputDate2);
    expect(result2.toISOString()).toBe(expectedDate2.toISOString());
  });

  it('should return the start of the current system date if given new Date()', () => {
    const now = new Date();
    const localYear = now.getFullYear();
    const localMonth = now.getMonth();
    const localDay = now.getDate();
    const expectedDate = new Date(Date.UTC(localYear, localMonth, localDay));

    const result = startOfDayForSystemDateInUTC(now);
    expect(result.toISOString()).toBe(expectedDate.toISOString());
  });
});

describe('parseISO8601DayStringToUTCDate()', () => {
  it('should parse an ISO8601DayString to a UTC Date at midnight', () => {
    const dayString = '2023-07-15';
    const result = parseISO8601DayStringToUTCDate(dayString);
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe('2023-07-15T00:00:00.000Z');
  });

  it('should correctly parse a date at the beginning of a month', () => {
    const dayString = '2023-01-01';
    const result = parseISO8601DayStringToUTCDate(dayString);
    expect(result.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('should correctly parse a date at the end of a month', () => {
    const dayString = '2024-02-29'; // Leap year
    const result = parseISO8601DayStringToUTCDate(dayString);
    expect(result.toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });
});

describe('isISO8601DayStringStart()', () => {
  it('should return true for a string that is exactly YYYY-MM-DD', () => {
    expect(isISO8601DayStringStart('2023-03-14')).toBe(true);
  });

  it('should return true for a string that starts with YYYY-MM-DD and has trailing characters', () => {
    expect(isISO8601DayStringStart('2023-03-14T10:00:00Z')).toBe(true);
    expect(isISO8601DayStringStart('2023-03-14 and some other text')).toBe(true);
  });

  it('should return false for a string that does not start with YYYY-MM-DD', () => {
    expect(isISO8601DayStringStart('T2023-03-14')).toBe(false);
  });

  it('should return false for an invalid date format at the beginning', () => {
    expect(isISO8601DayStringStart('2023/03/14')).toBe(false);
    expect(isISO8601DayStringStart('23-03-14')).toBe(false);
    expect(isISO8601DayStringStart('2023-3-14')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isISO8601DayStringStart('')).toBe(false);
  });

  it('should return false for a string shorter than YYYY-MM-DD', () => {
    expect(isISO8601DayStringStart('2023-03')).toBe(false);
  });
});

describe('monthDaySlashDateToDateString()', () => {
  it('should convert MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(monthDaySlashDateToDateString('03/15/2023')).toBe('2023-03-15');
  });

  it('should convert M/D/YYYY to YYYY-MM-DD, padding month and day', () => {
    expect(monthDaySlashDateToDateString('3/5/2023')).toBe('2023-03-05');
  });

  it('should convert MM/DD/YY to YYYY-MM-DD, prepending 20 to year', () => {
    expect(monthDaySlashDateToDateString('03/15/23')).toBe('2023-03-15');
  });

  it('should convert M/D/YY to YYYY-MM-DD, padding month/day and prepending 20 to year', () => {
    expect(monthDaySlashDateToDateString('3/5/23')).toBe('2023-03-05');
  });

  it('should handle various single/double digit combinations', () => {
    expect(monthDaySlashDateToDateString('12/1/2024')).toBe('2024-12-01');
    expect(monthDaySlashDateToDateString('1/21/2024')).toBe('2024-01-21');
    expect(monthDaySlashDateToDateString('12/1/24')).toBe('2024-12-01');
    expect(monthDaySlashDateToDateString('1/21/24')).toBe('2024-01-21');
  });
});

describe('monthOfYearFromDate()', () => {
  it('should return 1 for January', () => {
    const date = new Date('2023-01-15T00:00:00.000Z'); // January 15th
    expect(monthOfYearFromDate(date)).toBe(1);
  });

  it('should return 12 for December', () => {
    const date = new Date('2023-12-02T08:00:00.000Z'); // December 1st
    expect(monthOfYearFromDate(date)).toBe(12);
  });

  it('should return 7 for July', () => {
    const date = new Date('2023-07-20T12:00:00.000Z'); // July 20th
    expect(monthOfYearFromDate(date)).toBe(7);
  });

  it('should return the correct month regardless of the day or time', () => {
    const date1 = new Date('2024-05-02T00:00:00.000Z'); // May 1st
    const date2 = new Date('2024-05-28T23:59:59.999Z'); // May 28th
    expect(monthOfYearFromDate(date1)).toBe(5);
    expect(monthOfYearFromDate(date2)).toBe(5);
  });

  it('should return the correct month for dates in different years', () => {
    const date2023 = new Date('2023-11-10');
    const date2025 = new Date('2025-11-25');
    expect(monthOfYearFromDate(date2023)).toBe(11);
    expect(monthOfYearFromDate(date2025)).toBe(11);
  });
});

describe('monthOfYearFromUTCDate()', () => {
  it('should return 1 for January', () => {
    const date = new Date('2023-01-15T00:00:00.000Z'); // January 15th
    expect(monthOfYearFromUTCDate(date)).toBe(1);
  });

  it('should return 12 for December', () => {
    const date = new Date('2023-12-01T08:00:00.000Z'); // December 1st
    expect(monthOfYearFromUTCDate(date)).toBe(12);
  });

  it('should return 7 for July', () => {
    const date = new Date('2023-07-20T12:00:00.000Z'); // July 20th
    expect(monthOfYearFromUTCDate(date)).toBe(7);
  });

  it('should return the correct month regardless of the day or time', () => {
    const date1 = new Date('2024-05-02T00:00:00.000Z'); // May 1st
    const date2 = new Date('2024-05-28T23:59:59.999Z'); // May 28th
    expect(monthOfYearFromUTCDate(date1)).toBe(5);
    expect(monthOfYearFromUTCDate(date2)).toBe(5);
  });

  it('should return the correct month for dates in different years', () => {
    const date2023 = new Date('2023-11-10');
    const date2025 = new Date('2025-11-25');
    expect(monthOfYearFromUTCDate(date2023)).toBe(11);
    expect(monthOfYearFromUTCDate(date2025)).toBe(11);
  });
});

describe('monthOfYearFromDateMonth()', () => {
  it('should convert 0 (JavaScript January) to 1', () => {
    expect(monthOfYearFromDateMonth(0)).toBe(1);
  });

  it('should convert 11 (JavaScript December) to 12', () => {
    expect(monthOfYearFromDateMonth(11)).toBe(12);
  });

  it('should convert 5 (JavaScript June) to 6', () => {
    expect(monthOfYearFromDateMonth(5)).toBe(6);
  });
});

describe('makeDateMonthForMonthOfYear()', () => {
  it('should convert 1 (January) to 0', () => {
    expect(makeDateMonthForMonthOfYear(1)).toBe(0);
  });

  it('should convert 12 (December) to 11', () => {
    expect(makeDateMonthForMonthOfYear(12)).toBe(11);
  });

  it('should convert 6 (June) to 5', () => {
    expect(makeDateMonthForMonthOfYear(6)).toBe(5);
  });
});

describe('isPast()', () => {
  it('should return true for a date in the past', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    expect(isPast(yesterday)).toBe(true);
  });

  it('should return false for a date in the future', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    expect(isPast(tomorrow)).toBe(false);
  });

  it('should return true for a date just a moment ago', () => {
    const aMomentAgo = new Date(Date.now() - 100); // 100 milliseconds ago
    expect(isPast(aMomentAgo)).toBe(true);
  });

  it('should return true for the epoch (January 1, 1970)', () => {
    const epoch = new Date(0);
    expect(isPast(epoch)).toBe(true);
  });

  // It's tricky to test Date.now() itself without a time-mocking library,
  // as execution time can make it immediately past.
  // So we focus on clearly past/future dates.
});

describe('addMilliseconds()', () => {
  const baseTime = new Date('2023-01-01T12:00:00.000Z').getTime();

  it('should add positive milliseconds to a date', () => {
    const date = new Date(baseTime);
    const result = addMilliseconds(date, 1000);
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(baseTime + 1000);
  });

  it('should add negative milliseconds to a date', () => {
    const date = new Date(baseTime);
    const result = addMilliseconds(date, -500);
    expect(result.getTime()).toBe(baseTime - 500);
  });

  it('should add zero milliseconds to a date', () => {
    const date = new Date(baseTime);
    const result = addMilliseconds(date, 0);
    expect(result.getTime()).toBe(baseTime);
  });

  it('should treat null milliseconds as zero', () => {
    const date = new Date(baseTime);
    const result = addMilliseconds(date, null);
    expect(result.getTime()).toBe(baseTime);
  });

  it('should treat undefined milliseconds as zero', () => {
    const date = new Date(baseTime);
    const result = addMilliseconds(date, undefined);
    expect(result.getTime()).toBe(baseTime);
  });

  it('should return null if the input date is null', () => {
    const result = addMilliseconds(null, 1000);
    expect(result).toBeNull();
  });

  it('should return undefined if the input date is undefined', () => {
    const result = addMilliseconds(undefined, 1000);
    expect(result).toBeUndefined();
  });

  it('should not modify the original date object', () => {
    const originalDate = new Date(baseTime);
    const originalTime = originalDate.getTime();
    addMilliseconds(originalDate, 1000);
    expect(originalDate.getTime()).toBe(originalTime);
  });

  it('should return a new Date instance', () => {
    const originalDate = new Date(baseTime);
    const result = addMilliseconds(originalDate, 1000);
    expect(result).not.toBe(originalDate);
  });
});
