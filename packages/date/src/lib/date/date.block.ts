import { DayOfWeek, RequiredOnKeys, IndexNumber, IndexRange, indexRangeCheckFunction, IndexRef, MINUTES_IN_DAY, MS_IN_DAY, sortAscendingIndexNumberRefFunction, UniqueModel, lastValue, FactoryWithRequiredInput, FilterFunction, mergeFilterFunctions, range, Milliseconds, Hours, MapFunction, getNextDay } from '@dereekb/util';
import { dateRange, DateRange, DateRangeDayDistanceInput, DateRangeType, isDateRange } from './date.range';
import { DateDurationSpan } from './date.duration';
import { differenceInDays, differenceInMilliseconds, isBefore, addDays, addMinutes, setSeconds, addMilliseconds, hoursToMilliseconds, addHours } from 'date-fns';
import { copyHoursAndMinutesFromDate } from './date';
import { Expose, Type } from 'class-transformer';
import { getCurrentSystemOffsetInHours } from './date.timezone';

/**
 * Index from 0 of which day this block represents.
 */
export type DateBlockIndex = number;

/**
 * A duration-span block.
 */
export interface DateBlock extends IndexRef {
  i: DateBlockIndex;
}

/**
 * An array of DateBlock-like values.
 */
export type DateBlockArray<B extends DateBlock = DateBlock> = B[];

/**
 * Reference to a DateBlockArray
 */
export type DateBlockArrayRef<B extends DateBlock = DateBlock> = {
  blocks: DateBlockArray<B>;
};

/**
 * Is combination of DateRange and DateDurationSpan. The DateRange captures a range of days that a DateBlock takes up, and the DateDurationSpan
 * captures the Dates at which the Job occurs at.
 *
 * NOTES:
 * - start time should be the first second of the day (0 seconds and 0 minutes) for its given timezone. This lets us derive the proper offset.
 *   This means that for GMT+1 the starting date would be 01:00, which can then be normalized to the system timezone to normalize the correct current date. This also means we can safely create a new DateBlockTiming using startOfDay(new Date()) and it will be the correct time.
 * - The start date should always be normalized before being used.
 * - The startsAt time should be greater than or equal to the normalized start
 * - The startsAt time should be on the same date as normalized start
 * - The end time should equal the ending date/time of the final end duration.
 */
export interface DateBlockTiming extends DateRange, DateDurationSpan {}

/**
 * The offset in milliseconds to the "real start date", the first second in the target day on in the system timezone.
 *
 * @param timing
 */
export function getCurrentDateBlockTimingOffset(timing: DateBlockTiming): Milliseconds {
  const start = timing.start;
  const dateHours = start.getUTCHours();

  // if it is a positive offset, then the date is in the future so we subtract the offset from 24 hours to get the proper offset.
  const originalUtcOffset = dateHours > 12 ? 24 - dateHours : -dateHours;
  const originalUtcDate = addHours(start, originalUtcOffset); // convert to original UTC
  const currentTimezoneOffsetInHours = getCurrentSystemOffsetInHours(originalUtcDate); // get the offset as it is on that day

  // calculate the true offset
  let offset: Hours = originalUtcOffset - currentTimezoneOffsetInHours;

  if (offset === -24) {
    offset = 0; // auckland can return -24 for itself
  }

  return hoursToMilliseconds(offset);
}

/**
 * Returns the current timing offset given the input start date.
 *
 * @param timing
 */
export function getCurrentDateBlockTimingStartDate(timing: DateBlockTiming): Date {
  const offset = getCurrentDateBlockTimingOffset(timing);
  return addMilliseconds(timing.start, offset);
}

export class DateBlockTiming extends DateDurationSpan {
  @Expose()
  @Type(() => Date)
  start!: Date;

  @Expose()
  @Type(() => Date)
  end!: Date;

  constructor(template: DateBlockTiming) {
    super(template);

    if (template) {
      this.start = template.start;
      this.end = template.end;
    }
  }
}

/**
 * The DateRange input for dateBlockTiming()
 */
export type DateBlockTimingRangeInput = DateRangeDayDistanceInput | DateRange | number;

/**
 * Creates a valid DateBlock timing from the DateDurationSpan and range input.
 *
 * The duration is first considered, then the date range is applied to it.
 *
 * If a number is passed as the input range, then the duration's startsAt date will be used.
 * The input range's date takes priority over the duration's startsAt date.
 *
 * The start date from the inputDate is considered to to have the offset noted in DateBlock, and will be retained.
 */
export function dateBlockTiming(durationInput: DateDurationSpan, inputRange: DateBlockTimingRangeInput): DateBlockTiming {
  const { duration } = durationInput;

  if (duration > MINUTES_IN_DAY) {
    throw new Error('dateBlockTiming() duration cannot be longer than 24 hours.');
  }

  let { startsAt } = durationInput;
  let numberOfBlockedDays: number;

  let inputDate: Date | undefined;
  let range: DateRange;

  if (typeof inputRange === 'number') {
    numberOfBlockedDays = inputRange;
    range = dateRange({ type: DateRangeType.DAY, date: startsAt, distance: numberOfBlockedDays });
  } else if (isDateRange(inputRange)) {
    range = inputRange;
    inputDate = inputRange.start;
    numberOfBlockedDays = differenceInDays(inputRange.end, inputRange.start);
  } else {
    inputDate = inputRange.date;
    numberOfBlockedDays = inputRange.distance;
    range = dateRange(inputRange, true);
  }

  if (inputDate != null) {
    // input date takes priority, so move the startsAt's date to be on the same date.
    startsAt = copyHoursAndMinutesFromDate(range.start, startsAt, true);

    if (isBefore(startsAt, range.start)) {
      startsAt = addDays(startsAt, 1); // starts 24 hours later
      numberOfBlockedDays = numberOfBlockedDays - 1; // reduce number of applied days by 1
    }
  } else {
    startsAt = setSeconds(startsAt, 0); // clear seconds from startsAt
  }

  const start = range.start;

  // calculate end to be the ending date/time of the final duration span
  const lastStart = addDays(startsAt, numberOfBlockedDays);
  const end: Date = addMinutes(lastStart, duration);

  return {
    start,
    end,
    startsAt,
    duration
  };
}

/**
 *
 * @param timing
 * @returns
 */
export function isValidDateBlockTiming(timing: DateBlockTiming): boolean {
  const { end, startsAt, duration } = timing;

  /**
   * Use the startNormal, as the startsAt time is in the correct UTC date for the expected first time, but the start must be normalized to the system time before it can be used.
   */
  const startNormal = getCurrentDateBlockTimingStartDate(timing);
  const msDifference = differenceInMilliseconds(startsAt, startNormal);
  const hasSeconds = startNormal.getSeconds() !== 0;

  let isValid: boolean = false;

  if (
    duration <= MINUTES_IN_DAY &&
    !hasSeconds && // start cannot have seconds
    msDifference >= 0 && // startsAt is after secondsDifference
    msDifference < MS_IN_DAY // startsAt is not more than 24 hours later
  ) {
    const expectedFinalStartTime = addMinutes(end, -duration);
    const difference = differenceInMilliseconds(startsAt, expectedFinalStartTime) % MS_IN_DAY;
    isValid = difference === 0;
  }

  return isValid;
}

/**
 * Converts the input index into the DayOfWeek that it represents.
 */
export type DateBlockDayOfWeekFactory = MapFunction<DateBlockIndex, DayOfWeek>;

/**
 * Creates a DateBlockDayOfWeekFactory
 *
 * @param dayForIndexZero
 * @returns
 */
export function dateBlockDayOfWeekFactory(dayForIndexZero: DayOfWeek): DateBlockDayOfWeekFactory {
  return (index: DateBlockIndex) => getNextDay(dayForIndexZero, index);
}

/**
 * Reference to a DateBlockTiming
 */
export type DateBlockTimingRef = {
  timing: DateBlockTiming;
};

/**
 * An object that implements DateBlockTimingRef and DateBlockArrayRef
 */
export interface DateBlockCollection<B extends DateBlock = DateBlock> extends DateBlockTimingRef, DateBlockArrayRef<B> {}

/**
 * An expanded DateBlock that implements DateDurationSpan and contains the DateBlock values.
 */
export type DateBlockDurationSpan<B extends DateBlock = DateBlock> = DateDurationSpan & B;

/**
 * Convenience function for calling expandDateBlocks() with the input DateBlockCollection.
 *
 * @param collection
 * @returns
 */
export function expandDateBlockCollection<B extends DateBlock = DateBlock>(collection: DateBlockCollection<B>): DateBlockDurationSpan<B>[] {
  return expandDateBlocks(collection.timing, collection.blocks);
}

/**
 * Convenience function for calling dateBlocksExpansionFactory() then passing the blocks.
 *
 * @param blocks
 * @param timing
 * @returns
 */
export function expandDateBlocks<B extends DateBlock = DateBlock>(timing: DateBlockTiming, blocks: B[]): DateBlockDurationSpan<B>[] {
  return dateBlocksExpansionFactory<B>({ timing })(blocks);
}

export type DateBlocksExpansionFactoryInput<B extends DateBlock | DateBlockRange = DateBlock> = DateBlockArrayRef<B> | DateBlockArray<B>;

/**
 * Used to convert the input DateBlocksExpansionFactoryInput into an array of DateBlockDurationSpan values
 */
export type DateBlocksExpansionFactory<B extends DateBlock | DateBlockRange = DateBlock> = (input: DateBlocksExpansionFactoryInput<B>) => DateBlockDurationSpan<B>[];

export interface DateBlocksExpansionFactoryConfig<B extends DateBlock | DateBlockRange = DateBlock> {
  /**
   * Timing to use in the configuration.
   */
  timing: DateBlockTiming;
  /**
   * Range to limit duration span output to.
   *
   * If not provided, uses the input timing's range.
   * If false, the timing's range is ignored too, and only the DateBlockIndex values are considered.
   */
  rangeLimit?: DateBlockTimingRangeInput | false;
  /**
   * Additional filter function to filter potential blocks in/out.
   */
  filter?: FilterFunction<B>;
  /**
   * (Optional) Max number of blocks to evaluate.
   */
  blocksEvaluationLimit?: number;
}

/**
 * Creates a DateBlocksExpansionFactory
 *
 * @param config
 * @returns
 */
export function dateBlocksExpansionFactory<B extends DateBlock | DateBlockRange = DateBlock>(config: DateBlocksExpansionFactoryConfig): DateBlocksExpansionFactory<B> {
  const { timing, rangeLimit, filter: inputFilter, blocksEvaluationLimit = Number.MAX_SAFE_INTEGER } = config;
  const { startsAt: baseStart, duration } = timing;
  const indexRange = rangeLimit !== false ? dateBlockIndexRange(timing, rangeLimit) : { minIndex: Number.MIN_SAFE_INTEGER, maxIndex: Number.MAX_SAFE_INTEGER };
  const isInRange = indexRangeCheckFunction(indexRange);
  const filter: FilterFunction<B> = mergeFilterFunctions<B>((x: B) => isInRange(x.i), inputFilter);

  return (input: DateBlocksExpansionFactoryInput<B>) => {
    const blocks = Array.isArray(input) ? input : input.blocks;
    const spans: DateBlockDurationSpan<B>[] = [];

    let blocksEvaluated = 0;

    function filterAndPush(block: B, blockIndex: number) {
      if (filter(block, blockIndex)) {
        const startsAt = addDays(baseStart, block.i);
        const durationSpan: DateBlockDurationSpan<B> = {
          ...block,
          startsAt,
          duration
        };
        spans.push(durationSpan);
      }

      // increase the count
      blocksEvaluated += 1;
    }

    blocks.findIndex((block) => {
      if (dateBlockRangeHasRange(block)) {
        // Expands the block's range as if it is at a single index
        range(block.i, block.to + 1).findIndex((i) => {
          const blockAtIndex = { ...block, i, to: i }; // copy block, set to as i
          filterAndPush(blockAtIndex, blocksEvaluated);

          // continue iterating until we hit the evaluation limit.
          return blocksEvaluated >= blocksEvaluationLimit;
        });
      } else {
        filterAndPush(block, blocksEvaluated);
      }

      return blocksEvaluated >= blocksEvaluationLimit;
    });

    return spans;
  };
}

/**
 * Generates a DateBlockIndexRange based on the input timing.
 *
 * An arbitrary limit can also be applied.
 *
 * @param timing
 * @param limit
 * @param fitToTimingRange
 */
export function dateBlockIndexRange(timing: DateBlockTiming, limit?: DateBlockTimingRangeInput, fitToTimingRange = true): IndexRange {
  const { start: zeroDate, end: endDate } = timing;
  let minIndex = 0;
  let maxIndex = differenceInDays(endDate, zeroDate);

  if (limit) {
    const { start, end } = dateBlockTiming(timing, limit);
    const limitMin = differenceInDays(start, zeroDate);
    const limitMax = differenceInDays(end, zeroDate);

    if (fitToTimingRange) {
      minIndex = Math.min(limitMin, maxIndex);
      maxIndex = Math.min(limitMax, maxIndex);
    } else {
      minIndex = limitMin;
      maxIndex = limitMax;
    }
  }

  return { minIndex, maxIndex };
}

// MARK: DateBlockRange
/**
 * Represents a range of DateBlock values.
 */
export interface DateBlockRange extends DateBlock {
  /**
   * Index this block ends at, inclusive. A block with i=0 and to=0 encompases only the block 0.
   *
   * If not provided, assumes this has no range and starts/ends at the same index, i.
   */
  to?: DateBlockIndex;
}

/**
 * DateBlockRange that is known to have a to value.
 */
export type DateBlockRangeWithRange = RequiredOnKeys<DateBlockRange, 'to'>;

/**
 * Expands a DateBlockRange into an array of DateBlock values.
 *
 * @param block
 * @returns
 */
export function expandDateBlockRange<B extends DateBlockRangeWithRange>(block: B): B[] {
  return range(block.i, block.to + 1).map((i) => {
    return { ...block, i, to: i }; // copy block, set to as i
  });
}

/**
 * A DateBlock that also has the potential for a unique identifier.
 */
export interface UniqueDateBlock extends DateBlock, UniqueModel {}

/**
 * Represents a range of UniqueDateBlock values keyed by a similar identifier (or lack of identifier).
 */
export interface UniqueDateBlockRange extends UniqueDateBlock, DateBlockRange {}

/**
 * Returns true if the input DateBlockRange has a "to" value greater than it's "i" value.
 *
 * @param input
 */
export function dateBlockRangeHasRange(input: DateBlockRange | UniqueDateBlock): input is DateBlockRangeWithRange {
  return (input as DateBlockRange).to != null && ((input as DateBlockRange).to as number) > input.i;
}

/**
 * Reads the to index if it exists, or returns the block's index itself.
 *
 * @param input
 * @returns
 */
export function dateBlockEndIndex(input: DateBlockRange | UniqueDateBlock): IndexNumber {
  return (input as DateBlockRange).to ?? input.i;
}

/**
 * A grouping of UniqueDateBlock values, sorted by date range.
 */
export interface UniqueDateBlockRangeGroup<B extends DateBlockRange | UniqueDateBlock> extends DateBlockRange {
  /**
   * Blocks are sorted by index.
   */
  blocks: B[];
}

/**
 * Groups all input DateBlockRange or UniqueDateBlock values into a UniqueDateBlockRangeGroup value.
 */
export function groupUniqueDateBlocks<B extends DateBlockRange | UniqueDateBlock>(input: B[]): UniqueDateBlockRangeGroup<B> {
  const blocks = input.sort(sortAscendingIndexNumberRefFunction());

  const i = 0;
  let to: number;

  if (blocks.length === 0) {
    to = i;
  } else {
    const lastBlock = lastValue(blocks);
    to = (lastBlock as DateBlockRange).to ?? lastBlock.i;
  }

  return {
    i,
    to,
    blocks
  };
}

/**
 * Determines how to "fill" a DateRange when an empty range is detected.
 * - extend: extends the previous block to fill the range.
 * - fill: creates a new value using a factory.
 */
export type ExpandUniqueDateBlocksFillOption = 'extend' | 'fill';

/**
 * Determines how overwrite block values that are completely overlapping eachother.
 * - current: keeps the "current" value
 * - next: the next/new value overwrites the previous one
 */
export type ExpandUniqueDateBlocksOverwriteOption = 'current' | 'next';

export interface ExpandUniqueDateBlocksConfig<B extends DateBlockRange | UniqueDateBlock> {
  /**
   * The expected start index.
   *
   * If provided, will expand the first block to start at this index, and filter out any blocks that end before this index.
   */
  startAtIndex?: number;
  /**
   * The expected end index, inclusive.
   *
   * If provided, will expand the final block to end at this index, and filter out any blocks that start past this index.
   */
  endAtIndex?: number;
  /**
   * Determines how to fill empty ranges.
   */
  fillOption: ExpandUniqueDateBlocksFillOption;
  /**
   * (Optional) Determines how to handle overwrites.
   *
   * Defaults to next
   */
  overwriteOption?: ExpandUniqueDateBlocksOverwriteOption;
  /**
   * Used to create new items to fill empty block sets.
   */
  fillFactory?: FactoryWithRequiredInput<B, DateBlockRange>;
}

export interface ExpandUniqueDateBlocksResult<B extends DateBlockRange | UniqueDateBlock> extends UniqueDateBlockRangeGroup<B> {
  /**
   * Blocks that were removed.
   */
  discarded: B[];
}

export type ExpandUniqueDateBlocksFunction<B extends DateBlockRange | UniqueDateBlock> = (input: B[] | UniqueDateBlockRangeGroup<B>) => ExpandUniqueDateBlocksResult<B>;

export function expandUniqueDateBlocks<B extends DateBlockRange | UniqueDateBlock>(config: ExpandUniqueDateBlocksConfig<B>): ExpandUniqueDateBlocksFunction<B> {
  const { startAtIndex = 0, endAtIndex, fillOption: fill, fillFactory: inputFillFactory, overwriteOption = 'next' } = config;
  const maxAllowedIndex: IndexNumber = endAtIndex ?? Number.MAX_SAFE_INTEGER;
  const fillFactory = inputFillFactory as FactoryWithRequiredInput<B, DateBlockRange>;

  if (!fillFactory && fill === 'fill') {
    throw new Error('fillFactory is required when fillOption is "fill".');
  }

  return (input: B[] | UniqueDateBlockRangeGroup<B>) => {
    const inputGroup = Array.isArray(input) ? groupUniqueDateBlocks(input) : input;
    const sorted = inputGroup.blocks;

    const blocks: B[] = [];
    const discarded: B[] = [];

    let current: B = sorted[0];
    let currentNextIndex: IndexNumber;

    let next: B = sorted[1];
    let nextStartIndex: IndexNumber;

    let i = 0;
    let latestTo: number = startAtIndex - 1;

    function addBlockWithRange(inputBlock: B, i: number, inputTo: number = i) {
      // Add in any necessary gap block first
      const gapSizeBetweenBlocks = i - (latestTo + 1);

      if (gapSizeBetweenBlocks > 0) {
        // start at the startAtIndex at a minimum
        const gapStartIndex = Math.max(latestTo + 1, startAtIndex);
        addGapBlock(gapStartIndex, i - 1);
      }

      const to = Math.min(inputTo, maxAllowedIndex);

      const block: B = {
        ...inputBlock,
        i,
        to
      };

      blocks.push(block);

      latestTo = to;

      return block;
    }

    function completeBlocks() {
      // extend or fill if there is an endAtIndex value present
      if (endAtIndex != null && latestTo < endAtIndex) {
        addGapBlock(latestTo + 1, endAtIndex);
      }
    }

    function addGapBlock(i: number, inputTo: number = i) {
      const to = Math.min(inputTo, maxAllowedIndex);

      if (fill === 'fill') {
        const dateBlockRange: DateBlockRange = {
          i,
          to
        };

        const block: B = fillFactory(dateBlockRange);
        addBlockWithRange(block, i, to);
      } else if (blocks.length > 0) {
        // do not extend if no blocks have been pushed.
        const blockToExtend = lastValue(blocks);
        (blockToExtend as DateBlockRange).to = inputTo;
      }

      latestTo = to;
    }

    function continueToNext(use?: B) {
      i += 1;
      current = use ?? sorted[i];
      next = sorted[i + 1];

      if (next) {
        nextStartIndex = next.i;

        // complete loop once past the max allowed index
        if (nextStartIndex > maxAllowedIndex) {
          continueLoop = false;
        } else {
          const nextEndIndex = dateBlockEndIndex(next);

          if (nextEndIndex <= latestTo) {
            discardCurrent(); // skip until next is not less than or equal to the latest to
            continueToNext();
          }
        }
      } else {
        continueLoop = false;
      }
    }

    function discard(block: B) {
      discarded.push(block);
    }

    function discardCurrent() {
      discard(current);
    }

    function discardNext() {
      discard(next);
      i += 1;
      continueToNext();
    }

    let continueLoop: boolean = Boolean(next); // only loop if next is defined, otherwise we just add the final item.

    while (continueLoop) {
      currentNextIndex = current.i;
      nextStartIndex = next.i;

      const currentEndIndex = dateBlockEndIndex(current);
      const nextEndIndex = dateBlockEndIndex(next);

      if (nextStartIndex < startAtIndex || currentEndIndex < startAtIndex) {
        // do nothing if the next index is still before the start index.
        discardCurrent();
        continueToNext();
      } else if (currentNextIndex === nextStartIndex) {
        // if next has the same range as current, then look at the tie-breaker
        if (nextEndIndex === currentEndIndex) {
          // if they're both on the same index, then take the one based on the overwrite value
          if (overwriteOption === 'current') {
            // add current
            addBlockWithRange(current, currentNextIndex, nextEndIndex);
            // discard and skip the "next" value
            discardNext();
          } else {
            // discard the current
            discardCurrent();
            // move on to next
            continueToNext();
          }
        } else if (nextEndIndex > currentEndIndex) {
          // handle overlap
          // add current
          addBlockWithRange(current, currentNextIndex, currentEndIndex);
          // change next to start at the next range
          continueToNext({ ...next, i: currentEndIndex + 1, to: nextEndIndex });
        }
      } else {
        // Check for any overlap
        if (currentEndIndex > nextStartIndex) {
          // handle overlap

          if (overwriteOption === 'current') {
            // add current
            addBlockWithRange(current, currentNextIndex, currentEndIndex);
            // change next to start at the next range
            continueToNext({ ...next, i: currentEndIndex + 1, to: nextEndIndex });
          } else {
            // add current up to the start index
            addBlockWithRange(current, currentNextIndex, nextStartIndex - 1);
            // continue normally
            continueToNext();
          }
        } else {
          // add the block
          addBlockWithRange(current, currentNextIndex, currentEndIndex);

          // continue to next
          continueToNext();
        }
      }
    }

    if (current != null) {
      // if current != null, then atleast one block was input/remaining.

      const lastStartIndex = current.i;
      const lastEndIndex = dateBlockEndIndex(current);

      if (lastEndIndex < startAtIndex || lastEndIndex <= latestTo || lastStartIndex > maxAllowedIndex) {
        // if the block ends before the start index, then do nothing.
        discardCurrent();
      } else {
        addBlockWithRange(current, Math.max(startAtIndex, lastStartIndex), Math.min(lastEndIndex, maxAllowedIndex));
      }

      completeBlocks();
    } else if (fill === 'fill') {
      completeBlocks();
    }

    const result = {
      i: 0,
      blocks,
      discarded
    };

    return result;
  };
}
