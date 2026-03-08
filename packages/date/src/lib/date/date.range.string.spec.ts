import { dateOrDayStringRangeToDateRange, dateOrDayStringRangeToISO8601DayStringRange } from './date.range.string';

describe('date.range.string', () => {
  describe('dateOrDayStringRangeToDateRange()', () => {
    it('should convert string ranges to Date ranges', () => {
      const result = dateOrDayStringRangeToDateRange({ start: '2024-01-01', end: '2024-01-31' });
      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
    });

    it('should convert Date values through to the result', () => {
      const start = new Date('2024-01-01T00:00:00');
      const end = new Date('2024-01-31T00:00:00');
      const result = dateOrDayStringRangeToDateRange({ start, end });
      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
    });
  });

  describe('dateOrDayStringRangeToISO8601DayStringRange()', () => {
    it('should convert Date ranges to ISO day string ranges', () => {
      const result = dateOrDayStringRangeToISO8601DayStringRange({
        start: new Date('2024-06-15T10:00:00'),
        end: new Date('2024-06-20T10:00:00')
      });
      expect(typeof result.start).toBe('string');
      expect(typeof result.end).toBe('string');
    });

    it('should pass through string values', () => {
      const result = dateOrDayStringRangeToISO8601DayStringRange({
        start: '2024-01-01',
        end: '2024-01-31'
      });
      expect(result.start).toBe('2024-01-01');
      expect(result.end).toBe('2024-01-31');
    });
  });
});
