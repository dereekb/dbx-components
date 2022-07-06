import { IndexRange, indexRangeCheckFunction, indexRangeCheckReaderFunction, MINUTES_IN_DAY, MS_IN_DAY, range } from '@dereekb/util';
import { dateRange, DateRange, DateRangeDayDistanceInput, DateRangeType, isDateRange } from './date.range';
import { DateDurationSpan } from './date.duration';
import { differenceInDays, differenceInMilliseconds, isBefore, addDays, addMinutes, setSeconds } from 'date-fns';
import { copyHoursAndMinutesFromDate } from './date';

/**
 * Index from 0 of which day this block represents.
 */
export type DateBlockIndex = number;

/**
 * A duration-span block.
 */
export interface DateBlock {
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
 * - The startsAt time should be greater than or equal to start
 * - The startsAt time should be on the same date as start
 * - The end time should equal the ending date/time of the final end duration.
 */
export interface DateBlockTiming extends DateRange, DateDurationSpan {}

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
  const { start, end, startsAt, duration } = timing;
  const msDifference = differenceInMilliseconds(startsAt, start);
  const hasSeconds = start.getSeconds() !== 0;

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
 * Reference to a DateBlockTiming
 */
export type DateBlockTimingRef = {
  timing: DateBlockTiming;
};

/**
 * An object that implements DateBlockTiming and DateBlockArrayRef
 */
export interface DateBlockCollection<B extends DateBlock = DateBlock> extends DateBlockTiming, DateBlockArrayRef<B> {}

/**
 * An expanded DateBlock that implements DateDurationSpan and contains the DateBlock values.
 */
export type DateBlockDurationSpan<B extends DateBlock = DateBlock> = DateDurationSpan & B;

export function expandDateBlockCollection<B extends DateBlock = DateBlock>(collection: DateBlockCollection<B>): DateBlockDurationSpan<B>[] {
  return expandDateBlocks(collection.blocks, collection);
}

export function expandDateBlocks<B extends DateBlock = DateBlock>(blocks: DateBlock[], timing: DateBlockTiming): DateBlockDurationSpan<B>[] {
  return undefined as any;
}

export type DateBlocksExpansionFactoryInput<B extends DateBlock = DateBlock> = DateBlockArrayRef<B> | DateBlockArray<B>;

/**
 * Used to convert the input DateBlocksExpansionFactoryInput into an array of DateBlockDurationSpan values
 */
export type DateBlocksExpansionFactory = <B extends DateBlock = DateBlock>(input: DateBlocksExpansionFactoryInput<B>) => DateBlockDurationSpan<B>[];

export interface DateBlocksExpansionFactoryConfig {
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
}

/**
 * Creates a DateBlocksExpansionFactory
 *
 * @param config
 * @returns
 */
export function dateBlocksExpansionFactory(config: DateBlocksExpansionFactoryConfig): DateBlocksExpansionFactory {
  const { timing, rangeLimit } = config;
  const { startsAt: baseStart, duration } = timing;
  const indexRange = rangeLimit !== false ? dateBlockIndexRange(timing, rangeLimit) : { minIndex: Number.MIN_SAFE_INTEGER, maxIndex: Number.MAX_SAFE_INTEGER };
  const isInRange = indexRangeCheckFunction(indexRange);

  return <B extends DateBlock = DateBlock>(input: DateBlocksExpansionFactoryInput<B>) => {
    const blocks = Array.isArray(input) ? input : input.blocks;
    let spans: DateBlockDurationSpan<B>[] = [];

    blocks.forEach((x) => {
      if (isInRange(x.i)) {
        const startsAt = addDays(baseStart, x.i);
        const durationSpan: DateBlockDurationSpan<B> = {
          ...x,
          startsAt,
          duration
        };
        spans.push(durationSpan);
      }
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
