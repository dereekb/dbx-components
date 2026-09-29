import { endOfDay } from 'date-fns';
import { dateOrDayStringRangeToDateRange, dateOrDayStringRangeToISO8601DayStringRange, iso8601DayStringRangeParamsToDateRange } from './date.range.string';

describe('date.range.string', () => {
  describe('dateOrDayStringRangeToDateRange()', () => {
    it('should convert string ranges to Date ranges', () => {
      const result = dateOrDayStringRangeToDateRange({
        start: '2024-01-01',
        end: '2024-01-31'
      });
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

  describe('iso8601DayStringRangeParamsToDateRange()', () => {
    it('should read the start and end days in the system timezone', () => {
      const result = iso8601DayStringRangeParamsToDateRange({
        start: '2026-10-14',
        end: '2026-10-20'
      });
      expect(result).toEqual({
        start: new Date(2026, 9, 14),
        end: endOfDay(new Date(2026, 9, 20))
      });
    });

    it('should cover just the start day when there is no end', () => {
      const result = iso8601DayStringRangeParamsToDateRange({
        start: '2026-10-14',
        end: null
      });
      expect(result).toEqual({
        start: new Date(2026, 9, 14),
        end: endOfDay(new Date(2026, 9, 14))
      });
    });

    it('should cover just the start day when the end is malformed', () => {
      const result = iso8601DayStringRangeParamsToDateRange({
        start: '2026-10-14',
        end: 'next-week'
      });
      expect(result?.end).toEqual(endOfDay(new Date(2026, 9, 14)));
    });

    it('should cover just the start day when the end is before the start', () => {
      const result = iso8601DayStringRangeParamsToDateRange({
        start: '2026-10-20',
        end: '2026-10-14'
      });
      expect(result).toEqual({
        start: new Date(2026, 9, 20),
        end: endOfDay(new Date(2026, 9, 20))
      });
    });

    it('should return undefined when there is no start', () => {
      expect(iso8601DayStringRangeParamsToDateRange({ end: '2026-10-20' })).toBeUndefined();
      expect(iso8601DayStringRangeParamsToDateRange(undefined)).toBeUndefined();
    });

    it('should return undefined when the start is not a valid day string', () => {
      expect(iso8601DayStringRangeParamsToDateRange({ start: 'tomorrow' })).toBeUndefined();
      expect(iso8601DayStringRangeParamsToDateRange({ start: '2026-13-45' })).toBeUndefined();
    });

    it('should ignore values that are not strings', () => {
      expect(
        iso8601DayStringRangeParamsToDateRange({
          start: ['2026-10-14'] as unknown as string
        })
      ).toBeUndefined();
    });

    it('should round trip with dateOrDayStringRangeToISO8601DayStringRange()', () => {
      const dateRange = {
        start: new Date(2026, 9, 14),
        end: endOfDay(new Date(2026, 9, 20))
      };
      const params = dateOrDayStringRangeToISO8601DayStringRange(dateRange);

      expect(params).toEqual({ start: '2026-10-14', end: '2026-10-20' });
      expect(iso8601DayStringRangeParamsToDateRange(params)).toEqual(dateRange);
    });
  });
});
