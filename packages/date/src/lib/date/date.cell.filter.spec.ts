import { addDays, addMinutes } from 'date-fns';
import { DateCellDurationSpan } from './date.cell';
import { dateCellDurationSpanHasEndedFilterFunction, dateCellDurationSpanHasNotEndedFilterFunction, dateCellDurationSpanHasNotStartedFilterFunction, dateCellDurationSpanHasStartedFilterFunction } from './date.cell.filter';

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
