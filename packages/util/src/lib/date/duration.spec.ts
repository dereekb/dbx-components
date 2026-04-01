import { MS_IN_DAY, MS_IN_HOUR, MS_IN_MINUTE, MS_IN_SECOND } from './date';
import { convertTimeDuration, hoursAndMinutesToTimeUnit, millisecondsToTimeUnit, timeDurationToHoursAndMinutes, timeDurationToMilliseconds, timeUnitToMilliseconds } from './duration';

describe('timeUnitToMilliseconds()', () => {
  it('should return the input value for milliseconds', () => {
    expect(timeUnitToMilliseconds(500, 'ms')).toBe(500);
  });

  it('should convert seconds to milliseconds', () => {
    expect(timeUnitToMilliseconds(1, 's')).toBe(MS_IN_SECOND);
    expect(timeUnitToMilliseconds(2.5, 's')).toBe(2500);
  });

  it('should convert minutes to milliseconds', () => {
    expect(timeUnitToMilliseconds(1, 'min')).toBe(MS_IN_MINUTE);
    expect(timeUnitToMilliseconds(30, 'min')).toBe(1800000);
  });

  it('should convert hours to milliseconds', () => {
    expect(timeUnitToMilliseconds(1, 'h')).toBe(MS_IN_HOUR);
    expect(timeUnitToMilliseconds(2, 'h')).toBe(7200000);
  });

  it('should convert days to milliseconds', () => {
    expect(timeUnitToMilliseconds(1, 'd')).toBe(MS_IN_DAY);
  });
});

describe('millisecondsToTimeUnit()', () => {
  it('should return the input value for milliseconds', () => {
    expect(millisecondsToTimeUnit(500, 'ms')).toBe(500);
  });

  it('should convert milliseconds to seconds', () => {
    expect(millisecondsToTimeUnit(MS_IN_SECOND, 's')).toBe(1);
    expect(millisecondsToTimeUnit(2500, 's')).toBe(2.5);
  });

  it('should convert milliseconds to minutes', () => {
    expect(millisecondsToTimeUnit(MS_IN_MINUTE, 'min')).toBe(1);
    expect(millisecondsToTimeUnit(1800000, 'min')).toBe(30);
  });

  it('should convert milliseconds to hours', () => {
    expect(millisecondsToTimeUnit(MS_IN_HOUR, 'h')).toBe(1);
    expect(millisecondsToTimeUnit(7200000, 'h')).toBe(2);
  });

  it('should convert milliseconds to days', () => {
    expect(millisecondsToTimeUnit(MS_IN_DAY, 'd')).toBe(1);
  });
});

describe('convertTimeDuration()', () => {
  it('should return the same value when from and to units are the same', () => {
    expect(convertTimeDuration(42, 'min', 'min')).toBe(42);
  });

  it('should convert hours to minutes', () => {
    expect(convertTimeDuration(2, 'h', 'min')).toBe(120);
  });

  it('should convert minutes to hours', () => {
    expect(convertTimeDuration(90, 'min', 'h')).toBe(1.5);
  });

  it('should convert days to hours', () => {
    expect(convertTimeDuration(1, 'd', 'h')).toBe(24);
  });

  it('should convert milliseconds to seconds', () => {
    expect(convertTimeDuration(500, 'ms', 's')).toBe(0.5);
  });

  it('should convert seconds to minutes', () => {
    expect(convertTimeDuration(120, 's', 'min')).toBe(2);
  });
});

describe('timeDurationToMilliseconds()', () => {
  it('should convert a TimeDuration to milliseconds', () => {
    expect(timeDurationToMilliseconds({ amount: 5, unit: 'min' })).toBe(300000);
    expect(timeDurationToMilliseconds({ amount: 1, unit: 'h' })).toBe(MS_IN_HOUR);
  });
});

describe('timeDurationToHoursAndMinutes()', () => {
  it('should convert minutes to hours and minutes', () => {
    const result = timeDurationToHoursAndMinutes({ amount: 90, unit: 'min' });
    expect(result.hour).toBe(1);
    expect(result.minute).toBe(30);
  });

  it('should convert hours to hours and minutes', () => {
    const result = timeDurationToHoursAndMinutes({ amount: 2.5, unit: 'h' });
    expect(result.hour).toBe(2);
    expect(result.minute).toBe(30);
  });

  it('should handle zero', () => {
    const result = timeDurationToHoursAndMinutes({ amount: 0, unit: 'h' });
    expect(result.hour).toBe(0);
    expect(result.minute).toBe(0);
  });
});

describe('hoursAndMinutesToTimeUnit()', () => {
  it('should convert to minutes', () => {
    expect(hoursAndMinutesToTimeUnit({ hour: 1, minute: 30 }, 'min')).toBe(90);
  });

  it('should convert to hours', () => {
    expect(hoursAndMinutesToTimeUnit({ hour: 2, minute: 0 }, 'h')).toBe(2);
  });

  it('should convert to milliseconds', () => {
    expect(hoursAndMinutesToTimeUnit({ hour: 0, minute: 1 }, 'ms')).toBe(MS_IN_MINUTE);
  });
});
