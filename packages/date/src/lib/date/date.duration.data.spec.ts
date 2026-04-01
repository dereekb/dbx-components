import { MS_IN_DAY, MS_IN_HOUR, MS_IN_MINUTE, MS_IN_SECOND, MS_IN_WEEK } from '@dereekb/util';
import { durationDataToMilliseconds, formatDurationString, formatDurationStringLong, getDurationDataValue, millisecondsToDurationData, parseDurationString, parseDurationStringToMilliseconds, setDurationDataValue, timeDurationDataIsEmpty, type TimeDurationData } from './date.duration.data';

// MARK: timeDurationDataIsEmpty
describe('timeDurationDataIsEmpty()', () => {
  it('should return true for an empty object', () => {
    expect(timeDurationDataIsEmpty({})).toBe(true);
  });

  it('should return true when all fields are zero', () => {
    expect(timeDurationDataIsEmpty({ hours: 0, minutes: 0, seconds: 0 })).toBe(true);
  });

  it('should return false when any field is non-zero', () => {
    expect(timeDurationDataIsEmpty({ hours: 1 })).toBe(false);
    expect(timeDurationDataIsEmpty({ minutes: 5 })).toBe(false);
    expect(timeDurationDataIsEmpty({ milliseconds: 100 })).toBe(false);
  });
});

// MARK: durationDataToMilliseconds
describe('durationDataToMilliseconds()', () => {
  it('should return 0 for an empty object', () => {
    expect(durationDataToMilliseconds({})).toBe(0);
  });

  it('should convert hours and minutes', () => {
    expect(durationDataToMilliseconds({ hours: 1, minutes: 30 })).toBe(MS_IN_HOUR + 30 * MS_IN_MINUTE);
  });

  it('should convert days and hours', () => {
    expect(durationDataToMilliseconds({ days: 1, hours: 2 })).toBe(MS_IN_DAY + 2 * MS_IN_HOUR);
  });

  it('should convert weeks', () => {
    expect(durationDataToMilliseconds({ weeks: 1 })).toBe(MS_IN_WEEK);
  });

  it('should convert all units', () => {
    const data: TimeDurationData = { weeks: 1, days: 2, hours: 3, minutes: 4, seconds: 5, milliseconds: 6 };
    const expected = MS_IN_WEEK + 2 * MS_IN_DAY + 3 * MS_IN_HOUR + 4 * MS_IN_MINUTE + 5 * MS_IN_SECOND + 6;
    expect(durationDataToMilliseconds(data)).toBe(expected);
  });
});

// MARK: millisecondsToDurationData
describe('millisecondsToDurationData()', () => {
  it('should decompose hours and minutes with default units', () => {
    const result = millisecondsToDurationData(MS_IN_HOUR + 30 * MS_IN_MINUTE);
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(30);
    expect(result.seconds).toBe(0);
    expect(result.days).toBe(0);
  });

  it('should decompose into days', () => {
    const result = millisecondsToDurationData(2 * MS_IN_DAY + 3 * MS_IN_HOUR);
    expect(result.days).toBe(2);
    expect(result.hours).toBe(3);
  });

  it('should use only specified units', () => {
    const result = millisecondsToDurationData(90 * MS_IN_SECOND, ['min', 's']);
    expect(result.minutes).toBe(1);
    expect(result.seconds).toBe(30);
    expect(result.hours).toBeUndefined();
    expect(result.days).toBeUndefined();
  });

  it('should decompose into weeks when specified', () => {
    const result = millisecondsToDurationData(MS_IN_WEEK + 2 * MS_IN_DAY, ['w', 'd']);
    expect(result.weeks).toBe(1);
    expect(result.days).toBe(2);
  });
});

// MARK: getDurationDataValue / setDurationDataValue
describe('getDurationDataValue()', () => {
  it('should return the value for a unit', () => {
    expect(getDurationDataValue({ hours: 5 }, 'h')).toBe(5);
    expect(getDurationDataValue({ minutes: 30 }, 'min')).toBe(30);
  });

  it('should return 0 for unset units', () => {
    expect(getDurationDataValue({}, 'h')).toBe(0);
  });
});

describe('setDurationDataValue()', () => {
  it('should set the value for a unit', () => {
    const result = setDurationDataValue({ hours: 1 }, 'min', 30);
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(30);
  });

  it('should allow negative values', () => {
    const result = setDurationDataValue({}, 'h', -5);
    expect(result.hours).toBe(-5);
  });
});

// MARK: parseDurationString
describe('parseDurationString()', () => {
  it('should parse compact format "3d10h5m8s"', () => {
    const result = parseDurationString('3d10h5m8s');
    expect(result.days).toBe(3);
    expect(result.hours).toBe(10);
    expect(result.minutes).toBe(5);
    expect(result.seconds).toBe(8);
  });

  it('should parse spaced compact format "3d 10h 5m 8s"', () => {
    const result = parseDurationString('3d 10h 5m 8s');
    expect(result.days).toBe(3);
    expect(result.hours).toBe(10);
    expect(result.minutes).toBe(5);
    expect(result.seconds).toBe(8);
  });

  it('should parse long format "2 hours 30 minutes"', () => {
    const result = parseDurationString('2 hours 30 minutes');
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(30);
  });

  it('should parse singular long format "1 hour 1 minute"', () => {
    const result = parseDurationString('1 hour 1 minute');
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(1);
  });

  it('should parse weeks "1w 2d"', () => {
    const result = parseDurationString('1w 2d');
    expect(result.weeks).toBe(1);
    expect(result.days).toBe(2);
  });

  it('should parse milliseconds "500ms"', () => {
    const result = parseDurationString('500ms');
    expect(result.milliseconds).toBe(500);
  });

  it('should parse "2m 30s"', () => {
    const result = parseDurationString('2m 30s');
    expect(result.minutes).toBe(2);
    expect(result.seconds).toBe(30);
  });

  it('should parse short labels "2hr 30min"', () => {
    const result = parseDurationString('2hr 30min');
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(30);
  });

  it('should parse "3 hours"', () => {
    const result = parseDurationString('3 hours');
    expect(result.hours).toBe(3);
  });

  it('should sum duplicate units "1h 30m 1h"', () => {
    const result = parseDurationString('1h 30m 1h');
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(30);
  });

  it('should treat a plain number as milliseconds', () => {
    const result = parseDurationString('5000');
    expect(result.milliseconds).toBe(5000);
  });

  it('should return empty for empty string', () => {
    const result = parseDurationString('');
    expect(timeDurationDataIsEmpty(result)).toBe(true);
  });

  it('should parse decimal values "1.5h"', () => {
    const result = parseDurationString('1.5h');
    expect(result.hours).toBe(1.5);
  });

  it('should parse "2 weeks"', () => {
    const result = parseDurationString('2 weeks');
    expect(result.weeks).toBe(2);
  });

  it('should parse "5 sec"', () => {
    const result = parseDurationString('5 sec');
    expect(result.seconds).toBe(5);
  });
});

// MARK: parseDurationStringToMilliseconds
describe('parseDurationStringToMilliseconds()', () => {
  it('should parse and convert to milliseconds', () => {
    expect(parseDurationStringToMilliseconds('1h30m')).toBe(MS_IN_HOUR + 30 * MS_IN_MINUTE);
  });

  it('should handle "1d"', () => {
    expect(parseDurationStringToMilliseconds('1d')).toBe(MS_IN_DAY);
  });
});

// MARK: formatDurationString
describe('formatDurationString()', () => {
  it('should format compact string', () => {
    expect(formatDurationString({ days: 3, hours: 10, minutes: 5, seconds: 8 })).toBe('3d10h5m8s');
  });

  it('should omit zero values', () => {
    expect(formatDurationString({ hours: 2, minutes: 30 })).toBe('2h30m');
  });

  it('should return "0s" for empty data', () => {
    expect(formatDurationString({})).toBe('0s');
  });

  it('should format weeks', () => {
    expect(formatDurationString({ weeks: 1, days: 2 })).toBe('1w2d');
  });

  it('should format milliseconds', () => {
    expect(formatDurationString({ milliseconds: 500 })).toBe('500ms');
  });
});

// MARK: formatDurationStringLong
describe('formatDurationStringLong()', () => {
  it('should format long string', () => {
    expect(formatDurationStringLong({ days: 3, hours: 10 })).toBe('3 days 10 hours');
  });

  it('should use singular for value of 1', () => {
    expect(formatDurationStringLong({ hours: 1, minutes: 1 })).toBe('1 hour 1 minute');
  });

  it('should return "0 seconds" for empty data', () => {
    expect(formatDurationStringLong({})).toBe('0 seconds');
  });
});
