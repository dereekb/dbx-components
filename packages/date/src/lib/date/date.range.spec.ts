import { itShouldFail, expectFail } from '@dereekb/util/test';
import { startOfDay, addDays, addHours, addWeeks, startOfWeek, endOfWeek, endOfDay } from 'date-fns';
import { clampDateFunction, clampDateRangeFunction, dateRange, dateRangeOverlapsDateRangeFunction, DateRangeType, expandDaysForDateRangeFunction, fitDateRangeToDayPeriod, isDateInDateRangeFunction, isDateRangeInDateRangeFunction, isSameDateDayRange, iterateDaysInDateRangeFunction, transformDateRangeToTimezoneFunction } from './date.range';

describe('dateRange()', () => {
  describe('week', () => {
    const utc2022Week1StartDate = new Date('2021-12-26T00:00:00.000'); // date in current timezone

    it('should generate a week range', () => {
      const expectedStart = startOfWeek(utc2022Week1StartDate);
      const expectedEnd = endOfWeek(utc2022Week1StartDate);

      const result = dateRange({ type: DateRangeType.WEEK, date: utc2022Week1StartDate });
      expect(result.start).toBeSameSecondAs(expectedStart);
      expect(result.end).toBeSameSecondAs(expectedEnd);
    });

    it('should generate a week range for the current week', () => {
      const today = new Date();
      const expectedStart = startOfWeek(today);
      const expectedEnd = endOfWeek(today);

      const result = dateRange(DateRangeType.WEEK);
      expect(result.start).toBeSameSecondAs(expectedStart);
      expect(result.end).toBeSameSecondAs(expectedEnd);
    });

    it('should generate a day range', () => {
      const expectedStart = startOfDay(utc2022Week1StartDate);
      const expectedEnd = endOfDay(utc2022Week1StartDate);

      const result = dateRange({ type: DateRangeType.DAY, date: utc2022Week1StartDate });
      expect(result.start).toBeSameSecondAs(expectedStart);
      expect(result.end).toBeSameSecondAs(expectedEnd);
    });

    it('should generate a day range for the current day', () => {
      const today = new Date();
      const expectedStart = startOfDay(today);
      const expectedEnd = endOfDay(today);

      const result = dateRange(DateRangeType.DAY);
      expect(result.start).toBeSameSecondAs(expectedStart);
      expect(result.end).toBeSameSecondAs(expectedEnd);
    });
  });
});

describe('isSameDateDayRange()', () => {
  const dateAString = '2020-04-30T00:00:00.000';
  const dateA = new Date(dateAString);

  const dateBString = '2020-05-30T00:00:00.000'; // month after
  const dateB = new Date(dateBString);

  it('should return true for both null', () => {
    expect(isSameDateDayRange(null, null)).toBe(true);
  });

  it('should return true for both null or undefined', () => {
    expect(isSameDateDayRange(null, undefined)).toBe(true);
  });

  it('should return false for a range and a null value', () => {
    const range = { start: dateA, end: dateB };
    expect(isSameDateDayRange(range, null)).toBe(false);
  });

  it('should return true for the same range', () => {
    const range = { start: dateA, end: dateB };
    expect(isSameDateDayRange(range, range)).toBe(true);
  });

  it('should return true for the same range with different times', () => {
    const range = { start: dateA, end: dateB };
    expect(isSameDateDayRange(range, { ...range, end: addHours(dateB, 8) })).toBe(true);
  });

  it('should return false for a range with different dates', () => {
    const range = { start: dateA, end: dateB };
    expect(isSameDateDayRange(range, { start: dateA, end: dateA })).toBe(false);
  });
});

describe('iterateDaysInDateRangeFunction()', () => {
  describe('function', () => {
    describe('maxIterations', () => {
      it('should only iterate to the maximum number of iterations when throwErrorOnMaxIterations=false', () => {
        const maxIterations = 10;
        const fn = iterateDaysInDateRangeFunction({
          maxIterations,
          throwErrorOnMaxIterations: false, // don't throw the error
          getNextDate: (x) => addDays(x, 1)
        });

        const result = fn({ start: new Date(), end: addWeeks(new Date(), 20) }, (x) => x);
        expect(result.length).toBe(maxIterations);
      });

      itShouldFail('should throw an error after reaching the maximum number of iterations by default', () => {
        const maxIterations = 10;
        const fn = iterateDaysInDateRangeFunction({
          maxIterations,
          getNextDate: (x) => addDays(x, 1)
        });

        expectFail(() => fn({ start: new Date(), end: addWeeks(new Date(), 20) }, (x) => x));
      });
    });
  });
});

describe('expandDaysForDateRangeFunction()', () => {
  describe('function', () => {
    const expandFn = expandDaysForDateRangeFunction({});

    it('should expand the range to an array of days', () => {
      const days = 3;
      const start = startOfDay(new Date());
      const end = addDays(start, days - 1);

      const result = expandFn({ start, end });
      expect(result.length).toBe(days);

      expect(result[0]).toBeSameSecondAs(start);
      expect(result[1]).toBeSameSecondAs(addDays(start, 1));
      expect(result[2]).toBeSameSecondAs(addDays(addDays(start, 1), 1));
      expect(result[2]).toBeSameSecondAs(end);
    });

    it('should expand the dateRange', () => {
      const distance = 3;
      const { start, end } = dateRange({ date: new Date(), distance, type: DateRangeType.DAYS_RANGE });

      const result = expandFn({ start, end });
      expect(result.length).toBe(distance + 1);

      expect(result[0]).toBeSameSecondAs(start);
      expect(result[1]).toBeSameSecondAs(addDays(start, 1));
      expect(result[2]).toBeSameSecondAs(addDays(addDays(start, 1), 1));
      expect(result[3]).toBeSameSecondAs(addDays(addDays(addDays(start, 1), 1), 1));
    });
  });
});

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

    describe('range with no bounds', () => {
      const isInDateRange = isDateRangeInDateRangeFunction({});

      it('should always return true.', () => {
        expect(isInDateRange({ start: new Date(), end: new Date() })).toBe(true);
      });
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

describe('fitDateRangeToDayPeriod()', () => {
  describe('scenario', () => {
    const date = `2023-02-27`;

    it('should fit 10AM to 1PM to a day range period.', () => {
      const start = new Date(`${date}T10:00`);
      const expectedEnd = addHours(start, 3); // 10AM to 1PM
      const end = addDays(expectedEnd, 1);

      const result = fitDateRangeToDayPeriod({ start, end });
      expect(result.start).toBeSameSecondAs(start);
      expect(result.end).toBeSameSecondAs(expectedEnd);
    });

    it('should fit 1PM to 10AM to a day range period.', () => {
      const start = new Date(`${date}T13:00`);
      const expectedEnd = addDays(addHours(start, -3), 1); // 10AM to 1PM
      const end = addDays(expectedEnd, 2);

      const result = fitDateRangeToDayPeriod({ start, end });
      expect(result.start).toBeSameSecondAs(start);
      expect(result.end).toBeSameSecondAs(expectedEnd);
    });
  });
});

describe('clampDateFunction()', () => {
  describe('date range with start only', () => {
    const dateRange = { start: new Date() };
    const fn = clampDateFunction(dateRange);

    it('should clamp the start date.', () => {
      const result = fn(addDays(new Date(), -1));
      expect(result).toBeSameSecondAs(dateRange.start);
    });

    it('should not clamp the end date.', () => {
      const input = addDays(new Date(), 1);
      const result = fn(input);
      expect(result).toBeSameSecondAs(input);
    });
  });

  describe('date range with end only', () => {
    const dateRange = { end: new Date() };
    const fn = clampDateFunction(dateRange);

    it('should clamp the end date.', () => {
      const result = fn(addDays(new Date(), 1));
      expect(result).toBeSameSecondAs(dateRange.end);
    });

    it('should not clamp the start date.', () => {
      const input = addDays(new Date(), -1);
      const result = fn(input);
      expect(result).toBeSameSecondAs(input);
    });
  });

  describe('date range with start and end', () => {
    const dateRange = { start: new Date(), end: new Date() };
    const fn = clampDateFunction(dateRange);

    it('should clamp the start date.', () => {
      const result = fn(addDays(new Date(), -1));
      expect(result).toBeSameSecondAs(dateRange.start);
    });

    it('should clamp the end date.', () => {
      const result = fn(addDays(new Date(), 1));
      expect(result).toBeSameSecondAs(dateRange.end);
    });
  });
});

describe('clampDateRangeFunction()', () => {
  describe('defaultClampNullValues=false/undefined', () => {
    describe('date range with start only', () => {
      const dateRange = { start: new Date() };
      const fn = clampDateRangeFunction(dateRange);

      describe('date range input with start only', () => {
        it('should clamp the start date.', () => {
          const result = fn({ start: addDays(new Date(), -1) });
          expect(result.start).toBeSameSecondAs(dateRange.start);
          expect(result.end).toBeUndefined();
        });
      });

      describe('date range input with end only', () => {
        it('should not clamp the end date.', () => {
          const input = addDays(new Date(), 1);
          const result = fn({ end: input });
          expect(result.start).toBeUndefined();
          expect(result.end).toBeSameSecondAs(input);
        });
      });
    });

    describe('date range with end only', () => {
      const dateRange = { end: new Date() };
      const fn = clampDateRangeFunction(dateRange);

      describe('date range input with end only', () => {
        it('should clamp the end date.', () => {
          const result = fn({ end: addDays(new Date(), 1) });
          expect(result.start).toBeUndefined();
          expect(result.end).toBeSameSecondAs(dateRange.end);
        });
      });

      describe('date range input with start only', () => {
        it('should not clamp the start date.', () => {
          const input = addDays(new Date(), -1);
          const result = fn({ start: input });
          expect(result.start).toBeSameSecondAs(input);
          expect(result.end).toBeUndefined();
        });
      });
    });
  });

  describe('defaultClampNullValues=true', () => {
    describe('date range with start only', () => {
      const dateRange = { start: new Date() };
      const fn = clampDateRangeFunction(dateRange, true);

      describe('date range input with start only', () => {
        it('should clamp the start date.', () => {
          const result = fn({ start: addDays(new Date(), -1) });
          expect(result.start).toBeSameSecondAs(dateRange.start);
          expect(result.end).toBeUndefined();
        });
      });

      describe('date range input with end only', () => {
        it('should add the start date and not clamp the end date.', () => {
          const input = addDays(new Date(), 1);
          const result = fn({ end: input });
          expect(result.start).toBeSameSecondAs(dateRange.start);
          expect(result.end).toBeSameSecondAs(input);
        });
      });
    });

    describe('date range with end only', () => {
      const dateRange = { end: new Date() };
      const fn = clampDateRangeFunction(dateRange, true);

      describe('date range input with end only', () => {
        it('should clamp the end date.', () => {
          const result = fn({ end: addDays(new Date(), 1) });
          expect(result.start).toBeUndefined();
          expect(result.end).toBeSameSecondAs(dateRange.end);
        });
      });

      describe('date range input with start only', () => {
        it('should add the end date and not clamp the start date.', () => {
          const input = addDays(new Date(), -1);
          const result = fn({ start: input });
          expect(result.start).toBeSameSecondAs(input);
          expect(result.end).toBeSameSecondAs(dateRange.end);
        });
      });
    });
  });

  describe('date range with start and end', () => {
    const dateRange = { start: new Date(), end: new Date() };
    const fn = clampDateRangeFunction(dateRange);

    it('should clamp the start and end date.', () => {
      const result = fn({ start: addDays(new Date(), -1), end: addDays(new Date(), 1) });
      expect(result.start).toBeSameSecondAs(dateRange.start);
      expect(result.end).toBeSameSecondAs(dateRange.end);
    });
  });
});

describe('transformDateRangeToTimezone()', () => {
  describe('function', () => {
    const fn = transformDateRangeToTimezoneFunction('America/Denver', 'systemDateToTargetDate');

    const dateRangeInUTC = {
      start: new Date('2023-03-11T06:00:00.000Z'),
      end: new Date('2023-03-12T06:00:00.000Z')
    };

    it('should transform the date range.', () => {
      const expectedStart = fn._timezoneInstance.systemDateToTargetDate(dateRangeInUTC.start);
      const expectedEnd = fn._timezoneInstance.systemDateToTargetDate(dateRangeInUTC.end);

      const result = fn(dateRangeInUTC);

      expect(result.start).toBeSameSecondAs(expectedStart);
      expect(result.end).toBeSameSecondAs(expectedEnd);
    });
  });
});
