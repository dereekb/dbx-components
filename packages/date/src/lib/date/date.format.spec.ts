import { addDays, addHours, addMinutes } from 'date-fns';
import { DateRange, formatDateRangeDistance } from '@dereekb/date';
import { formatDateRangeFunction, formatToDayRangeString, formatToShortDateString } from './date.format';

describe('formatDateRangeFunction', () => {
  describe('function', () => {
    const date = `2023-02-27`;
    const start = new Date(`${date}T00:00`);
    const end = start;

    it('should format the input date range using the input function.', () => {
      const formatValue = 'a';
      const formatFn = () => formatValue;
      const fn = formatDateRangeFunction(formatFn);

      const result = fn({ start, end });
      expect(result).toBe(`${formatValue} - ${formatValue}`);
    });

    it('should format the input date range using the input function and separator', () => {
      const formatValue = 'a';
      const separator = '/';
      const formatFn = () => formatValue;
      const fn = formatDateRangeFunction({ format: formatFn, separator });

      const result = fn({ start, end });
      expect(result).toBe(`${formatValue} ${separator} ${formatValue}`);
    });

    it('should format the input date range using the input function.', () => {
      const formatFn = formatToShortDateString;
      const fn = formatDateRangeFunction(formatFn);

      const result = fn(start, end);
      expect(result).toBe(`${formatToShortDateString(start)} - ${formatToShortDateString(end)}`);
    });

    it('should format the input date range using the input function.', () => {
      const formatFn = formatToShortDateString;
      const separator = '/';
      const fn = formatDateRangeFunction({ format: formatFn, separator });

      const result = fn({ start, end });
      expect(result).toBe(`${formatToShortDateString(start)} ${separator} ${formatToShortDateString(end)}`);
    });
  });
});

describe('formatDateRangeDistanceFunction', () => {
  describe('function', () => {
    const date = `2023-02-27`;
    const start = new Date(`${date}T00:00`);

    describe('1 hour distance', () => {
      const end = addHours(start, 1);
      const range: DateRange = { start, end };

      it('should format the distance.', () => {
        const result = formatDateRangeDistance(range, {});
        expect(result).toBe('about 1 hour');
      });

      describe('strict', () => {
        it('should format the distance in hours by default.', () => {
          const result = formatDateRangeDistance(range, { strict: true });
          expect(result).toBe('1 hour');
        });

        it('should format the distance in minutes.', () => {
          const result = formatDateRangeDistance(range, { strict: true, unit: 'minute' });
          expect(result).toBe('60 minutes');
        });
      });
    });

    describe('1 hour, 30 minute distance', () => {
      const end = addMinutes(addHours(start, 1), 30);
      const range: DateRange = { start, end };

      it('should format the distance.', () => {
        const result = formatDateRangeDistance(range, {});
        expect(result).toBe('about 2 hours');
      });
      describe('strict', () => {
        it('should format the distance in hours by default.', () => {
          const result = formatDateRangeDistance(range, { strict: true });
          expect(result).toBe('2 hours');
        });

        it('should format the distance while rounding down.', () => {
          const result = formatDateRangeDistance(range, { strict: true, roundingMethod: 'floor' });
          expect(result).toBe('1 hour');
        });

        it('should format the distance in minutes.', () => {
          const result = formatDateRangeDistance(range, { strict: true, unit: 'minute' });
          expect(result).toBe('90 minutes');
        });
      });
    });

    describe('1 day distance', () => {
      const end = addDays(start, 1);
      const range: DateRange = { start, end };

      it('should format the distance.', () => {
        const result = formatDateRangeDistance(range, {});
        expect(result).toBe('1 day');
      });

      describe('strict', () => {
        it('should format the distance in days by default.', () => {
          const result = formatDateRangeDistance(range, { strict: true });
          expect(result).toBe('1 day');
        });

        it('should format the distance in hours.', () => {
          const result = formatDateRangeDistance(range, { strict: true, unit: 'hour' });
          expect(result).toBe('24 hours');
        });

        it('should format the distance in minutes.', () => {
          const result = formatDateRangeDistance(range, { strict: true, unit: 'minute' });
          expect(result).toBe('1440 minutes');
        });
      });
    });

    describe('1 day, 6 hour distance distance', () => {
      const end = addHours(addDays(start, 1), 6);
      const range: DateRange = { start, end };

      it('should format the distance.', () => {
        const result = formatDateRangeDistance(range, {});
        expect(result).toBe('1 day');
      });

      describe('strict', () => {
        it('should format the distance in days by default.', () => {
          const result = formatDateRangeDistance(range, { strict: true });
          expect(result).toBe('1 day');
        });

        it('should format the distance in hours.', () => {
          const result = formatDateRangeDistance(range, { strict: true, unit: 'hour' });
          expect(result).toBe('30 hours');
        });

        it('should format the distance in minutes.', () => {
          const result = formatDateRangeDistance(range, { strict: true, unit: 'minute' });
          expect(result).toBe('1800 minutes');
        });

        describe('onlyTimeRange=true', () => {
          it('should format the distance in hours.', () => {
            const result = formatDateRangeDistance(range, { strict: true, onlyTimeRange: true, unit: 'hour' });
            expect(result).toBe('6 hours');
          });
        });
      });
    });
  });
});

describe('formatToDayRangeString()', () => {
  const date = `2023-02-27`;
  const endDate = `2023-02-28`;
  const start = new Date(`${date}T00:00`);
  const end = new Date(`${endDate}T00:00`);
  const dateRange: DateRange = { start, end };

  const expectedString = `${formatToShortDateString(start)} - ${formatToShortDateString(end)}`;

  it('should format a DateRange', () => {
    const result = formatToDayRangeString(start, end);
    expect(result).toBe(expectedString);
  });

  it('should format a pair of Dates', () => {
    const result = formatToDayRangeString(dateRange);
    expect(result).toBe(expectedString);
  });

  it('should format a single Date', () => {
    const result = formatToDayRangeString(start);
    expect(result).toBe(formatToShortDateString(start));
  });
});
