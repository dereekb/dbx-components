import { expectFail, itShouldFail } from '@dereekb/util/test';
import { DateRange, DateRangeInput } from './date.range';
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, endOfDay, addSeconds, addMilliseconds } from 'date-fns';
import { DateBlock, dateBlockIndexRange, dateBlocksExpansionFactory, dateBlockTiming, DateBlockTiming, isValidDateBlockTiming } from './date.block';
import { MS_IN_DAY, MINUTES_IN_DAY, range, RangeInput } from '@dereekb/util';

describe('dateBlockTiming', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
  const days = 5;
  const minutes = 60;

  it('should allow a duration of 24 hours', () => {
    const result = dateBlockTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
    expect(result).toBeDefined();
    expect(result.duration).toBe(MINUTES_IN_DAY);
  });

  itShouldFail('if the duration is greater than 24 hours.', () => {
    expectFail(() => {
      dateBlockTiming({ startsAt, duration: MINUTES_IN_DAY + 1 }, days);
    });
  });

  describe('range input', () => {
    describe('number of days', () => {
      it('should create a timing for a specific time that last 1 day', () => {
        const days = 1;
        const result = dateBlockTiming({ startsAt, duration: minutes }, days);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days), minutes));
      });

      it('should create a timing for a specific time that last 5 days', () => {
        const result = dateBlockTiming({ startsAt, duration: minutes }, days);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days), minutes));
      });
    });

    describe('Range', () => {
      it('should create a timing for a specific time that last 5 days using a Range', () => {
        const start = addHours(startsAt, -6);
        const dateRange: DateRange = { start: start, end: addDays(endOfDay(startsAt), days) };
        const result = dateBlockTiming({ startsAt, duration: minutes }, dateRange);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(start);
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days), minutes));
      });

      it('should create a timing for a specific time that last 4 days using a Range', () => {
        const start = addHours(startsAt, 6); // start is 6 hours after startAt
        const dateRange: DateRange = { start: start, end: addDays(endOfDay(startsAt), days) };
        const result = dateBlockTiming({ startsAt, duration: minutes }, dateRange);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(start);
        expect(result.startsAt).toBeSameMinuteAs(addDays(startsAt, 1));
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days), minutes));
      });
    });

    describe('DateRangeInput', () => {
      it('should create a timing for a specific time that last 5 days using a DateRangeDayDistanceInput', () => {
        const dateRangeInput: DateRangeInput = { date: startOfDay(startsAt), distance: days };
        const result = dateBlockTiming({ startsAt, duration: minutes }, dateRangeInput);
        expect(result).toBeDefined();
        expect(result.start).toBeSameMinuteAs(startOfDay(startsAt));
        expect(result.startsAt).toBeSameMinuteAs(startsAt);
        expect(result.duration).toBe(minutes);
        expect(result.end).toBeSameMinuteAs(addMinutes(addDays(startsAt, days), minutes));
      });
    });
  });
});

describe('isValidDateBlockTiming', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
  const validTiming = dateBlockTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1);

  it('should return true if the startsAt time is equal to the start time.', () => {
    const isValid = isValidDateBlockTiming(dateBlockTiming({ startsAt: startOfDay(new Date()), duration: 60 }, 1));
    expect(isValid).toBe(true);
  });

  it('should return false if the starts time has seconds.', () => {
    const invalidTiming: DateBlockTiming = { ...validTiming, start: addSeconds(validTiming.start, 10) };
    const isValid = isValidDateBlockTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the startsAt time is before the start time.', () => {
    const start = addHours(startOfDay(startsAt), 2);
    const isValid = isValidDateBlockTiming({ startsAt: addMinutes(start, -10), start, end: endOfDay(start), duration: 10 });
    expect(isValid).toBe(false);
  });

  it('should return false if the startsAt time is more than 24 hours after the start time.', () => {
    const invalidTiming: DateBlockTiming = { ...validTiming, startsAt: addMilliseconds(validTiming.start, MS_IN_DAY + 1) };
    const isValid = isValidDateBlockTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the end is not the expected end time.', () => {
    const invalidTiming: DateBlockTiming = { ...validTiming, end: addMinutes(validTiming.end, 1), duration: validTiming.duration };
    const isValid = isValidDateBlockTiming(invalidTiming);
    expect(isValid).toBe(false);
  });

  it('should return false if the duration time is greater than 24 hours.', () => {
    const invalidTiming: DateBlockTiming = { ...validTiming, duration: MINUTES_IN_DAY + 1 };
    const isValid = isValidDateBlockTiming(invalidTiming);
    expect(isValid).toBe(false);
  });
});

/**
 * A DateBlock with a string value.
 */
interface DataDateBlock extends DateBlock {
  value: string;
}

describe('dateBlocksExpansionFactory()', () => {
  describe('function', () => {
    function makeBlocks(input: RangeInput) {
      return range(input).map((i) => ({ i, value: `${i}` }));
    }

    const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
    const days = 5;
    const duration = 60;

    const timing = dateBlockTiming({ startsAt, duration }, days);
    const factory = dateBlocksExpansionFactory({ timing });
    const blocks = makeBlocks(days);

    it('should generate the timings for the input date blocks.', () => {
      const result = factory(blocks);
      expect(result.length).toBe(days);
    });

    it('should filter out block indexes that fall outside the range.', () => {
      const offset = 3;
      const expectedResultCount = days - offset;
      const blocks = makeBlocks({ start: offset, end: 8 });

      const result = factory(blocks);
      expect(result.length).toBe(expectedResultCount);

      const indexes = result.map((x) => x.i);
      expect(indexes).not.toContain(0);
      expect(indexes).not.toContain(1);
      expect(indexes).not.toContain(2);
      expect(indexes).not.toContain(5);
      expect(indexes).not.toContain(6);
      expect(indexes).not.toContain(7);
      expect(indexes).not.toContain(8);
    });

    describe('with rangeLimit', () => {
      describe('rangeLimit=duration', () => {
        const daysLimit = 3;
        const factory = dateBlocksExpansionFactory({ timing, rangeLimit: daysLimit });

        it('should limit the index range to the first 3 days', () => {
          const offset = 1;
          const expectedResultCount = daysLimit - offset;
          const blocks = makeBlocks({ start: offset, end: 5 });

          const result = factory(blocks);
          expect(result.length).toBe(expectedResultCount);

          const indexes = result.map((x) => x.i);
          expect(indexes).not.toContain(0);
          expect(indexes).toContain(1);
          expect(indexes).toContain(2);
        });
      });

      describe('rangeLimit=range', () => {
        const factory = dateBlocksExpansionFactory({ timing, rangeLimit: { start: addDays(timing.start, 1), end: addDays(timing.end, -1) } });

        it('should limit the index range to the first 3 days', () => {
          const expectedResultCount = 3;

          const result = factory(blocks);
          expect(result.length).toBe(expectedResultCount);

          const indexes = result.map((x) => x.i);
          expect(indexes).not.toContain(0);
          expect(indexes).toContain(1);
          expect(indexes).toContain(2);
          expect(indexes).toContain(3);
          expect(indexes).not.toContain(4);
        });
      });

      describe('rangeLimit=DateRangeDayDistanceInput', () => {
        const factory = dateBlocksExpansionFactory({ timing, rangeLimit: { date: addDays(timing.start, 1), distance: 3 } });

        it('should limit the index range to the first 3 days', () => {
          const expectedResultCount = 3;

          const result = factory(blocks);
          expect(result.length).toBe(expectedResultCount);

          const indexes = result.map((x) => x.i);
          expect(indexes).not.toContain(0);
          expect(indexes).toContain(1);
          expect(indexes).toContain(2);
          expect(indexes).toContain(3);
          expect(indexes).not.toContain(4);
        });
      });

      describe('with rangeLimit=false', () => {
        const factory = dateBlocksExpansionFactory({ timing, rangeLimit: false });

        it('should generate a span for all blocks', () => {
          const offset = 3;
          const end = 8;
          const expectedResultCount = end - offset;
          const blocks = makeBlocks({ start: offset, end });

          const result = factory(blocks);
          expect(result.length).toBe(expectedResultCount);

          const indexes = result.map((x) => x.i);
          expect(indexes).not.toContain(0);
          expect(indexes).not.toContain(1);
          expect(indexes).not.toContain(2);
          expect(indexes).toContain(3);
          expect(indexes).toContain(4);
          expect(indexes).toContain(5);
          expect(indexes).toContain(6);
          expect(indexes).toContain(7);
        });
      });
    });
  });
});

describe('dateBlockIndexRange', () => {
  const days = 5;
  const start = new Date(0);
  const end = addDays(start, days);

  const timing: DateBlockTiming = {
    start,
    end,
    startsAt: start,
    duration: 60
  };

  it('should generate the dateBlockIndexRange for a given date.', () => {
    const result = dateBlockIndexRange(timing);
    expect(result.minIndex).toBe(0);
    expect(result.maxIndex).toBe(days);
  });

  describe('with limit', () => {
    it('should generate the dateBlockIndexRange for one day in the future (1,5).', () => {
      const limit = {
        start: addHours(start, 24),
        end: end
      };

      const result = dateBlockIndexRange(timing, limit);
      expect(result.minIndex).toBe(1);
      expect(result.maxIndex).toBe(days);
    });

    describe('fitToTimingRange=false', () => {
      it('should generate the dateBlockIndexRange for the limit.', () => {
        const daysPastEnd = 2;

        const limit = {
          start: addHours(start, 24),
          end: addDays(end, daysPastEnd)
        };

        const result = dateBlockIndexRange(timing, limit, false);
        expect(result.minIndex).toBe(1);
        expect(result.maxIndex).toBe(days + daysPastEnd);
      });
    });
  });
});
