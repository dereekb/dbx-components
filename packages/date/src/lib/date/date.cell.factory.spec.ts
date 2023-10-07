import { guessCurrentTimezone, requireCurrentTimezone, timingDateTimezoneUtcNormal } from '@dereekb/date';
import { range, isOddNumber, RangeInput, MS_IN_MINUTE, TimezoneString, MINUTES_IN_HOUR, MS_IN_HOUR } from '@dereekb/util';
import { addDays, addHours, addMilliseconds, addMinutes, addSeconds, differenceInMilliseconds, isBefore, setHours, setMinutes, startOfDay } from 'date-fns';
import { start } from 'repl';
import { changeDateCellTimingToTimezoneFunction, DateCell, DateCellTiming, dateCellTiming, dateCellTimingStart, DateCellTimingStartsAt, FullDateCellTiming, isValidDateCellTiming } from './date.cell';
import { dateCellDayTimingInfoFactory, dateCellIndexRange, dateCellTimingExpansionFactory, dateCellTimingDateFactory, dateCellTimingFromDateCellTimingStartsAtEndRange, dateCellTimingRelativeIndexArrayFactory, dateCellTimingRelativeIndexFactory, dateCellTimingStartDateFactory, dateCellTimingStartsAtDateFactory, getRelativeIndexForDateCellTiming, isDateCellTimingRelativeIndexFactory, updateDateCellTimingWithDateCellTimingEvent } from './date.cell.factory';
import { dateCellDurationSpanHasNotEndedFilterFunction } from './date.cell.filter';
import { DateCellRange, DateCellRangeWithRange } from './date.cell.index';
import { DateCellSchedule, expandDateCellSchedule } from './date.cell.schedule';
import { formatToISO8601DayString, parseISO8601DayStringToDate, parseISO8601DayStringToUTCDate } from './date.format';
import { DateRange, isDateInDateRange } from './date.range';
import { dateTimezoneUtcNormal, systemNormalDateToBaseDate } from './date.timezone';

/**
 * A DateCell with a string value.
 */
interface DataDateCell extends DateCell {
  value: string;
}

interface DataDateCellRange extends DateCellRangeWithRange {
  value: string;
}

describe('dateCellIndexRange()', () => {
  const days = 5;
  const start = systemNormalDateToBaseDate(new Date(0)); // 1970-01-01 UTC start of day

  const duration = 60;
  const timing = dateCellTiming({ startsAt: start, duration }, days);
  const end = timing.end;

  it('should generate the dateCellIndexRange for a given date.', () => {
    const result = dateCellIndexRange(timing);
    expect(result.minIndex).toBe(0);
    expect(result.maxIndex).toBe(days);
  });

  it('should return the expected IndexRange for a single day', () => {
    const days = 1;
    const timing = dateCellTiming({ startsAt: start, duration }, days);
    const result = dateCellIndexRange(timing);

    expect(result.minIndex).toBe(0);
    expect(result.maxIndex).toBe(days);
  });

  describe('with limit', () => {
    it('should return the expected range if the limit is the same as the range', () => {
      const days = 1;
      const timing = dateCellTiming({ startsAt: start, duration }, days);

      const limit = {
        start: timing.start,
        end: timing.end
      };

      const result = dateCellIndexRange(timing, limit);

      expect(result.minIndex).toBe(0);
      expect(result.maxIndex).toBe(days);
    });

    it('should return a zero range (maxIndex is exclusive) if the end is the same time as the start in limit', () => {
      const days = 1;
      const timing = dateCellTiming({ startsAt: start, duration }, days);

      const limit = {
        start: timing.start,
        end: timing.start
      };

      const result = dateCellIndexRange(timing, limit);

      expect(result.minIndex).toBe(0);
      expect(result.maxIndex).toBe(1);
    });

    it('should limit a two day timing to a single day', () => {
      const days = 2;
      const timing = dateCellTiming({ startsAt: start, duration }, days);

      const limit = {
        start: timing.start,
        end: addDays(timing.end, -1) // limit 1 day less
      };

      const result = dateCellIndexRange(timing, limit);

      expect(result.minIndex).toBe(0);
      expect(result.maxIndex).toBe(days - 1); // expects 1 day
    });

    it('should generate the dateCellIndexRange for one day in the future (1,5).', () => {
      const limit = {
        start: addHours(start, 24),
        end: end
      };

      const result = dateCellIndexRange(timing, limit);
      expect(result.minIndex).toBe(1);
      expect(result.maxIndex).toBe(days);
    });

    describe('fitToTimingRange=false', () => {
      it('should generate the dateCellIndexRange for the limit.', () => {
        const daysPastEnd = 2;

        const limit = {
          start: addHours(start, 24),
          end: addDays(end, daysPastEnd)
        };

        const result = dateCellIndexRange(timing, limit, false);
        expect(result.minIndex).toBe(1);
        expect(result.maxIndex).toBe(days + daysPastEnd);
      });
    });
  });
});

describe('dateCellTimingExpansionFactory()', () => {
  describe('function', () => {
    function makeBlocks(input: RangeInput) {
      return range(input).map((i) => ({ i, value: `${i}` }));
    }

    const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
    const days = 5;
    const duration = 60;

    const timing = dateCellTiming({ startsAt, duration }, days); // system timezone
    const factory = dateCellTimingExpansionFactory<DataDateCell | DataDateCellRange>({ timing });
    const blocks: DataDateCell[] = makeBlocks(days);
    const blocksAsRange: DataDateCellRange = { i: 0, to: days - 1, value: 'a' };

    it('should generate the timings for the input date blocks for the number of blocks.', () => {
      const result = factory(blocks);
      expect(result.length).toBe(days);
      expect(result.length).toBe(blocks.length);
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

    describe('with DateCellRange input', () => {
      it('should generate the timings for the input date blocks.', () => {
        const result = factory([blocksAsRange]);
        expect(result.length).toBe(days);
      });

      it('should filter out block indexes that fall outside the range.', () => {
        const offset = 3;
        const expectedResultCount = days - offset;
        const blocksRange = { i: offset, to: days - 1, value: 'a' };

        const result = factory([blocksRange]);
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
    });

    describe('with durationSpanFilter', () => {
      describe('filter checks the future', () => {
        const pastDays = 2;

        const now = addDays(startsAt, pastDays);
        const factory = dateCellTimingExpansionFactory({ timing, durationSpanFilter: dateCellDurationSpanHasNotEndedFilterFunction(now) });

        it('should filter out spans that have not ended.', () => {
          const result = factory(blocks);
          expect(result.length).toBe(days - pastDays);
        });
      });
    });

    describe('with maxDateCellsToReturn', () => {
      const maxDateCellsToReturn = 1;
      const factory = dateCellTimingExpansionFactory({ timing, maxDateCellsToReturn });

      it('should generate up to the maximum number of blocks to return.', () => {
        const result = factory(blocks);
        expect(result.length).toBe(maxDateCellsToReturn);
      });
    });

    describe('with rangeLimit', () => {
      describe('rangeLimit=duration', () => {
        const daysLimit = 3;
        const factory = dateCellTimingExpansionFactory({ timing, rangeLimit: daysLimit });

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

        describe('with DateCellRange input', () => {
          it('should limit the index range to the first 3 days', () => {
            const offset = 1;
            const expectedResultCount = daysLimit - offset;
            const blocksRange = { i: offset, to: 5, value: 'a' };

            const result = factory([blocksRange]);
            expect(result.length).toBe(expectedResultCount);

            const indexes = result.map((x) => x.i);
            expect(indexes).not.toContain(0);
            expect(indexes).toContain(1);
            expect(indexes).toContain(2);
          });
        });
      });

      describe('rangeLimit=range', () => {
        const factory = dateCellTimingExpansionFactory({ timing, rangeLimit: { start: addDays(timing.start, 1), end: addDays(timing.end, -1) } });

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
        const factory = dateCellTimingExpansionFactory({ timing, rangeLimit: { distance: 3 } });

        it('should limit the index range to the first 3 days', () => {
          const expectedResultCount = 3;

          const result = factory(blocks);
          expect(result.length).toBe(expectedResultCount);

          const indexes = result.map((x) => x.i);
          expect(indexes).toContain(0);
          expect(indexes).toContain(1);
          expect(indexes).toContain(2);
          expect(indexes).not.toContain(3);
          expect(indexes).not.toContain(4);
        });
      });

      describe('with rangeLimit=false', () => {
        const factory = dateCellTimingExpansionFactory({ timing, rangeLimit: false });

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

describe('dateCellTimingRelativeIndexFactory()', () => {
  describe('function', () => {
    const start = startOfDay(new Date());
    const startsAt = addHours(start, 12); // Noon on the day
    const days = 5;
    const duration = 60;
    const systemTiming = dateCellTiming({ startsAt, duration }, days);

    describe('UTC', () => {
      const timezone = 'UTC';
      const timing = changeDateCellTimingToTimezoneFunction(timezone)(systemTiming);
      const fn = dateCellTimingRelativeIndexFactory(timing);

      it('should return the expected indexes for the first day relative to the UTC timezone', () => {
        const dayString = formatToISO8601DayString(start);

        const result1day = fn(dayString);
        const result1date = fn(timing.startsAt); // input the system time

        expect(result1date).toBe(0);
        expect(result1day).toBe(0);
      });
    });

    describe('America/Denver', () => {
      const timezone = 'America/Denver';
      const timing = changeDateCellTimingToTimezoneFunction(timezone)(systemTiming);
      const fn = dateCellTimingRelativeIndexFactory(timing);

      it('should return the expected indexes for the first day relative to the Denver timezone', () => {
        const dayString = formatToISO8601DayString(start);
        const result1day = fn(dayString);
        const resulttimingstart = fn(timing.start);

        expect(resulttimingstart).toBe(0);
        expect(result1day).toBe(0);

        // only a valid timing will return this value correctly
        if (isValidDateCellTiming(timing)) {
          const result1startsAtTime = fn(timing.startsAt); // input the system time
          expect(result1startsAtTime).toBe(0);
        }
      });
    });
  });

  describe('scenarios', () => {
    describe('America/New_York timezone past days', () => {
      const timezone = 'America/New_York';
      const testDays = 17;
      const timing: FullDateCellTiming = {
        timezone,
        start: new Date('2023-08-13T04:00:00.000Z'),
        end: new Date('2023-08-30T09:00:00.000Z'),
        startsAt: new Date('2023-08-14T00:00:00.000Z'),
        duration: 540
      };

      const s: DateCellSchedule = {
        w: '89',
        ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
      };

      it('should correspond the dates to the expanded indexes', () => {
        const indexFactory = dateCellTimingRelativeIndexFactory(timing);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i, startsAt } = x;
          expect(indexFactory(startsAt)).toBe(i);
        });
      });
    });

    describe('daylight savings change', () => {
      describe('America/Chicago', () => {
        const timezone = 'America/Chicago';
        const normallInstance = dateTimezoneUtcNormal(timezone);

        describe('one second before midnight', () => {
          const startsAt = normallInstance.startOfDayInTargetTimezone('2023-03-11'); // timezone offset changes going into the next day.
          const theNextDay = normallInstance.startOfDayInTargetTimezone('2023-03-12');
          const oneSecondBeforeNextDay = addMilliseconds(theNextDay, -(1 + MS_IN_HOUR)); // normallInstance.transformDateInTimezoneNormal(theNextDay, (x) => );

          it('should properly round the index down.', () => {
            const factory = dateCellTimingRelativeIndexFactory({ startsAt, timezone });
            const result = factory(oneSecondBeforeNextDay);
            expect(result).toBe(0); // should be the same day

            const nextDayResult = factory(theNextDay);
            expect(nextDayResult).toBe(1); // should be the next day
          });
        });

        describe('timezone change', () => {
          const startsAt = new Date('2023-03-11T06:00:00.000Z'); // timezone offset changes going into the next day.
          const dstDay = new Date('2023-03-13T06:00:00.000Z'); // daylight Savings has occured for some timezones. We jump 2 days however to ensure all zones are in the next timezone where applicable.

          it('should handle daylight savings time changes and return the expected index.', () => {
            const factory = dateCellTimingRelativeIndexFactory({ startsAt, timezone });
            const result = factory(dstDay);

            expect(formatToISO8601DayString(dstDay)).toBe('2023-03-13');
            expect(result).toBe(2); // 2 days later
          });
        });
      });
    });
  });
});

describe('isDateCellTimingRelativeIndexFactory()', () => {
  const timing: DateCellTimingStartsAt = {
    timezone: requireCurrentTimezone(),
    startsAt: new Date('2023-08-14T00:00:00.000Z')
  };

  describe('function', () => {
    it('should return false for a timing', () => {
      const result = isDateCellTimingRelativeIndexFactory(timing);
      expect(result).toBe(false);
    });

    it('should return true for a dateCellTimingRelativeIndexFactory()', () => {
      const indexFactory = dateCellTimingRelativeIndexFactory(timing);
      const result = isDateCellTimingRelativeIndexFactory(indexFactory);
      expect(result).toBe(true);
    });
  });
});

describe('dateCellTimingRelativeIndexArrayFactory()', () => {
  const startsAt = startOfDay(new Date());
  const timezone = requireCurrentTimezone(); // system timezone
  const startsAtTiming = { timezone, startsAt };
  const start = dateCellTimingStart(startsAtTiming);

  describe('function', () => {
    const indexFactory = dateCellTimingRelativeIndexFactory(startsAtTiming);
    const factory = dateCellTimingRelativeIndexArrayFactory(indexFactory);

    it('should convert a DateRange', () => {
      const days = 5;
      const dateRange: DateRange = { start, end: addDays(start, days - 1) };
      const result = factory(dateRange);

      expect(result.length).toBe(days);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(1);
      expect(result[2]).toBe(2);
      expect(result[3]).toBe(3);
      expect(result[4]).toBe(4);
    });

    it('should convert a Date', () => {
      const result = factory(startsAt);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0);
    });

    it('should convert a DateCellRangeWithRange', () => {
      const days = 5;
      const dateRange: DateCellRangeWithRange = { i: 0, to: days - 1 };
      const result = factory(dateRange);

      expect(result.length).toBe(days);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(1);
      expect(result[2]).toBe(2);
      expect(result[3]).toBe(3);
      expect(result[4]).toBe(4);
    });

    it('should convert a DateCellRange', () => {
      const dateRange: DateCellRange = { i: 0 };
      const result = factory(dateRange);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0);
    });

    it('should convert a DateCellIndex', () => {
      const index = 100;
      const result = factory(index);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(index);
    });

    it('should convert an array of DateCellIndex values', () => {
      const index = 10;
      const result = factory(range(0, index));

      expect(result.length).toBe(index);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(1);
      expect(result[2]).toBe(2);
      expect(result[3]).toBe(3);
      expect(result[4]).toBe(4);
      expect(result[index - 1]).toBe(index - 1);
    });
  });
});

describe('dateCellDayTimingInfoFactory()', () => {
  const start = startOfDay(new Date());
  const startsAt = addHours(start, 12); // Noon on the day
  const days = 5;
  const duration = 60;
  const timing = dateCellTiming({ startsAt, duration }, days);
  const factory = dateCellDayTimingInfoFactory({ timing });

  it('should calculate the day info when provided a day index.', () => {
    const result = factory(0);
    const isInProgress = isDateInDateRange(result.now, { start: result.startsAtOnDay, end: result.endsAtOnDay });

    expect(result.dayIndex).toBe(0);
    expect(result.isInProgress).toBe(isInProgress);

    // has already occured in some timezones (e.g. Asia/Tokyo)
    const expectedHasOccuredToday = !isBefore(result.now, result.endsAtOnDay);
    expect(result.hasOccuredToday).toBe(expectedHasOccuredToday);

    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(isInProgress || expectedHasOccuredToday ? 0 : -1);
    expect(result.nextIndex).toBe(isInProgress || expectedHasOccuredToday ? 1 : 0);
  });

  it('should calculate the day info for before occurrence for today', () => {
    const result = factory(start);
    expect(result.dayIndex).toBe(0);
    expect(result.isInProgress).toBe(false);
    expect(result.hasOccuredToday).toBe(false);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(-1);
    expect(result.nextIndex).toBe(0);
  });

  it('should calculate the day info for the startsAt time (is occurring)', () => {
    const result = factory(startsAt);
    expect(result.dayIndex).toBe(0);
    expect(result.isInProgress).toBe(true);
    expect(result.hasOccuredToday).toBe(false);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(0);
    expect(result.nextIndex).toBe(1);
  });

  it('should calculate the day info for after occurrence for today', () => {
    const result = factory(addMinutes(startsAt, duration * 2));
    expect(result.dayIndex).toBe(0);
    expect(result.isInProgress).toBe(false);
    expect(result.hasOccuredToday).toBe(true);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(0);
    expect(result.nextIndex).toBe(1);
  });

  it('should calculate the day info for tomorrow at the startsAt time (is occurring)', () => {
    const result = factory(addDays(startsAt, 1));
    expect(result.dayIndex).toBe(1);
    expect(result.isInProgress).toBe(true);
    expect(result.hasOccuredToday).toBe(false);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(1);
    expect(result.nextIndex).toBe(2);
  });

  it('should calculate the day info for after occurrence for tomorrow', () => {
    const result = factory(addMinutes(addDays(startsAt, 1), duration * 2));
    expect(result.dayIndex).toBe(1);
    expect(result.isInProgress).toBe(false);
    expect(result.hasOccuredToday).toBe(true);
    expect(result.isInRange).toBe(true);
    expect(result.currentIndex).toBe(1);
    expect(result.nextIndex).toBe(2);
  });

  describe('scenarios', () => {
    describe('expandDateCellSchedule() comparison', () => {
      describe('America/New_York timezone past days', () => {
        const timezone = 'America/New_York';
        const testDays = 17;

        const startsAt = new Date('2023-08-14T00:00:00.000Z');
        const timing: FullDateCellTiming = dateCellTiming({ startsAt, duration: 540 }, testDays, timezone);

        const s: DateCellSchedule = {
          w: '89',
          ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
        };

        it('should expand the zero index to the same block', () => {
          const infoFactory = dateCellDayTimingInfoFactory({ timing });
          const expandedDays = expandDateCellSchedule({ timing, schedule: s, maxDateCellsToReturn: 1 });
          const expandedDayZero = expandedDays[0];
          const infoDayZeroIndex = infoFactory(0);
          const infoDayZeroDate = infoFactory(infoDayZeroIndex.startsAtOnDay);

          expect(timing.startsAt).toBeSameSecondAs(startsAt);

          expect(expandedDayZero.i).toBe(0);
          expect(expandedDayZero.startsAt).toBeSameSecondAs(timing.startsAt);

          expect(infoDayZeroIndex.dayIndex).toBe(0);
          expect(infoDayZeroIndex.startsAtOnDay).toBeSameSecondAs(timing.startsAt);

          expect(infoDayZeroDate.dayIndex).toBe(0);
          expect(infoDayZeroDate.startsAtOnDay).toBeSameSecondAs(timing.startsAt);
        });

        it('should expand the same dates', () => {
          const infoFactory = dateCellDayTimingInfoFactory({ timing });
          const expandedDays = expandDateCellSchedule({ timing, schedule: s });

          expandedDays.forEach((x) => {
            const { i } = x;
            const info = infoFactory(i);

            const { startsAtOnDay } = info;
            expect(startsAtOnDay).not.toBeBefore(timing.startsAt);
            expect(startsAtOnDay).toBeSameSecondAs(x.startsAt);
          });
        });
      });
    });

    describe('only weekends', () => {
      const startsAt = systemNormalDateToBaseDate(new Date('2022-01-02T00:00:00Z')); // Sunday
      const weekTiming = dateCellTiming({ startsAt, duration: 60 }, 7); // Sunday-Saturday
      const nextDate = systemNormalDateToBaseDate(new Date('2022-01-08T00:00:00.000Z'));
      const factory = dateCellDayTimingInfoFactory({ timing: weekTiming });

      it('should return the correct current index.', () => {
        const now = startsAt;
        const result = factory(nextDate, now);

        expect(result.currentIndex).toBe(5);
        expect(result.isInProgress).toBe(false); // passed now as startsAt, which is a few days before the passed nextDate's start time.
        expect(result.nextIndex).toBe(6);
        expect(result.isComplete).toBe(false);
      });

      it('should return isComplete=true after the final event has occured.', () => {
        const now = nextDate;
        const result = factory(nextDate, addMinutes(now, duration + 5));

        expect(result.nextIndex).toBe(7); // does not exist in the timing
        expect(result.nextIndexInRange).toBe(undefined); // not defined
        expect(result.isInProgress).toBe(false); // finished for the day
        expect(result.isComplete).toBe(true);
      });

      it('should return isComplete=false if before the final event has occured..', () => {
        const now = nextDate;
        const result = factory(nextDate, now);

        expect(result.isComplete).toBe(false);
      });

      it('should return isComplete=false if before the first event has occured.', () => {
        const now = addDays(startsAt, -1);
        const result = factory(now, now);

        expect(result.dayIndex).toBe(-1);
        expect(result.nextIndexInRange).toBe(0);
        expect(result.isComplete).toBe(false);
      });
    });
  });
});

describe('dateCellTimingDateFactory()', () => {
  describe('scenarios', () => {
    describe('America/New_York timezone past days', () => {
      const timezone = 'America/New_York';
      const testDays = 17;

      const startsAt: Date = new Date('2023-08-14T00:00:00.000Z'); // Aug 13th 10:00PM America/New_York
      const timing: DateCellTiming = dateCellTiming({ startsAt, duration: 540 }, testDays, timezone);
      const start = dateCellTimingStart(timing);

      const s: DateCellSchedule = {
        w: '89',
        ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
      };

      it('should correspond the indexes to the expanded dates', () => {
        expect(isValidDateCellTiming(timing)).toBe(true);

        const indexFactory = dateCellTimingRelativeIndexFactory(timing);
        const dateFactory = dateCellTimingDateFactory(timing);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i, startsAt } = x;

          const expectedIndex = indexFactory(startsAt);
          expect(i).toBe(expectedIndex);

          const dateFromIndex = dateFactory(i);
          expect(dateFromIndex).toBeAfter(start);

          const now = new Date();

          // should return the same hours/minutes/seconds as now
          const differenceInSecondsOnly = Math.floor((Math.abs(differenceInMilliseconds(dateFromIndex, now)) % MS_IN_MINUTE) / MS_IN_MINUTE);
          expect(differenceInSecondsOnly).toBe(0);

          expect(dateFromIndex.getUTCHours()).toBe(now.getUTCHours());
          expect(dateFromIndex.getUTCMinutes()).toBe(now.getUTCMinutes());

          const indexFromDate = indexFactory(dateFromIndex);
          expect(indexFromDate).toBe(i);
        });
      });

      it('should expand the same dates to the same indexes.', () => {
        expect(isValidDateCellTiming(timing)).toBe(true);

        const indexFactory = dateCellTimingRelativeIndexFactory(timing);
        const dateFactory = dateCellTimingDateFactory(timing);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i } = x;

          const dateFromIndex = dateFactory(i);
          expect(dateFromIndex).toBeAfter(start);

          const indexFromDate = indexFactory(dateFromIndex);
          expect(indexFromDate).toBe(i);
        });
      });
    });
  });
});

describe('dateCellTimingStartsAtDateFactory()', () => {
  describe('scenarios', () => {
    describe('America/New_York timezone past days', () => {
      const timezone = 'America/New_York';
      const testDays = 17;
      const timing: DateCellTiming = {
        timezone,
        end: new Date('2023-08-30T09:00:00.000Z'),
        startsAt: new Date('2023-08-14T00:00:00.000Z'),
        duration: 540
      };

      const s: DateCellSchedule = {
        w: '89',
        ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
      };

      it('should correspond the indexes to the expanded dates', () => {
        const dateFactory = dateCellTimingStartsAtDateFactory(timing);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i, startsAt } = x;
          expect(dateFactory(i)).toBeSameSecondAs(startsAt);
        });
      });
    });

    describe('daylight savings timezone change', () => {
      // this tests the system's timezone change handling to make sure output is different
      const start = parseISO8601DayStringToDate('2023-03-11'); // timezone offset changes going into the next day.
      const dstDay = parseISO8601DayStringToDate('2023-03-13'); // daylight Savings has occured for some timezones. We jump 2 days however to ensure all zones are in the next timezone where applicable.

      it('startsAt should handle daylight savings time changes', () => {
        const timezone = guessCurrentTimezone() as TimezoneString;
        const factory = dateCellTimingStartsAtDateFactory({ start, startsAt: start, timezone });

        const zero = factory(0);
        expect(zero).toBeSameSecondAs(start);

        const two = factory(2);
        expect(two).toBeSameSecondAs(dstDay);

        const aOffset = start.getTimezoneOffset();
        const bOffset = dstDay.getTimezoneOffset();

        // timezone experiences daylight savings
        if (aOffset !== bOffset) {
          expect(zero.getUTCHours()).not.toBe(two.getUTCHours()); // our start time offset should be reflected in UTC hours
          expect(zero.getHours()).toBe(two.getHours()); // same hours due to tz
        }
      });
    });

    describe('timezones', () => {
      function describeTestsForTimezone(timezone: TimezoneString) {
        const timezoneInstance = dateTimezoneUtcNormal({ timezone });
        const startOfTodayInTimezone = timezoneInstance.startOfDayInTargetTimezone();
        const timing = dateCellTiming({ startsAt: startOfTodayInTimezone, duration: 60 }, 1, timezone); // 1 day
        const startsAtFactory = dateCellTimingStartsAtDateFactory(timing);

        describe(`${timezone}`, () => {
          it(`should return the first startsAt of the timing for ${timezone}`, () => {
            const startsAt = startsAtFactory(0);

            expect(timing.startsAt).toBeSameSecondAs(startOfTodayInTimezone);
            expect(startsAt).toBeSameSecondAs(timing.startsAt);
          });
        });
      }

      describeTestsForTimezone('UTC');
      describeTestsForTimezone('America/Denver');
      describeTestsForTimezone('America/Los_Angeles');
      describeTestsForTimezone('America/New_York');
      describeTestsForTimezone('America/Chicago');
      describeTestsForTimezone('Pacific/Fiji');
    });
  });
});

// TODO: Need more tests concerning the starts/ends at times...

describe('dateCellTimingStartDateFactory()', () => {
  describe('scenarios', () => {
    describe('America/New_York timezone past days', () => {
      const timezone = 'America/New_York';
      const timezoneInstance = timingDateTimezoneUtcNormal(timezone);

      const testDays = 17;
      const timing: DateCellTiming = {
        timezone,
        end: new Date('2023-08-30T09:00:00.000Z'),
        startsAt: new Date('2023-08-14T00:00:00.000Z'),
        duration: 540
      };

      const start = dateCellTimingStart(timing);

      const s: DateCellSchedule = {
        w: '89',
        ex: range(0, testDays).filter(isOddNumber) // "checkers" schedule
      };

      it('should output the 0 index start date', () => {
        const dateFactory = dateCellTimingStartDateFactory(timing);
        const result = dateFactory(0);
        expect(result).toBeSameSecondAs(start);
      });

      it('should correspond the indexes to the expanded dates', () => {
        const dateFactory = dateCellTimingStartDateFactory(timing);
        const expandedDays = expandDateCellSchedule({ timing, schedule: s });

        expandedDays.forEach((x) => {
          const { i, startsAt } = x;
          const expectedStart = addDays(start, i); // there is no DST change for this test, so this is safe for all timezones

          const result = dateFactory(i);
          expect(result).toBeSameSecondAs(expectedStart);
        });
      });
    });

    describe('system timezone change', () => {
      // this tests the system's timezone change handling to make sure output is different
      const start = parseISO8601DayStringToDate('2023-03-11'); // timezone offset changes going into the next day.
      const dstDay = parseISO8601DayStringToDate('2023-03-13'); // daylight Savings has occured for some timezones. We jump 2 days however to ensure all zones are in the next timezone where applicable.

      it('should handle daylight savings time changes.', () => {
        const timezone = guessCurrentTimezone();
        const factory = dateCellTimingStartDateFactory({ startsAt: start, timezone: timezone as string });

        const zero = factory(0);
        expect(zero).toBeSameSecondAs(start);

        const two = factory(2);
        expect(two).toBeSameSecondAs(dstDay);

        const aOffset = start.getTimezoneOffset();
        const bOffset = dstDay.getTimezoneOffset();

        // timezone experiences daylight savings
        if (aOffset !== bOffset) {
          expect(zero.getUTCHours()).not.toBe(two.getUTCHours()); // our start time offset should be reflected in UTC hours
          expect(zero.getHours()).toBe(two.getHours()); // same hours due to tz
        }
      });
    });
  });
});

describe('getRelativeIndexForDateCellTiming()', () => {
  const start = startOfDay(new Date());
  const startsAt = addHours(start, 12); // Noon on the day
  const days = 5;
  const timing = dateCellTiming({ startsAt, duration: 60 }, days);

  it('same time should return an index of 0', () => {
    const result = getRelativeIndexForDateCellTiming(timing, startsAt);
    expect(result).toBe(0);
  });

  it('same 24 hour period should return an index of 0', () => {
    const result = getRelativeIndexForDateCellTiming(timing, addHours(startsAt, 6));
    expect(result).toBe(0);
  });

  it('yesterday should return an index of -1', () => {
    const result = getRelativeIndexForDateCellTiming(timing, addDays(startsAt, -1));
    expect(result).toBe(-1);
  });

  it('tomorrow should return an index of 1', () => {
    const result = getRelativeIndexForDateCellTiming(timing, addDays(startsAt, 1));
    expect(result).toBe(1);
  });

  it('one week later should return an index of 7', () => {
    const result = getRelativeIndexForDateCellTiming(timing, addDays(startsAt, 7));
    expect(result).toBe(7);
  });
});

describe('dateCellTimingFromDateCellTimingStartsAtEndRange()', () => {
  describe('function', () => {
    const startOfToday = startOfDay(new Date());
    const systemTiming = dateCellTiming({ startsAt: addHours(startOfToday, 3), duration: 60 }, 2); // 2 days

    describe('system time', () => {
      const timing = systemTiming;

      it('should return a copy of the timing.', () => {
        const result = dateCellTimingFromDateCellTimingStartsAtEndRange(timing); // use the first event again

        expect(result.timezone).toBe(timing.timezone);
        expect(result.end).toBeSameSecondAs(timing.end);
        expect(result.duration).toBe(timing.duration);
        expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

        expect(isValidDateCellTiming(result)).toBe(true);
      });
    });
  });
});

describe('updateDateCellTimingWithDateCellTimingEvent()', () => {
  describe('function', () => {
    describe('timezones', () => {
      function describeTestsForTimezone(timezone: TimezoneString) {
        const timezoneInstance = dateTimezoneUtcNormal({ timezone });
        const startOfTodayInTimezone = timezoneInstance.startOfDayInTargetTimezone();
        const startOfTodayInTimezoneB = timezoneInstance.targetDateToBaseDate(parseISO8601DayStringToUTCDate(formatToISO8601DayString()));
        const timing = dateCellTiming({ startsAt: startOfTodayInTimezone, duration: 60 }, 1, timezone); // 1 day

        describe(`${timezone}`, () => {
          describe('replaceStartsAt=true', () => {
            it('should return a copy of a timing.', () => {
              const result = updateDateCellTimingWithDateCellTimingEvent({
                timing,
                event: timing,
                replaceStartsAt: true
              }); // use the first event again

              expect(result.timezone).toBe(timing.timezone);
              expect(result.end).toBeSameSecondAs(timing.end);
              expect(result.duration).toBe(timing.duration);
              expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

              expect(isValidDateCellTiming(result)).toBe(true);
            });

            it('should return the original timing using the second event', () => {
              const result = updateDateCellTimingWithDateCellTimingEvent({
                timing,
                event: { startsAt: addDays(timing.startsAt, 1), duration: timing.duration },
                replaceStartsAt: true
              }); // use the first event again

              expect(result.timezone).toBe(timing.timezone);
              expect(result.end).toBeSameSecondAs(timing.end);
              expect(result.duration).toBe(timing.duration);
              expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

              expect(isValidDateCellTiming(result)).toBe(true);
            });

            describe('daylight savings changes', () => {
              const daylightSavingsLastDayActive = timezoneInstance.targetDateToBaseDate(new Date('2023-11-03T00:00:00Z'));
              const timing = dateCellTiming({ startsAt: daylightSavingsLastDayActive, duration: 60 }, 5, timezone); // 1 day

              describe('active to inactive', () => {
                it(`should return a copy of the original ${timezone} timing`, () => {
                  expect(isValidDateCellTiming(timing)).toBe(true);

                  const result = updateDateCellTimingWithDateCellTimingEvent({
                    timing,
                    event: timing,
                    replaceStartsAt: true
                  }); // use the first event again

                  expect(result.timezone).toBe(timing.timezone);
                  expect(result.end).toBeSameSecondAs(timing.end);
                  expect(result.duration).toBe(timing.duration);
                  expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

                  expect(isValidDateCellTiming(result)).toBe(true);
                });

                it(`should return the proper timing with new duration of the day after daylight savings goes inactive in ${timezone}`, () => {
                  expect(isValidDateCellTiming(timing)).toBe(true);

                  const newDuration = timing.duration + MINUTES_IN_HOUR; // add one hour
                  const result = updateDateCellTimingWithDateCellTimingEvent({
                    timing,
                    event: { startsAt: timing.startsAt, duration: newDuration },
                    replaceStartsAt: true,
                    replaceDuration: true
                  }); // use the first event again

                  expect(result.duration).toBe(newDuration);
                  expect(result.timezone).toBe(timing.timezone);
                  expect(result.end).toBeSameSecondAs(addHours(timing.end, 1)); // should adjust for the one more hour
                  expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

                  expect(isValidDateCellTiming(result)).toBe(true);
                });
              });

              describe('inactive to active', () => {
                const daylightSavingsBeforeFirstDayActive = timezoneInstance.targetDateToBaseDate(new Date('2023-03-10T00:00:00Z'));
                const timing = dateCellTiming({ startsAt: daylightSavingsBeforeFirstDayActive, duration: 60 }, 5, timezone); // 1 day

                it(`should return a copy of a timing`, () => {
                  const result = updateDateCellTimingWithDateCellTimingEvent({
                    timing,
                    event: timing,
                    replaceStartsAt: true
                  }); // use the first event again

                  expect(result.timezone).toBe(timing.timezone);
                  expect(result.end).toBeSameSecondAs(timing.end);
                  expect(result.duration).toBe(timing.duration);
                  expect(result.startsAt).toBeSameSecondAs(timing.startsAt);

                  expect(isValidDateCellTiming(result)).toBe(true);
                });
              });
            });
          });
        });
      }

      describeTestsForTimezone('UTC');
      describeTestsForTimezone('America/Denver');
      describeTestsForTimezone('America/Los_Angeles');
      describeTestsForTimezone('America/New_York');
      describeTestsForTimezone('America/Chicago');
      describeTestsForTimezone('Pacific/Fiji');
    });
  });
});
