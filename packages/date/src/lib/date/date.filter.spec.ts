import { addDays } from 'date-fns';
import { DateBlockDurationSpan } from './date.block';
import { dateBlockDurationSpanHasNotEndedFilterFunction, dateBlockDurationSpanHasNotStartedFilterFunction } from './date.filter';

describe('dateBlockDurationSpanHasNotStartedFilterFunction()', () => {
  it('should filter values that are after', () => {
    const now = new Date();

    const filter = dateBlockDurationSpanHasNotStartedFilterFunction(now);

    const values: DateBlockDurationSpan[] = [
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

describe('dateBlockDurationSpanHasNotEndedFilterFunction()', () => {
  it('should filter values that are after', () => {
    const now = new Date();

    const filter = dateBlockDurationSpanHasNotEndedFilterFunction(now);

    const values: DateBlockDurationSpan[] = [
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
