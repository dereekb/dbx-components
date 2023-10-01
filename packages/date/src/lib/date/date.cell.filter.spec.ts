import { addDays, addMinutes } from 'date-fns';
import { DateCellDurationSpan } from './date.cell';
import { dateCellDurationSpanHasEndedFilterFunction, dateCellDurationSpanHasNotEndedFilterFunction, dateCellDurationSpanHasNotStartedFilterFunction, dateCellDurationSpanHasStartedFilterFunction, modifyDateCellsToFitRange, modifyDateCellsToFitRangeFunction } from './date.cell.filter';

describe('dateCellDurationSpanHasNotStartedFilterFunction()', () => {
  it('should filter values that are after', () => {
    const now = new Date();

    const filter = dateCellDurationSpanHasNotStartedFilterFunction(now);

    const values: DateCellDurationSpan[] = [
      {
        i: 0,
        startsAt: addDays(now, -1),
        duration: 60
      },
      {
        i: 1,
        startsAt: now,
        duration: 60
      },
      {
        i: 2,
        startsAt: addDays(now, 1),
        duration: 60
      }
    ];

    const results = values.filter(filter);
    expect(results.length).toBe(1);
    expect(results[0].i).toBe(2);
  });
});

describe('dateCellDurationSpanHasStartedFilterFunction()', () => {
  it('should filter values that are before or equal', () => {
    const now = new Date();

    const filter = dateCellDurationSpanHasStartedFilterFunction(now);

    const values: DateCellDurationSpan[] = [
      {
        i: 0,
        startsAt: addDays(now, -1),
        duration: 60
      },
      {
        i: 1,
        startsAt: addMinutes(now, -60),
        duration: 60
      },
      {
        i: 2,
        startsAt: now,
        duration: 60
      },
      {
        i: 3,
        startsAt: addDays(now, 1),
        duration: 60
      }
    ];

    const results = values.filter(filter);
    expect(results.length).toBe(3);
    expect(results[0].i).toBe(0);
    expect(results[1].i).toBe(1);
    expect(results[2].i).toBe(2);
  });
});

describe('dateCellDurationSpanHasNotEndedFilterFunction()', () => {
  it('should filter values that are after', () => {
    const now = new Date();

    const filter = dateCellDurationSpanHasNotEndedFilterFunction(now);

    const values: DateCellDurationSpan[] = [
      {
        i: 0,
        startsAt: addDays(now, -1),
        duration: 60
      },
      {
        i: 1,
        startsAt: now,
        duration: 60
      },
      {
        i: 2,
        startsAt: addDays(now, 1),
        duration: 60
      }
    ];

    const results = values.filter(filter);
    expect(results.length).toBe(2);
    expect(results[0].i).toBe(1);
    expect(results[1].i).toBe(2);
  });
});

describe('dateCellDurationSpanHasEndedFilterFunction()', () => {
  it('should filter values that are before or equal', () => {
    const now = new Date();

    const filter = dateCellDurationSpanHasEndedFilterFunction(now);

    const values: DateCellDurationSpan[] = [
      {
        i: 0,
        startsAt: addDays(now, -1),
        duration: 60
      },
      {
        i: 1,
        startsAt: addMinutes(now, -60),
        duration: 60
      },
      {
        i: 2,
        startsAt: now,
        duration: 60
      },
      {
        i: 3,
        startsAt: addDays(now, 1),
        duration: 60
      }
    ];

    const results = values.filter(filter);
    expect(results.length).toBe(2);
    expect(results[0].i).toBe(0);
    expect(results[1].i).toBe(1);
  });
});

describe('modifyDateCellsToFitRangeFunction()', () => {
  describe('function', () => {
    const range = { i: 2, to: 4 };
    const fn = modifyDateCellsToFitRangeFunction(range);

    it('should retain the same range', () => {
      const result = fn([range]);
      expect(result[0]).toBe(range);
    });

    it('should filter out blocks that are outside the range.', () => {
      const outside = [
        { x: 'a', i: range.i - 1 },
        { x: 'c', i: range.to + 1 }
      ];
      const values = [...outside, { x: 'b', ...range }];

      const result = fn(values);
      expect(result.length).toBe(1);
    });

    it('should reduce the range of items that are larger than the range.', () => {
      const value = { x: 'a', i: range.i - 1, to: range.to + 1 };
      const result = fn([value]);

      expect(result.length).toBe(1);
      expect(result[0].x).toBe(value.x);
      expect(result[0].i).toBe(range.i);
      expect(result[0].to).toBe(range.to);
    });
  });
});

describe('modifyDateCellsToFitRange()', () => {
  it('should fit an input range of 0-1000 within a range of 0-0', () => {
    const result = modifyDateCellsToFitRange({ i: 0, to: 0 }, [{ i: 0, to: 1000 }]);
    expect(result.length).toBe(1);
    expect(result[0].i).toBe(0);
    expect(result[0].to).toBe(0);
  });
});
