import { expectFail, itShouldFail } from '@dereekb/util/test';
import { DateRange, DateRangeInput } from './date.range';
import { addDays, addHours, addMinutes, setHours, setMinutes, startOfDay, endOfDay, addSeconds, addMilliseconds, millisecondsToHours, minutesToHours } from 'date-fns';
import { DateBlock, dateBlockDayOfWeekFactory, DateBlockIndex, dateBlockIndexRange, DateBlockRangeWithRange, dateBlocksExpansionFactory, dateBlockTiming, DateBlockTiming, expandDateBlockRange, expandUniqueDateBlocks, getCurrentDateBlockTimingOffset, getCurrentDateBlockTimingStartDate, groupUniqueDateBlocks, isValidDateBlockTiming, UniqueDateBlockRange } from './date.block';
import { MS_IN_DAY, MINUTES_IN_DAY, range, RangeInput, Hours, Day } from '@dereekb/util';
import { removeMinutesAndSeconds } from './date';

describe('getCurrentDateBlockTimingOffset()', () => {
  const utcDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

  describe('system time', () => {
    it('should apply the expected offset.', () => {
      const start = new Date(2022, 0, 2); // first second of the day date with an offset equal to the current.

      const systemTimezoneOffset = start.getTimezoneOffset();
      const systemDateAsUtc = addMinutes(start, -systemTimezoneOffset); // timezone offset is inverse of UTC zones

      expect(systemDateAsUtc).toBeSameSecondAs(utcDate);

      const duration = 60;
      const timing: DateBlockTiming = dateBlockTiming({ startsAt: start, duration: 60 }, { start: start, end: addMinutes(start, duration) });
      const offset = getCurrentDateBlockTimingOffset(timing);

      // zero offset when system timezone matches the given, otherwise creating a new start date would allow applying an offset.
      expect(millisecondsToHours(offset)).toBe(0);
      expect(addMilliseconds(start, offset)).toBeSameSecondAs(start);
    });
  });

  const shiftStartDateInUTC = new Date(2022, 0, 2); // addHours(new Date(2022, 0, 2), getCurrentSystemOffsetInHours(utcDate));

  function describeUTCShift(utc: Hours) {
    const systemTimezoneHoursOffset = minutesToHours(-shiftStartDateInUTC.getTimezoneOffset());
    let systemToTargetTimezoneDifference = utc - systemTimezoneHoursOffset;

    if (systemToTargetTimezoneDifference === -24) {
      systemToTargetTimezoneDifference = 0;
    }

    describe(`UTC${utc > 0 ? '+' : ''}${utc}`, () => {
      it('should apply the expected offset.', () => {
        // offset of 0 is equvalent to system time test
        const timezoneOffsetDate = addHours(shiftStartDateInUTC, -systemToTargetTimezoneDifference); // hours offset is inverse

        const duration = 60;
        const timing: DateBlockTiming = dateBlockTiming({ startsAt: timezoneOffsetDate, duration }, { start: timezoneOffsetDate, end: addMinutes(timezoneOffsetDate, duration) });

        const offset = getCurrentDateBlockTimingOffset(timing);
        expect(millisecondsToHours(offset)).toBe(systemToTargetTimezoneDifference);
        expect(addMilliseconds(timezoneOffsetDate, offset)).toBeSameSecondAs(shiftStartDateInUTC);
      });
    });
  }

  // builds a range of tests concerning valid date range offsets. from the system offset.
  // only date block timing offsets of -11 to 12 are valid
  range(-11, 12).forEach((x) => {
    describeUTCShift(x);
  });
});

describe('getCurrentDateBlockTimingStartDate()', () => {
  const utcDate = new Date('2022-01-02T00:00:00Z'); // date in utc. Implies there is no offset to consider.

  describe('system time', () => {
    it('should apply the expected offset.', () => {
      const start = new Date(2022, 0, 2);

      const systemTimezoneOffset = start.getTimezoneOffset();
      const systemDateAsUtc = addMinutes(start, -systemTimezoneOffset);

      expect(systemDateAsUtc).toBeSameSecondAs(utcDate);

      const timing: DateBlockTiming = dateBlockTiming({ startsAt: start, duration: 60 }, 2);
      const date = getCurrentDateBlockTimingStartDate(timing);

      expect(date).toBeSameSecondAs(start);
    });
  });
});

describe('dateBlockTiming()', () => {
  const startsAt = setMinutes(setHours(new Date(), 12), 0); // keep seconds to show rounding
  const days = 5;
  const minutes = 60;

  it('should allow a duration of 24 hours', () => {
    const result = dateBlockTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
    expect(result).toBeDefined();
    expect(result.duration).toBe(MINUTES_IN_DAY);
  });

  describe('range input', () => {
    describe('number of days', () => {
      it('should start at the beginning of the startsAt date', () => {
        const result = dateBlockTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
        expect(result.start).toBeSameSecondAs(startOfDay(startsAt));
      });

      it('should retain the startsAt time', () => {
        const result = dateBlockTiming({ startsAt, duration: MINUTES_IN_DAY }, days);
        expect(result.startsAt).toBeSameSecondAs(removeMinutesAndSeconds(startsAt));
      });

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

describe('dateBlockDayOfWeekFactory()', () => {
  describe('function', () => {
    describe('from sunday', () => {
      const factoryFromSunday = dateBlockDayOfWeekFactory(Day.SUNDAY);

      it('should return the proper day of the week.', () => {
        range(Day.SUNDAY, Day.SATURDAY).map((i: DateBlockIndex) => {
          const result = factoryFromSunday(i);
          expect(result).toBe(i);
        });
      });

      it('should wrap around week.', () => {
        range(Day.SUNDAY, Day.SATURDAY).map((i: DateBlockIndex) => {
          const result = factoryFromSunday(i + 7); // add a full week to the index.
          expect(result).toBe(i);
        });
      });
    });

    describe('from saturday', () => {
      const factoryFromSaturday = dateBlockDayOfWeekFactory(Day.SATURDAY);

      it('should return the day of the week for the input index.', () => {
        expect(factoryFromSaturday(0)).toBe(Day.SATURDAY);
        expect(factoryFromSaturday(1)).toBe(Day.SUNDAY);
        expect(factoryFromSaturday(2)).toBe(Day.MONDAY);
        expect(factoryFromSaturday(3)).toBe(Day.TUESDAY);
        expect(factoryFromSaturday(4)).toBe(Day.WEDNESDAY);
      });
    });
  });
});

describe('isValidDateBlockTiming()', () => {
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

interface DataDateBlockRange extends DateBlockRangeWithRange {
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
    const factory = dateBlocksExpansionFactory<DataDateBlock | DataDateBlockRange>({ timing });
    const blocks: DataDateBlock[] = makeBlocks(days);
    const blocksAsRange: DataDateBlockRange = { i: 0, to: days - 1, value: 'a' };

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

    describe('with DateBlockRange input', () => {
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

        describe('with DateBlockRange input', () => {
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

describe('expandDateBlockRange', () => {
  it('should copy the input block and spread it over a range.', () => {
    const lastIndex = 5;
    const blocksRange = { i: 0, to: 5, value: 'a' };

    const result = expandDateBlockRange(blocksRange);
    expect(result.length).toBe(lastIndex + 1);
    result.forEach((x, i) => {
      expect(x.i).toBe(i);
      expect(x.value).toBe(blocksRange.value);
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

interface UniqueDataDateBlock extends UniqueDateBlockRange {
  value: string;
}

function block(i: number, to?: number, id?: string | undefined) {
  return blockForIdFactory(id)(i, to);
}

function blockForIdFactory(id: string | undefined): (i: number, to?: number) => UniqueDataDateBlock {
  return (i: number, to?: number) => {
    return { id, i, to, value: `${i}-${to ?? i}` };
  };
}

function blocks(i: number, to: number): UniqueDataDateBlock[] {
  return range(i, to).map((x) => block(x));
}

const startAtIndex = 2;
const endAtIndex = 3;

const noBlocks: UniqueDataDateBlock[] = blocks(0, 0);
const contiguousBlocks: UniqueDataDateBlock[] = blocks(0, 5);
const blocksWithMiddleGap: UniqueDataDateBlock[] = [block(0, 1), block(4, 5)];
const blocksWithStartGap: UniqueDataDateBlock[] = [block(startAtIndex + 1, 5)];
const blocksWithEndGap: UniqueDataDateBlock[] = [block(0, endAtIndex - 1)];
const blocksBeforeStartAtIndex: UniqueDataDateBlock[] = [block(0, startAtIndex - 1)];
const blocksAfterEndAtIndex: UniqueDataDateBlock[] = [block(endAtIndex + 1, endAtIndex + 5)];
const overlappingBlocksAtSameIndex: UniqueDataDateBlock[] = [block(0, 0, 'a'), block(0, 0, 'b')];
const overlappingBlocksAtSameRange: UniqueDataDateBlock[] = [block(0, 5, 'a'), block(0, 5, 'b')];
const overlappingBlocksAtDifferentRange: UniqueDataDateBlock[] = [block(0, 3, 'a'), block(2, 5, 'b')];
const overlappingBlocksFirstEclipseSecond: UniqueDataDateBlock[] = [block(0, 3, 'a'), block(2, 3, 'b')];

const manyOverlappingBlocksAtSameIndex: UniqueDataDateBlock[] = [block(0, 0, 'a'), block(0, 0, 'b'), block(0, 0, 'c'), block(0, 0, 'd')];
const manyOverlappingBlocksAtSameRange: UniqueDataDateBlock[] = [block(0, 5, 'a'), block(0, 5, 'b'), block(0, 5, 'c'), block(0, 5, 'd')];

describe('groupUniqueDateBlocks()', () => {
  it('should return the blocks sorted by index', () => {
    const result = groupUniqueDateBlocks(contiguousBlocks);
    expect(result.i).toBe(0);
    expect(result.to).toBe(4);

    contiguousBlocks.forEach((x, i) => expect(result.blocks[i].value).toBe(x.value));
  });
});

describe('expandUniqueDateBlocks', () => {
  describe('function', () => {
    describe('overwrite', () => {
      describe('next', () => {
        const overwriteNextExpand = expandUniqueDateBlocks<UniqueDataDateBlock>({ overwriteOption: 'next', fillOption: 'extend' });

        describe('with index', () => {
          it('should use the latter value to overwrite the previous value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameIndex[0].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameIndex[1].id);
          });

          it('should use the latter value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameIndex[0].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameIndex[1].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameIndex[2].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameIndex[3].id);
          });
        });

        describe('with range', () => {
          it('should use the latter value to overwrite the previous value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameRange[0].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameRange[1].id);
          });

          it('should use the latter value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameRange[0].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameRange[1].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameRange[2].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameRange[3].id);
          });
        });

        describe('with overlapping ranges', () => {
          it('the former value should end before the start of the newer value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtDifferentRange);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtDifferentRange[0].id);
            expect(result.blocks[1].id).toBe(overlappingBlocksAtDifferentRange[1].id);
            expect(result.blocks[0].to).toBe(overlappingBlocksAtDifferentRange[1].i! - 1);
            expect(result.blocks[1].i).toBe(overlappingBlocksAtDifferentRange[1].i);
            expect(result.blocks[1].to).toBe(overlappingBlocksAtDifferentRange[1].to);
          });
        });

        describe('with first eclipsing second', () => {
          it('the former value should end before the start of the newer value', () => {
            const result = overwriteNextExpand(overlappingBlocksFirstEclipseSecond);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
            expect(result.blocks[1].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
            expect(result.blocks[0].to).toBe(overlappingBlocksFirstEclipseSecond[1].i! - 1);
            expect(result.blocks[1].i).toBe(overlappingBlocksFirstEclipseSecond[1].i);
            expect(result.blocks[1].to).toBe(overlappingBlocksFirstEclipseSecond[1].to);
          });

          describe('with endAtIndex', () => {
            const endAtIndex = 1; // use endAtIndex=1 for these tests
            const overwriteNextWithEndIndexExpand = expandUniqueDateBlocks<UniqueDataDateBlock>({ endAtIndex, overwriteOption: 'next', fillOption: 'extend' });

            it('the former value should only exist', () => {
              const result = overwriteNextWithEndIndexExpand(overlappingBlocksFirstEclipseSecond);

              expect(result.blocks.length).toBe(1);
              expect(result.discarded.length).toBe(1);
              expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
              expect(result.discarded[0].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
              expect(result.blocks[0].i).toBe(overlappingBlocksFirstEclipseSecond[0].i);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });
      });

      describe('current', () => {
        const overwriteNextExpand = expandUniqueDateBlocks<UniqueDataDateBlock>({ overwriteOption: 'current', fillOption: 'extend' });

        describe('with index', () => {
          it('should use the former value and ignore the latter value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameIndex[1].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameIndex[0].id);
          });

          it('should use the former value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameIndex);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameIndex[1].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameIndex[2].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameIndex[3].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameIndex[0].id);
          });
        });

        describe('with range', () => {
          it('should use the former value and ignore the latter value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.discarded[0].id).toBe(overlappingBlocksAtSameRange[1].id);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtSameRange[0].id);
          });

          it('should use the former value out of many to overwrite the previous value', () => {
            const result = overwriteNextExpand(manyOverlappingBlocksAtSameRange);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(3);
            expect(result.discarded[0].id).toBe(manyOverlappingBlocksAtSameRange[1].id);
            expect(result.discarded[1].id).toBe(manyOverlappingBlocksAtSameRange[2].id);
            expect(result.discarded[2].id).toBe(manyOverlappingBlocksAtSameRange[3].id);
            expect(result.blocks[0].id).toBe(manyOverlappingBlocksAtSameRange[0].id);
          });
        });

        describe('with overlapping range', () => {
          it('the newer value should start after the end of the older value', () => {
            const result = overwriteNextExpand(overlappingBlocksAtDifferentRange);

            expect(result.blocks.length).toBe(2);
            expect(result.discarded.length).toBe(0);
            expect(result.blocks[0].id).toBe(overlappingBlocksAtDifferentRange[0].id);
            expect(result.blocks[1].id).toBe(overlappingBlocksAtDifferentRange[1].id);
            expect(result.blocks[0].i).toBe(overlappingBlocksAtDifferentRange[0].i);
            expect(result.blocks[0].to).toBe(overlappingBlocksAtDifferentRange[0].to);
            expect(result.blocks[1].i).toBe(overlappingBlocksAtDifferentRange[0].to! + 1);
            expect(result.blocks[1].to).toBe(overlappingBlocksAtDifferentRange[1].to);
          });
        });

        describe('with first eclipsing second', () => {
          it('the former value should eclipse the second', () => {
            const result = overwriteNextExpand(overlappingBlocksFirstEclipseSecond);

            expect(result.blocks.length).toBe(1);
            expect(result.discarded.length).toBe(1);
            expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
            expect(result.discarded[0].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
            expect(result.blocks[0].i).toBe(overlappingBlocksFirstEclipseSecond[0].i);
            expect(result.blocks[0].to).toBe(overlappingBlocksFirstEclipseSecond[0].to);
          });

          describe('with endAtIndex', () => {
            const endAtIndex = 1; // use endAtIndex=1 for these tests
            const overwriteNextWithEndIndexExpand = expandUniqueDateBlocks<UniqueDataDateBlock>({ endAtIndex, overwriteOption: 'current', fillOption: 'extend' });

            it('the former value should only matter and eclipse the second', () => {
              const result = overwriteNextWithEndIndexExpand(overlappingBlocksFirstEclipseSecond);

              expect(result.blocks.length).toBe(1);
              expect(result.discarded.length).toBe(1);
              expect(result.blocks[0].id).toBe(overlappingBlocksFirstEclipseSecond[0].id);
              expect(result.discarded[0].id).toBe(overlappingBlocksFirstEclipseSecond[1].id);
              expect(result.blocks[0].i).toBe(overlappingBlocksFirstEclipseSecond[0].i);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });
      });
    });

    describe('fillOption', () => {
      describe('fill', () => {
        const fillOptionExpand = expandUniqueDateBlocks<UniqueDataDateBlock>({ fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

        itShouldFail('if fillFactory is not provided.', () => {
          expectFail(() => expandUniqueDateBlocks({ fillOption: 'fill' }));
        });

        it('should create a gap block for middle gaps', () => {
          const result = fillOptionExpand(blocksWithMiddleGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithMiddleGap.length + 1);
          expect(result.blocks[1].i).toBe(blocksWithMiddleGap[0].to! + 1);
          expect(result.blocks[1].to).toBe(blocksWithMiddleGap[1].i - 1);
        });

        it('should create a gap block for start gaps', () => {
          const result = fillOptionExpand(blocksWithStartGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithStartGap.length + 1);
          expect(result.blocks[0].i).toBe(0);
          expect(result.blocks[0].to).toBe(blocksWithStartGap[0].i! - 1);
          expect(result.blocks[1].i).toBe(blocksWithStartGap[0].i);
          expect(result.blocks[1].to).toBe(blocksWithStartGap[0].to);
        });

        it('should not create a gap block for end gaps', () => {
          const result = fillOptionExpand(blocksWithEndGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithEndGap.length);
        });

        it('should not create a gap block for contiguous blocks', () => {
          const result = fillOptionExpand(contiguousBlocks);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(contiguousBlocks.length);

          contiguousBlocks.forEach((x, i) => expect(result.blocks[i].value).toBe(x.value));
        });

        it('should not create a gap block for no blocks', () => {
          const result = fillOptionExpand(noBlocks);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(noBlocks.length);
        });

        describe('with endAtIndex', () => {
          const fillOptionExpandBlocksWithEndAtIndex = expandUniqueDateBlocks<UniqueDataDateBlock>({ endAtIndex, fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

          it('should create a gap block for end gaps', () => {
            const result = fillOptionExpandBlocksWithEndAtIndex(blocksWithEndGap);

            expect(result.discarded.length).toBe(0);
            expect(result.blocks.length).toBe(blocksWithEndGap.length + 1);
            expect(result.blocks[1].i).toBe(blocksWithEndGap[0].to! + 1);
            expect(result.blocks[1].to).toBe(endAtIndex);
          });

          describe('block that starts after the endAtIndex', () => {
            it('should create a gap block from 0 to endIndex range and discard the input', () => {
              const result = fillOptionExpandBlocksWithEndAtIndex(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(1);
              expect(result.blocks[0].i).toBe(0);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });

        describe('with startAtIndex and endAtIndex', () => {
          const fillOptionExpandBlocksWithStartAndEnd = expandUniqueDateBlocks<UniqueDataDateBlock>({ startAtIndex, endAtIndex, fillOption: 'fill', fillFactory: (x) => ({ ...x, value: 'new' }) });

          describe('block that starts after the endAtIndex', () => {
            it('should create a gap block for the startIndex to endIndex range and discard the input', () => {
              const result = fillOptionExpandBlocksWithStartAndEnd(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(1);
              expect(result.blocks[0].i).toBe(startAtIndex);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });

          describe('no blocks as input', () => {
            it('should create a gap block for the startIndex to endIndex range', () => {
              const result = fillOptionExpandBlocksWithStartAndEnd(noBlocks);

              expect(result.discarded.length).toBe(0);
              expect(result.blocks.length).toBe(1);
              expect(result.blocks[0].i).toBe(startAtIndex);
              expect(result.blocks[0].to).toBe(endAtIndex);
            });
          });
        });
      });

      describe('extend', () => {
        const expandOptionExpandBlocks = expandUniqueDateBlocks<UniqueDataDateBlock>({ fillOption: 'extend' });

        it('should not extend the first block to stretch to the start', () => {
          const result = expandOptionExpandBlocks(blocksWithStartGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithStartGap.length);
          expect(result.blocks[0].i).toBe(blocksWithStartGap[0].i);
          expect(result.blocks[0].to).toBe(blocksWithStartGap[0].to);
        });

        it('should extend to fill for middle gaps', () => {
          const result = expandOptionExpandBlocks(blocksWithMiddleGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithMiddleGap.length);
          expect(result.blocks[0].i).toBe(blocksWithMiddleGap[0].i);
          expect(result.blocks[0].to).toBe(blocksWithMiddleGap[1].i - 1);
          expect(result.blocks[1].i).toBe(blocksWithMiddleGap[1].i);
          expect(result.blocks[1].to).toBe(blocksWithMiddleGap[1].to);
        });

        it('should not extend the end gap as there is no known end', () => {
          const result = expandOptionExpandBlocks(blocksWithEndGap);

          expect(result.discarded.length).toBe(0);
          expect(result.blocks.length).toBe(blocksWithEndGap.length);
          expect(result.blocks[0].i).toBe(blocksWithEndGap[0].i);
          expect(result.blocks[0].to).toBe(blocksWithEndGap[0].to);
        });

        describe('with endAtIndex', () => {
          const expandOptionWithEndIndexExpandBlocks = expandUniqueDateBlocks<UniqueDataDateBlock>({ endAtIndex, fillOption: 'extend' });

          describe('block that starts after the endAtIndex', () => {
            it('should filter that block out and return nothing.', () => {
              const result = expandOptionWithEndIndexExpandBlocks(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(0);
            });
          });

          it('should expand the last value to the end block.', () => {
            const result = expandOptionWithEndIndexExpandBlocks(blocksWithEndGap);

            expect(result.discarded.length).toBe(0);
            expect(result.blocks.length).toBe(blocksWithEndGap.length);
            expect(result.blocks[0].i).toBe(blocksWithEndGap[0].i);
            expect(result.blocks[0].to).toBe(endAtIndex);
          });
        });

        describe('with startAt and endAt index', () => {
          const expandOptionWithStartAndEndIndexExpandBlocks = expandUniqueDateBlocks<UniqueDataDateBlock>({ startAtIndex, endAtIndex, fillOption: 'extend' });

          describe('block that starts after the endAtIndex', () => {
            it('should filter that block out and return nothing.', () => {
              const result = expandOptionWithStartAndEndIndexExpandBlocks(blocksAfterEndAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(0);
            });
          });

          describe('block that ends before the startAtIndex', () => {
            it('should filter that block out and return nothing.', () => {
              const result = expandOptionWithStartAndEndIndexExpandBlocks(blocksBeforeStartAtIndex);

              expect(result.discarded.length).toBe(1);
              expect(result.blocks.length).toBe(0);
            });
          });

          describe('no blocks as input', () => {
            it('should return no blocks', () => {
              const result = expandOptionWithStartAndEndIndexExpandBlocks(noBlocks);

              expect(result.discarded.length).toBe(0);
              expect(result.blocks.length).toBe(0);
            });
          });
        });
      });
    });
  });
});
