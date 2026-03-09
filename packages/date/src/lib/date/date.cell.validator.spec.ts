import { type } from 'arktype';
import { setMinutes, setHours, addSeconds } from 'date-fns';
import { dateCellTiming, type DateCellTiming, isValidDateCellTiming } from './date.cell';
import { type DateCellRange } from './date.cell.index';
import { validDateCellTimingType, validDateCellRangeType, validDateCellRangeSeriesType } from './date.cell.validator';
import { wrapDateTests } from '../../test.spec';

wrapDateTests(() => {
  describe('validDateCellTimingType', () => {
    const startsAt = setMinutes(setHours(new Date(), 12), 0);
    const validTiming = dateCellTiming({ startsAt, duration: 60 }, 1);

    it('should pass valid timings.', () => {
      const result = validDateCellTimingType(validTiming);
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('should fail on invalid timings', () => {
      const invalidTiming: DateCellTiming = { ...validTiming, startsAt: addSeconds(validTiming.start, 10) };
      const result = validDateCellTimingType(invalidTiming);
      expect(result).toBeInstanceOf(type.errors);
    });

    describe('scenario', () => {
      const timezone = 'America/Chicago';

      it('should validate a valid timing object', () => {
        const timing: DateCellTiming = {
          timezone,
          end: new Date('2023-12-21T22:30:00.000Z'),
          startsAt: new Date('2023-08-15T13:30:00.000Z'),
          duration: 480
        };

        const isValid = isValidDateCellTiming(timing);
        expect(isValid).toBe(true);

        const result = validDateCellTimingType(timing);
        expect(result).not.toBeInstanceOf(type.errors);
      });
    });
  });

  describe('validDateCellRangeType', () => {
    it('should pass valid ranges.', () => {
      const result = validDateCellRangeType({ i: 0 });
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('should fail on invalid ranges', () => {
      const invalidRange: DateCellRange = { i: -1 };
      const result = validDateCellRangeType(invalidRange);
      expect(result).toBeInstanceOf(type.errors);
    });
  });

  describe('validDateCellTimingType used in merge', () => {
    const testType = type({
      timing: validDateCellTimingType,
      name: 'string'
    });

    it('should validate an object with a valid timing property.', () => {
      const startsAt = setMinutes(setHours(new Date(), 12), 0);
      const validTiming = dateCellTiming({ startsAt, duration: 60 }, 1);
      const result = testType({ timing: validTiming, name: 'test' });
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('should fail when the timing property is invalid.', () => {
      const result = testType({ timing: { startsAt: new Date(), duration: -1, end: new Date(), timezone: 'America/Chicago' }, name: 'test' });
      expect(result).toBeInstanceOf(type.errors);
    });
  });

  describe('validDateCellRangeType used in merge', () => {
    const testType = type({
      range: validDateCellRangeType,
      name: 'string'
    });

    it('should validate an object with a valid range property.', () => {
      const result = testType({ range: { i: 0, to: 5 }, name: 'test' });
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('should fail when the range property is invalid.', () => {
      const result = testType({ range: { i: 5, to: 0 }, name: 'test' });
      expect(result).toBeInstanceOf(type.errors);
    });
  });

  describe('validDateCellRangeSeriesType used in merge', () => {
    const testType = type({
      ranges: validDateCellRangeSeriesType,
      name: 'string'
    });

    it('should validate an object with a valid range series property.', () => {
      const result = testType({ ranges: [{ i: 0 }, { i: 1 }], name: 'test' });
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('should fail when the range series property is invalid.', () => {
      const result = testType({ ranges: [{ i: 0, to: 0 }, { i: 0 }], name: 'test' });
      expect(result).toBeInstanceOf(type.errors);
    });
  });

  describe('validDateCellRangeSeriesType', () => {
    it('should pass a valid range series.', () => {
      const result = validDateCellRangeSeriesType([{ i: 0 }]);
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('should fail on invalid ranges', () => {
      const invalidRange: DateCellRange[] = [{ i: 0, to: 0 }, { i: 0 }];
      const result = validDateCellRangeSeriesType(invalidRange);
      expect(result).toBeInstanceOf(type.errors);
    });
  });
});
