import { expandDaysForDateRange, getDaysOfWeekInDateRange, isSameDateDay, iterateDaysInDateRange } from '@dereekb/date';
import { Day, isISO8601DateString, isUTCDateString } from '@dereekb/util';
import { parseISO, addMinutes, addDays, endOfWeek, startOfWeek } from 'date-fns';
import { parseJsDateString, readDaysOfWeek } from './date';

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
