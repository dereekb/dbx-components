import { addDays, addHours } from 'date-fns';
import { dateRangeOverlapsDateRangeFunction, isDateInDateRangeFunction, isDateRangeInDateRangeFunction } from './date.range';

describe('isDateInDateRangeFunction()', () => {
  describe('function', () => {
    const dateRange = { start: new Date(0), end: addDays(new Date(0), 1) };
    const isInDateRange = isDateInDateRangeFunction(dateRange);

    it('should return true if the date is contained within the range.', () => {
      expect(isInDateRange(new Date(2))).toBe(true);
    });

    it('should return false if the date is not contained within the range.', () => {
      expect(isInDateRange(addDays(new Date(0), 2))).toBe(false);
    });

    it('should return true if the start is used as input.', () => {
      expect(isInDateRange(dateRange.start)).toBe(true);
    });

    it('should return true if the end is used as input.', () => {
      expect(isInDateRange(dateRange.end)).toBe(true);
    });
  });
});

describe('isDateRangeInDateRangeFunction()', () => {
  describe('function', () => {
    const dateRange = { start: new Date(0), end: addDays(new Date(0), 1) };
    const isInDateRange = isDateRangeInDateRangeFunction(dateRange);

    it('should return true if the dateRange is contained within the range entirely.', () => {
      const containedDateRange = { start: new Date(1), end: new Date(2) };
      expect(isInDateRange(containedDateRange)).toBe(true);
    });

    it('should return false if the dateRange is not contained within the range entirely.', () => {
      const containedDateRange = { start: new Date(0), end: addDays(new Date(0), 2) };
      expect(isInDateRange(containedDateRange)).toBe(false);
    });

    it('should return true if the same dateRange is used as input.', () => {
      expect(isInDateRange(dateRange)).toBe(true);
    });
  });
});

describe('dateRangeOverlapsDateRangeFunction()', () => {
  describe('function', () => {
    const dateRange = { start: new Date(0), end: addDays(new Date(0), 1) };
    const overlapsDateRange = dateRangeOverlapsDateRangeFunction(dateRange);

    it('should return false if the dateRange is before range.', () => {
      const containedDateRange = { start: new Date(-10), end: new Date(-2) };
      expect(overlapsDateRange(containedDateRange)).toBe(false);
    });

    it('should return false if the dateRange is after the range.', () => {
      const containedDateRange = { start: addHours(dateRange.end, 1), end: addHours(dateRange.end, 2) };
      expect(overlapsDateRange(containedDateRange)).toBe(false);
    });

    it('should return true if the dateRange is contained within the range.', () => {
      const containedDateRange = { start: new Date(1), end: new Date(2) };
      expect(overlapsDateRange(containedDateRange)).toBe(true);
    });

    it('should return true if the dateRange overlaps the other date range entirely.', () => {
      const containedDateRange = { start: new Date(0), end: addDays(new Date(0), 2) };
      expect(overlapsDateRange(containedDateRange)).toBe(true);
    });

    it('should return true if the dateRange overlaps the other date range partially at the start.', () => {
      const containedDateRange = { start: new Date(-1), end: addHours(new Date(0), 1) };
      expect(overlapsDateRange(containedDateRange)).toBe(true);
    });

    it('should return true if the dateRange overlaps the other date range partially at the end.', () => {
      const containedDateRange = { start: addHours(dateRange.end, -1), end: addHours(dateRange.end, 1) };
      expect(overlapsDateRange(containedDateRange)).toBe(true);
    });

    it('should return true if the same dateRange is used as input.', () => {
      expect(overlapsDateRange(dateRange)).toBe(true);
    });
  });
});
