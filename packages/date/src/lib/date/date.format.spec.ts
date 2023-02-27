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
