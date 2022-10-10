import { DayOfWeek, RequiredOnKeys, IndexNumber, IndexRange, indexRangeCheckFunction, IndexRef, MINUTES_IN_DAY, MS_IN_DAY, UniqueModel, lastValue, FactoryWithRequiredInput, FilterFunction, mergeFilterFunctions, range, Milliseconds, Hours, MapFunction, getNextDay, SortCompareFunction, sortAscendingIndexNumberRefFunction, mergeArrayIntoArray, Configurable, ArrayOrValue, indexRange, asArray, sumOfIntegersBetween } from '@dereekb/util';
import { dateRange, DateRange, DateRangeDayDistanceInput, DateRangeType, isDateRange } from './date.range';
import { DateDurationSpan } from './date.duration';
import { differenceInDays, differenceInMilliseconds, isBefore, addDays, addMinutes, setSeconds, addMilliseconds, hoursToMilliseconds, addHours, differenceInHours, isAfter } from 'date-fns';
import { copyHoursAndMinutesFromDate } from './date';
import { Expose, Type } from 'class-transformer';
import { getCurrentSystemOffsetInHours } from './date.timezone';
import { IsDate, IsNumber, IsOptional, Min } from 'class-validator';

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

export class DateBlock {
  @Expose()
  @IsNumber()
  @Min(0)
  i!: DateBlockIndex;

  constructor(template?: DateBlock) {
    if (template) {
      this.i = template.i;
    }
  }
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

/**
 * Returns the DateBlockIndex of the input date relative to the configured D
 */
export type DateTimingRelativeIndexFactory = ((date: Date) => DateBlockIndex) & {
  readonly _timing: DateBlockTiming;
};

/**
 *
 * @param timing
 * @returns
 */
export function dateTimingRelativeIndexFactory(timing: DateBlockTiming): DateTimingRelativeIndexFactory {
  const startDate = getCurrentDateBlockTimingStartDate(timing);
  const factory = ((date: Date) => {
    const diff = differenceInHours(date, startDate);
    let daysOffset = Math.floor(diff / 24);
    return daysOffset;
  }) as Configurable<Partial<DateTimingRelativeIndexFactory>>;
  factory._timing = timing;
  return factory as DateTimingRelativeIndexFactory;
}

/**
 * Gets the relative index of the input date compared to the input timing.
 *
 * @param timing
 * @param date
 */
export function getRelativeIndexForDateTiming(timing: DateBlockTiming, date = new Date()): DateBlockIndex {
  return dateTimingRelativeIndexFactory(timing)(date);
}

export class DateBlockTiming extends DateDurationSpan {
  @Expose()
  @IsDate()
  @Type(() => Date)
  start!: Date;

  @Expose()
  @IsDate()
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
  const isInRange = indexRangeCheckFunction({ indexRange, inclusiveMaxIndex: false });
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

export type DateBlocksDayTimingInfoFactoryConfig = Pick<DateBlocksExpansionFactoryConfig, 'timing' | 'rangeLimit'>;

export interface DateBlockDayTimingInfo {
  /**
   * Index for the day
   */
  dayIndex: DateBlockIndex;
  /**
   * Index for the previous/current execution.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex.
   */
  currentIndex: DateBlockIndex;
  /**
   * Index for the next execution.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex + 1.
   */
  nextIndex: DateBlockIndex;
  /**
   * Whether or not today's timing has already occured in it's entirety.
   */
  hasOccuredToday: boolean;
  /**
   * Whether or not today's timing is currenctly in progress.
   */
  isInProgress: boolean;
  /**
   * Whether or not the block is within the configured range.
   */
  isInRange: boolean;
  /**
   * Time the timing starts on the input day.
   */
  startsAtOnDay: Date;
}

export type DateBlockDayInfoFactory = (date: Date) => DateBlockDayTimingInfo;

export function dateBlocksDayInfoFactory(config: DateBlocksDayTimingInfoFactoryConfig): DateBlockDayInfoFactory {
  const { timing, rangeLimit } = config;
  const { startsAt, duration } = timing;
  const indexRange = rangeLimit !== false ? dateBlockIndexRange(timing, rangeLimit) : { minIndex: Number.MIN_SAFE_INTEGER, maxIndex: Number.MAX_SAFE_INTEGER };
  const checkIsInRange = indexRangeCheckFunction({ indexRange, inclusiveMaxIndex: false });
  const dayIndexFactory = dateTimingRelativeIndexFactory(timing);

  return (input: Date) => {
    const dayIndex = dayIndexFactory(input);
    const isInRange = checkIsInRange(dayIndex);

    const startsAtOnDay = copyHoursAndMinutesFromDate(input, startsAt, false);
    const potentiallyInProgress = !isAfter(startsAt, input);

    const isInProgress = potentiallyInProgress && isBefore(input, addMinutes(startsAtOnDay, duration));
    const hasOccuredToday = potentiallyInProgress && !isInProgress;

    const currentIndex: DateBlockIndex = isInProgress || hasOccuredToday ? dayIndex : dayIndex - 1; // If not in progress and hasn't occured today, current index is the previous index.
    const nextIndex: DateBlockIndex = currentIndex + 1;

    return {
      dayIndex,
      currentIndex,
      nextIndex,
      hasOccuredToday,
      isInProgress,
      isInRange,
      startsAtOnDay
    };
  };
}

/**
 * IndexRange used with DateBlocks.
 *
 * It has an exclusive max range. It is similar to a DateBlockRange.
 */
export type DateBlockIndexRange = IndexRange;

export function dateBlockRangeToDateBlockIndexRange(range: DateBlockRange): DateBlockIndexRange {
  return { minIndex: range.i, maxIndex: (range.to ?? range.i) + 1 };
}

export function dateBlockIndexRangeToDateBlockRange(range: DateBlockIndexRange): DateBlockRangeWithRange {
  return { i: range.minIndex, to: range.maxIndex - 1 };
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
export function dateBlockIndexRange(timing: DateBlockTiming, limit?: DateBlockTimingRangeInput, fitToTimingRange = true): DateBlockIndexRange {
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

/**
 * Returns blocks that are only in the given DateBlockRange.
 *
 * @param blocks
 * @param range
 * @returns
 */
export function dateBlocksInDateBlockRange<T extends DateBlock | DateBlockRange>(blocks: T[], range: DateBlockRangeWithRange): T[] {
  return blocks.filter((x) => {
    if (x.i >= range.i) {
      const to = (x as DateBlockRange).to ?? x.i;
      return to <= range.to;
    }

    return false;
  });
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

export class DateBlockRange extends DateBlock {
  @Expose()
  @IsNumber()
  @IsOptional()
  @Min(0) // TODO: Consider valdiating against i to make sure it is not less than i
  to?: DateBlockIndex;

  constructor(template?: DateBlockRange) {
    super(template);
    if (template) {
      this.to = template.to;
    }
  }
}

/**
 * Creates a DateBlockRange
 *
 * @param i
 * @param to
 * @returns
 */
export function dateBlockRange(i: number, to?: number): DateBlockRangeWithRange {
  return { i, to: to ?? i };
}

export function dateBlockRangeWithRange(inputDateBlockRange: DateBlockRange): DateBlockRangeWithRange {
  return dateBlockRange(inputDateBlockRange.i, inputDateBlockRange.to);
}

/**
 * Function that returns true if the input range covers the full range of the configured DateBlockRange.
 */
export type DateBlockRangeIncludedByRangeFunction = (range: DateBlockRangeWithRange) => boolean;

/**
 * Creates a DateBlockRangeIncludedByRangeFunction
 *
 * @param inputRange
 * @returns
 */
export function dateBlockRangeIncludedByRangeFunction(inputRange: DateBlockRange): DateBlockRangeIncludedByRangeFunction {
  const i = inputRange.i;
  const to = inputRange.to ?? i;
  return (range) => range.i <= i && range.to >= to;
}

/**
 * Sorts the input ranges by index and distance (to values).
 *
 * In many cases sortAscendingIndexNumberRefFunction may be preferential since
 *
 * @returns
 */
export function sortDateBlockRangeAndSizeFunction<T extends DateBlockRange>(): SortCompareFunction<T> {
  return (a, b) => a.i - b.i || (a.to ?? a.i) - (b.to ?? b.i);
}

/**
 * Sorts the input date ranges. This will retain the before/after order while also sorting items by index.
 *
 * @param input
 * @returns
 */
export function sortDateBlockRanges<T extends DateBlockRange>(input: T[]): T[] {
  return input.sort(sortAscendingIndexNumberRefFunction());
}

/**
 * DateBlockRange that is known to have a to value.
 */
export type DateBlockRangeWithRange = RequiredOnKeys<DateBlockRange, 'to'>;

/**
 * Groups the input values into DateBlockRange values.
 *
 * @param input
 */
export function groupToDateBlockRanges(input: (DateBlock | DateBlockRange)[]): DateBlockRangeWithRange[] {
  if (input.length === 0) {
    return [];
  }

  // sort by index in ascending order
  const blocks = sortDateBlockRanges(input);

  function newBlockFromBlocksIndex(blocksIndex: number): DateBlockRangeWithRange {
    const { i, to } = blocks[blocksIndex] as DateBlockRange;
    return {
      i,
      to: to ?? i
    };
  }

  // start at the first block
  let current: DateBlockRangeWithRange = newBlockFromBlocksIndex(0);

  const results: DateBlockRangeWithRange[] = [];

  for (let i = 1; i < blocks.length; i += 1) {
    const block = blocks[i];
    const isContinuous = block.i <= current.to + 1;

    if (isContinuous) {
      // extend the current block.
      current.to = (blocks[i] as DateBlockRange).to ?? blocks[i].i;
    } else {
      // complete/create new block.
      results.push(current);
      current = newBlockFromBlocksIndex(i);
    }
  }

  results.push(current);

  return results;
}

export interface DateBlockRangeBlockCountInfo {
  /**
   * Total number of blocks.
   */
  readonly count: number;
  /**
   * The "total" if all indexes were added together. Used for calculating the average.
   */
  readonly total: number;
  /**
   * The average block index
   */
  readonly average: number;
}

/**
 * Counts the number of blocks in the input range.
 *
 * @param inputDateBlockRange
 * @returns
 */
export function dateBlockRangeBlocksCountInfo(inputDateBlockRange: ArrayOrValue<DateBlock | DateBlockRange>): DateBlockRangeBlockCountInfo {
  const group = groupToDateBlockRanges(asArray(inputDateBlockRange));

  let count = 0;
  let total = 0;

  group.forEach((x) => {
    const blocks = Math.abs(x.to - x.i) + 1; // +1 for inclusivity
    count += blocks;

    const size = sumOfIntegersBetween(x.i, x.to);
    total += size;
  });

  return {
    count,
    total,
    average: total / count
  };
}

/**
 * Counts the number of blocks in the input range.
 *
 * @param inputDateBlockRange
 * @returns
 */
export function dateBlockRangeBlocksCount(inputDateBlockRange: ArrayOrValue<DateBlock | DateBlockRange>): number {
  return dateBlockRangeBlocksCountInfo(inputDateBlockRange).count;
}

/**
 * Checks whether or not the input range is fully included by the configured ranges.
 */
export type DateBlockRangesFullyCoverDateBlockRangeFunction = (range: DateBlockRange) => boolean;

/**
 * Creates a dateBlockRangesFullyCoverDateBlockRangeFunction
 *
 * @param ranges
 * @returns
 */
export function dateBlockRangesFullyCoverDateBlockRangeFunction(ranges: ArrayOrValue<DateBlockRange>): DateBlockRangesFullyCoverDateBlockRangeFunction {
  const groupedRanges = Array.isArray(ranges) ? groupToDateBlockRanges(ranges) : [dateBlockRangeWithRange(ranges)];

  return (inputRange: DateBlockRange) => {
    const fn = dateBlockRangeIncludedByRangeFunction(inputRange);
    return groupedRanges.findIndex(fn) !== -1;
  };
}

/**
 * Expands a DateBlockRange into an array of DateBlock values.
 *
 * @param block
 * @returns
 */
export function expandDateBlockRange<B extends DateBlockRange | DateBlockRangeWithRange>(block: B): B[] {
  return range(block.i, dateBlockEndIndex(block) + 1).map((i) => {
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
 * Groups all input DateBlockRange or UniqueDateBlock values into a UniqueDateBlockRangeGroup value amd sorts the input.
 */
export function groupUniqueDateBlocks<B extends DateBlockRange | UniqueDateBlock>(input: B[]): UniqueDateBlockRangeGroup<B> {
  const blocks = sortDateBlockRanges([...input]);

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
export type ExpandUniqueDateBlocksRetainOverlapOption = 'current' | 'next';

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
   * - next: will retain the latest value (next) and overwrite the current value.
   * - current: will retain the current value and ignore any future values at that index.
   *
   * Defaults to next
   */
  retainOnOverlap?: ExpandUniqueDateBlocksRetainOverlapOption;
  /**
   * Used to create new items to fill empty block sets. Required when mode is set to "fill".
   */
  fillFactory?: FactoryWithRequiredInput<B, DateBlockRangeWithRange>;
}

export interface ExpandUniqueDateBlocksResult<B extends DateBlockRange | UniqueDateBlock> extends UniqueDateBlockRangeGroup<B> {
  /**
   * Blocks that were competely removed. Some blocks stay partially retained.
   */
  discarded: B[];
}

/**
 * Expansion function used to sort/merge/replace DateBlockRange values by block.
 *
 * Can optionally specify a second array/group of blocks that are treated as "next" blocks which can take priority or not depending on the retain options.
 */
export type ExpandUniqueDateBlocksFunction<B extends DateBlockRange | UniqueDateBlock> = (input: B[] | UniqueDateBlockRangeGroup<B>, newBlocks?: B[] | UniqueDateBlockRangeGroup<B>) => ExpandUniqueDateBlocksResult<B>;

type DateBlockRangePriority = ExpandUniqueDateBlocksRetainOverlapOption;

type DateBlockRangePriorityPair<B extends DateBlockRange | UniqueDateBlock> = {
  priority: DateBlockRangePriority;
  block: B;
};

export function expandUniqueDateBlocksFunction<B extends DateBlockRange | UniqueDateBlock>(config: ExpandUniqueDateBlocksConfig<B>): ExpandUniqueDateBlocksFunction<B> {
  const { startAtIndex = 0, endAtIndex, fillOption: fill, fillFactory: inputFillFactory, retainOnOverlap: inputRetainOnOverlap } = config;
  const retainOnOverlap = inputRetainOnOverlap ?? 'next';
  const maxAllowedIndex: IndexNumber = endAtIndex ?? Number.MAX_SAFE_INTEGER;
  const fillFactory = inputFillFactory as FactoryWithRequiredInput<B, DateBlockRange>;

  if (!fillFactory && fill === 'fill') {
    throw new Error('fillFactory is required when fillOption is "fill".');
  }

  return (input: B[] | UniqueDateBlockRangeGroup<B>, newBlocks?: B[] | UniqueDateBlockRangeGroup<B>) => {
    const inputGroup = Array.isArray(input) ? groupUniqueDateBlocks(input) : input;
    const sorted: DateBlockRangePriorityPair<B>[] = inputGroup.blocks.map((block) => ({ priority: 'current', block }));

    if (newBlocks != null) {
      const inputOverwriteGroup = Array.isArray(newBlocks) ? groupUniqueDateBlocks(newBlocks) : newBlocks;
      mergeArrayIntoArray(
        sorted,
        inputOverwriteGroup.blocks.map((block) => ({ priority: 'next', block }))
      ).sort((a, b) => a.block.i - b.block.i);
    }

    const blocks: B[] = [];
    const discarded: B[] = [];

    let current: DateBlockRangePriorityPair<B> = sorted[0];
    let currentNextIndex: IndexNumber;

    let next: DateBlockRangePriorityPair<B> = sorted[1];
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

      const to = Math.min(inputTo, maxAllowedIndex) || 0;

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
        const dateBlockRange: DateBlockRangeWithRange = {
          i,
          to
        };

        const block: B = fillFactory(dateBlockRange);
        addBlockWithRange(block, i, to ?? i);
      } else if (blocks.length > 0) {
        // do not extend if no blocks have been pushed.
        const blockToExtend = lastValue(blocks);
        (blockToExtend as DateBlockRange).to = inputTo;
      }

      latestTo = to;
    }

    function continueToNext(use?: B, priority?: DateBlockRangePriority) {
      i += 1;
      current = use != null ? ({ block: use, priority } as DateBlockRangePriorityPair<B>) : sorted[i];
      next = sorted[i + 1];

      if (next) {
        nextStartIndex = next.block.i;

        // complete loop once past the max allowed index
        if (nextStartIndex > maxAllowedIndex) {
          continueLoop = false;
        } else {
          const nextEndIndex = dateBlockEndIndex(next.block);

          if (nextEndIndex <= latestTo) {
            discardCurrent(); // skip until next is not less than or equal to the latest to
            continueToNext();
          }
        }
      } else {
        continueLoop = false;
      }
    }

    function discard(pair: DateBlockRangePriorityPair<B>) {
      discarded.push(pair.block);
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

    /**
     * Used to determine how to handle two neighboring objects.
     */
    function shouldRetainCurrentOverNext() {
      if (current.priority === next.priority) {
        return retainOnOverlap === 'current';
      } else {
        return current.priority === retainOnOverlap;
      }
    }

    while (continueLoop) {
      currentNextIndex = current.block.i;
      nextStartIndex = next.block.i;

      const currentEndIndex = dateBlockEndIndex(current.block);
      const nextEndIndex = dateBlockEndIndex(next.block);

      if (nextStartIndex < startAtIndex || currentEndIndex < startAtIndex) {
        // do nothing if the next index is still before the current start index.

        discardCurrent();
        continueToNext();
      } else if (currentNextIndex === nextStartIndex) {
        // if next has the same range as current, then look at the tie-breaker
        if (nextEndIndex === currentEndIndex) {
          // if they're both on the same index, then take the one based on the overwrite value
          if (shouldRetainCurrentOverNext()) {
            // add current
            addBlockWithRange(current.block, currentNextIndex, nextEndIndex);
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
          if (shouldRetainCurrentOverNext()) {
            // add current
            addBlockWithRange(current.block, currentNextIndex, currentEndIndex);
            // change next to start at the next range
            continueToNext({ ...next.block, i: currentEndIndex + 1, to: nextEndIndex }, next.priority);
          } else {
            //
            discardCurrent();
            continueToNext();
          }
        } else {
          // the next item ends before the current item.
          if (shouldRetainCurrentOverNext()) {
            // discard the next value.
            discard(next);
            // continue with the current value
            continueToNext(current.block, current.priority);
          } else {
            // add the next item first since it overwrites the current
            addBlockWithRange(next.block, nextStartIndex, nextEndIndex);
            // continue with the current item as next.
            continueToNext({ ...current.block, i: nextEndIndex + 1, to: currentEndIndex }, current.priority);
          }
        }
      } else {
        // Check for any overlap
        if (currentEndIndex >= nextStartIndex) {
          // handle overlap
          if (shouldRetainCurrentOverNext()) {
            // add current
            addBlockWithRange(current.block, currentNextIndex, currentEndIndex);

            if (nextEndIndex > currentEndIndex) {
              // change next to start at the next range
              continueToNext({ ...next.block, i: currentEndIndex + 1, to: nextEndIndex }, next.priority);
            } else {
              // continue normally
              continueToNext();
            }
          } else {
            // add current up to the start index of next
            addBlockWithRange(current.block, currentNextIndex, nextStartIndex - 1);

            // check if the next one is fully contained
            if (nextEndIndex < currentEndIndex) {
              // add the next
              addBlockWithRange(next.block, nextStartIndex, nextEndIndex);

              // continue with the current
              continueToNext({ ...current.block, i: nextEndIndex + 1, to: currentEndIndex }, next.priority);
            } else {
              // continue to next
              continueToNext();
            }
          }
        } else {
          // no overlap

          // add the current block
          addBlockWithRange(current.block, currentNextIndex, currentEndIndex);
          // continue to next
          continueToNext();
        }
      }
    }

    if (current != null) {
      // if current != null, then atleast one block was input/remaining.
      const lastStartIndex = current.block.i;
      const lastEndIndex = dateBlockEndIndex(current.block);

      if (lastEndIndex < startAtIndex || lastEndIndex <= latestTo || lastStartIndex > maxAllowedIndex) {
        // if the block ends before the start index, then do nothing.
        discardCurrent();
      } else {
        addBlockWithRange(current.block, Math.max(startAtIndex, lastStartIndex), Math.min(lastEndIndex, maxAllowedIndex));
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
