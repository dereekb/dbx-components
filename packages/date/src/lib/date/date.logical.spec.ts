import { startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { logicalDateStringCodeDateFactory, dateFromLogicalDate, isLogicalDateStringCode } from './date.logical';

describe('date.logical', () => {
  const referenceDate = new Date('2024-06-15T14:30:00Z');

  describe('logicalDateStringCodeDateFactory()', () => {
    it('should return the same date for "now"', () => {
      const factory = logicalDateStringCodeDateFactory('now');
      expect(factory(referenceDate).getTime()).toBe(referenceDate.getTime());
    });

    it('should return start of day for "today_start"', () => {
      const factory = logicalDateStringCodeDateFactory('today_start');
      expect(factory(referenceDate)).toEqual(startOfDay(referenceDate));
    });

    it('should return end of day for "today_end"', () => {
      const factory = logicalDateStringCodeDateFactory('today_end');
      expect(factory(referenceDate)).toEqual(endOfDay(referenceDate));
    });

    it('should return start of week for "this_week_start"', () => {
      const factory = logicalDateStringCodeDateFactory('this_week_start');
      expect(factory(referenceDate)).toEqual(startOfWeek(referenceDate));
    });

    it('should return end of week for "this_week_end"', () => {
      const factory = logicalDateStringCodeDateFactory('this_week_end');
      expect(factory(referenceDate)).toEqual(endOfWeek(referenceDate));
    });

    it('should throw for unknown codes', () => {
      expect(() => logicalDateStringCodeDateFactory('unknown' as any)).toThrow();
    });
  });

  describe('dateFromLogicalDate()', () => {
    it('should resolve a string code to a Date', () => {
      const result = dateFromLogicalDate('today_start', referenceDate);
      expect(result).toEqual(startOfDay(referenceDate));
    });

    it('should return the Date as-is if a Date is passed', () => {
      const result = dateFromLogicalDate(referenceDate);
      expect(result).toBe(referenceDate);
    });

    it('should return undefined for undefined input', () => {
      const result = dateFromLogicalDate(undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('isLogicalDateStringCode()', () => {
    it('should return true for recognized codes', () => {
      expect(isLogicalDateStringCode('now')).toBe(true);
      expect(isLogicalDateStringCode('today_start')).toBe(true);
      expect(isLogicalDateStringCode('today_end')).toBe(true);
      expect(isLogicalDateStringCode('this_week_start')).toBe(true);
      expect(isLogicalDateStringCode('this_week_end')).toBe(true);
    });

    it('should return false for unrecognized strings', () => {
      expect(isLogicalDateStringCode('not_a_code')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isLogicalDateStringCode(undefined)).toBe(false);
    });
  });
});
