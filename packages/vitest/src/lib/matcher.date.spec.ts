import { describe, it, expect, beforeAll } from 'vitest';
import { startOfSecond, addSeconds, startOfMinute, addMinutes, startOfHour, addHours, startOfDay, addDays, startOfWeek, addWeeks, startOfMonth, addMonths, startOfQuarter, addQuarters, startOfYear, addYears } from 'date-fns';
import { type AllDateMatchers, allDateMatchers } from './matcher.date';

// Extend Vitest Matchers
beforeAll(() => {
  expect.extend(allDateMatchers);
});

/*
 * see https://vitest.dev/guide/extending-matchers.html
 */
declare module 'vitest' {
  interface Matchers<T = any> extends AllDateMatchers {}
}

// Tests
describe('Vitest Date Matchers', () => {
  describe('toBeBefore', () => {
    it('should pass when date is before another', () => {
      expect(new Date('1970')).toBeBefore(new Date('2020'));
    });

    it('should fail when date is after another', () => {
      expect(() => expect(new Date('2020')).toBeBefore(new Date('1970'))).toThrow();
    });

    it('should work with .not', () => {
      expect(new Date('2020')).not.toBeBefore(new Date('1970'));
    });
  });

  describe('toBeAfter', () => {
    it('should pass when date is after another', () => {
      expect(new Date('2020')).toBeAfter(new Date('1970'));
    });

    it('should fail when date is before another', () => {
      expect(() => expect(new Date('1970')).toBeAfter(new Date('2020'))).toThrow();
    });

    it('should work with .not', () => {
      expect(new Date('1970')).not.toBeAfter(new Date('2020'));
    });
  });

  describe('toBeSameSecondAs', () => {
    it('should pass when dates are in the same second', () => {
      const date = new Date();
      expect(startOfSecond(date)).toBeSameSecondAs(date);
    });

    it('should fail when dates are not in the same second', () => {
      const date = new Date();
      expect(() => expect(addSeconds(date, 2)).toBeSameSecondAs(date)).toThrow();
    });

    it('should work with .not', () => {
      const date = new Date();
      expect(addSeconds(date, 2)).not.toBeSameSecondAs(date);
    });
  });

  describe('toBeSameMinuteAs', () => {
    it('should pass when dates are in the same minute', () => {
      const date = new Date();
      expect(startOfMinute(date)).toBeSameMinuteAs(date);
    });

    it('should fail when dates are not in the same minute', () => {
      const date = new Date();
      expect(() => expect(addMinutes(date, 2)).toBeSameMinuteAs(date)).toThrow();
    });

    it('should work with .not', () => {
      const date = new Date();
      expect(addMinutes(date, 2)).not.toBeSameMinuteAs(date);
    });
  });

  describe('toBeSameHourAs', () => {
    it('should pass when dates are in the same hour', () => {
      const date = new Date();
      expect(startOfHour(date)).toBeSameHourAs(date);
    });

    it('should fail when dates are not in the same hour', () => {
      const date = new Date();
      expect(() => expect(addHours(date, 2)).toBeSameHourAs(date)).toThrow();
    });

    it('should work with .not', () => {
      const date = new Date();
      expect(addHours(date, 2)).not.toBeSameHourAs(date);
    });
  });

  describe('toBeSameDayAs', () => {
    it('should pass when dates are in the same day', () => {
      const date = new Date();
      expect(startOfDay(date)).toBeSameDayAs(date);
    });

    it('should fail when dates are not in the same day', () => {
      const date = new Date();
      expect(() => expect(addDays(date, 2)).toBeSameDayAs(date)).toThrow();
    });

    it('should work with .not', () => {
      const date = new Date();
      expect(addDays(date, 2)).not.toBeSameDayAs(date);
    });
  });

  describe('toBeSameWeekAs', () => {
    it('should pass when dates are in the same week', () => {
      const date = new Date();
      expect(startOfWeek(date)).toBeSameWeekAs(date);
    });

    it('should fail when dates are not in the same week', () => {
      const date = new Date();
      expect(() => expect(addWeeks(date, 2)).toBeSameWeekAs(date)).toThrow();
    });

    it('should work with .not', () => {
      const date = new Date();
      expect(addWeeks(date, 2)).not.toBeSameWeekAs(date);
    });
  });

  describe('toBeSameMonthAs', () => {
    it('should pass when dates are in the same month', () => {
      const date = new Date();
      expect(startOfMonth(date)).toBeSameMonthAs(date);
    });

    it('should fail when dates are not in the same month', () => {
      const date = new Date();
      expect(() => expect(addMonths(date, 2)).toBeSameMonthAs(date)).toThrow();
    });

    it('should work with .not', () => {
      const date = new Date();
      expect(addMonths(date, 2)).not.toBeSameMonthAs(date);
    });
  });

  describe('toBeSameQuarterAs', () => {
    it('should pass when dates are in the same quarter', () => {
      const date = new Date();
      expect(startOfQuarter(date)).toBeSameQuarterAs(date);
    });

    it('should fail when dates are not in the same quarter', () => {
      const date = new Date();
      expect(() => expect(addQuarters(date, 2)).toBeSameQuarterAs(date)).toThrow();
    });

    it('should work with .not', () => {
      const date = new Date();
      expect(addQuarters(date, 2)).not.toBeSameQuarterAs(date);
    });
  });

  describe('toBeSameYearAs', () => {
    it('should pass when dates are in the same year', () => {
      const date = new Date();
      expect(startOfYear(date)).toBeSameYearAs(date);
    });

    it('should fail when dates are not in the same year', () => {
      const date = new Date();
      expect(() => expect(addYears(date, 2)).toBeSameYearAs(date)).toThrow();
    });

    it('should work with .not', () => {
      const date = new Date();
      expect(addYears(date, 2)).not.toBeSameYearAs(date);
    });
  });

  describe('Weekday Matchers', () => {
    it('toBeMonday should work', () => {
      // January 6, 2025 at noon local time is a Monday
      const monday = new Date('2025-01-06T12:00:00');
      expect(monday).toBeMonday();
      expect(new Date('2025-01-07T12:00:00')).not.toBeMonday();
    });

    it('toBeTuesday should work', () => {
      // January 7, 2025 at noon local time is a Tuesday
      const tuesday = new Date('2025-01-07T12:00:00');
      expect(tuesday).toBeTuesday();
      expect(new Date('2025-01-06T12:00:00')).not.toBeTuesday();
    });

    it('toBeWednesday should work', () => {
      // January 8, 2025 at noon local time is a Wednesday
      const wednesday = new Date('2025-01-08T12:00:00');
      expect(wednesday).toBeWednesday();
      expect(new Date('2025-01-06T12:00:00')).not.toBeWednesday();
    });

    it('toBeThursday should work', () => {
      // January 9, 2025 at noon local time is a Thursday
      const thursday = new Date('2025-01-09T12:00:00');
      expect(thursday).toBeThursday();
      expect(new Date('2025-01-06T12:00:00')).not.toBeThursday();
    });

    it('toBeFriday should work', () => {
      // January 10, 2025 at noon local time is a Friday
      const friday = new Date('2025-01-10T12:00:00');
      expect(friday).toBeFriday();
      expect(new Date('2025-01-06T12:00:00')).not.toBeFriday();
    });

    it('toBeSaturday should work', () => {
      // January 11, 2025 at noon local time is a Saturday
      const saturday = new Date('2025-01-11T12:00:00');
      expect(saturday).toBeSaturday();
      expect(new Date('2025-01-06T12:00:00')).not.toBeSaturday();
    });

    it('toBeSunday should work', () => {
      // January 12, 2025 at noon local time is a Sunday
      const sunday = new Date('2025-01-12T12:00:00');
      expect(sunday).toBeSunday();
      expect(new Date('2025-01-06T12:00:00')).not.toBeSunday();
    });
  });
});
