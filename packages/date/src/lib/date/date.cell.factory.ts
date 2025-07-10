import { parseISO8601DayStringToUTCDate, type Maybe, type ArrayOrValue, asArray, pushArrayItemsIntoArray, type FilterFunction, indexRangeCheckFunction, mergeFilterFunctions, type IndexRange, HOURS_IN_DAY, range, type ISO8601DayString, isDate, type IndexNumber, type Minutes, type GetterOrValue, asGetter, type Building } from '@dereekb/util';
import { addMinutes, isAfter, differenceInHours, addHours, isBefore } from 'date-fns';
import { guessCurrentTimezone } from './date';
import {
  type DateCell,
  type DateCellIndex,
  type DateOrDateCellIndex,
  type DateCellTiming,
  type DateCellArrayRef,
  type DateCellArray,
  type DateCellTimingRangeInput,
  dateCellTiming,
  dateCellTimingStartPair,
  type DateCellCollection,
  type DateCellDurationSpan,
  type DateCellTimingStartsAt,
  type DateCellTimingEvent,
  type DateCellTimingStartsAtEndRange,
  calculateExpectedDateCellTimingDuration,
  dateCellTimingFinalStartsAtEvent,
  type FullDateCellTiming,
  dateCellTimingStart,
  isDateCellTiming
} from './date.cell';
import { type DateCellRange, dateCellRangeHasRange, type DateCellRangeWithRange, type DateCellOrDateCellIndexOrDateCellRange, type DateOrDateRangeOrDateCellIndexOrDateCellRange, isDateCellWithinDateCellRangeFunction } from './date.cell.index';
import { type DateRange, type DateRangeStart, isDateRange, isDateRangeStart } from './date.range';
import { copyHoursAndMinutesFromDateWithTimezoneNormal, type DateTimezoneConversionConfigUseSystemTimezone, type DateTimezoneUtcNormalInstance } from './date.timezone';

/**
 * Input for dateCellRange
 */
export interface DateCallIndexRangeFromDatesFactoryConfig {
  /**
   * Timing to use relative to the input.
   */
  readonly timing: DateCellTiming;
  /**
   * Whether or not to fit the returned range to the timing's range.
   *
   * Defaults to true.
   */
  readonly fitToTimingRange?: boolean;
  /**
   * Only include the index if the timing is marked as complete for that index.
   *
   * If no indexes have been completed, the returned value range will be -1 to -1.
   *
   * Defaults to false.
   */
  readonly limitToCompletedIndexes?: boolean;
  /**
   * (Optional) now date/getter used to influence the limitToCompletedIndexes calculations.
   */
  readonly now?: GetterOrValue<Date>;
}

/**
 * DateCellRangeOfTimingFactory input
 */
export interface DateCellRangeOfTimingInput {
  /**
   * Start date or index
   */
  readonly i?: Maybe<DateOrDateCellIndex>;
  /**
   * End date or index
   */
  readonly to?: Maybe<DateOrDateCellIndex>;
}

/**
 * Creates a DateCellRange from the input.
 */
export type DateCellRangeOfTimingFactory = (input?: Maybe<DateCellRangeOfTimingInput>) => DateCellRangeWithRange;

/**
 * Creates a DateCellRangeOfTimingFactory.
 *
 * @param config
 * @returns
 */
export function dateCellRangeOfTimingFactory(config: DateCallIndexRangeFromDatesFactoryConfig): DateCellRangeOfTimingFactory {
  const { timing, fitToTimingRange = true, limitToCompletedIndexes: onlyIncludeIfComplete = false, now: inputNowGetter } = config;
  const nowGetter = asGetter(inputNowGetter ?? (() => new Date()));
  const indexFactory = dateCellTimingRelativeIndexFactory(timing);
  const minIndex = fitToTimingRange ? 0 : Number.MIN_SAFE_INTEGER;
  const maxIndex = fitToTimingRange ? indexFactory(indexFactory._timing.end) : Number.MAX_SAFE_INTEGER;

  let getCurrentMaxIndex: () => IndexNumber;

  if (onlyIncludeIfComplete) {
    const timingInfoFactory = dateCellDayTimingInfoFactory({ timing });
    const endAtFactory = dateCellTimingEndDateFactory(timing);

    let nextExpectedIndexChangeAt: Date;
    let currentMaxDay: IndexNumber;

    function refreshCurrentInfo() {
      const now = nowGetter();
      const currentInfo = timingInfoFactory(now, now);

      if (fitToTimingRange && currentInfo.isComplete) {
        // if the timing is complete relative to now, then update to prevent any further updates since the max will not change anymore
        currentMaxDay = indexFactory(indexFactory._timing.end);
        getCurrentMaxIndex = () => currentMaxDay;
      } else {
        const latestCompletedIndex = currentInfo.isInProgress ? currentInfo.currentIndex - 1 : currentInfo.currentIndex;

        // calculate the next max change. It occurs whenever the current index ends
        nextExpectedIndexChangeAt = endAtFactory(latestCompletedIndex + 1);
        currentMaxDay = fitToTimingRange ? Math.max(latestCompletedIndex, -1) : latestCompletedIndex; // the currentIndex day is not yet complete.
      }
    }

    refreshCurrentInfo();

    getCurrentMaxIndex = () => {
      const now = nowGetter();

      if (!isBefore(now, nextExpectedIndexChangeAt)) {
        // refresh since we're expecting the index change
        refreshCurrentInfo();
      }

      return currentMaxDay;
    };
  } else {
    getCurrentMaxIndex = () => maxIndex;
  }

  return (input?: Maybe<DateCellRangeOfTimingInput>): DateCellRangeWithRange => {
    const { i: start, to: end } = input ?? {};

    const startIndex = indexFactory(start ?? 0);
    const endIndex = indexFactory(end ?? nowGetter());
    const maxIndex = getCurrentMaxIndex();

    const to = Math.min(maxIndex, endIndex); // calculate to first to get the max value
    const i = Math.min(Math.max(minIndex, startIndex), to); // i should never be greater than to

    return { i, to };
  };
}

/**
 * Creates a DateCellRange from the input.
 *
 * Convenience function for calling dateCellRangeOfTimingFactory() then passing the input.
 *
 * @param config
 * @param input
 * @returns
 */
export function dateCellRangeOfTiming(config: DateCellTiming | DateCallIndexRangeFromDatesFactoryConfig, input?: Maybe<DateCellRangeOfTimingInput>): DateCellRangeWithRange {
  return dateCellRangeOfTimingFactory(isDateCellTiming(config) ? { timing: config } : config)(input);
}

export type DateCellTimingCompleteTimeRangeConfig = Pick<DateCallIndexRangeFromDatesFactoryConfig, 'now' | 'fitToTimingRange'>;

/**
 * Convenience function for dateCellRangeOfTiming() that returns the latest completed index.
 *
 * By default fitToTimingRange is true.
 */
export function dateCellTimingCompletedTimeRange(timing: DateCellTiming, config?: DateCellTimingCompleteTimeRangeConfig): DateCellRangeWithRange {
  return dateCellRangeOfTiming({
    timing,
    now: config?.now,
    fitToTimingRange: config?.fitToTimingRange ?? true, // default to true
    limitToCompletedIndexes: true
  });
}

/**
 * Returns the latest completed index for a DateCellTiming.
 *
 * Returns -1 if no days have been completed.
 *
 * @param timing
 * @param now
 */
export function dateCellTimingLatestCompletedIndex(timing: DateCellTiming, now?: Date): IndexNumber {
  return dateCellTimingCompletedTimeRange(timing, { now }).to;
}

/**
 * IndexRange used with DateCells.
 *
 * It has an exclusive max range. It is similar to a DateCellRange.
 */
export type DateCellIndexRange = IndexRange;

export function dateCellRangeToDateCellIndexRange(range: DateCellRange): DateCellIndexRange {
  return { minIndex: range.i, maxIndex: (range.to ?? range.i) + 1 };
}

export function dateCellIndexRangeToDateCellRange(range: DateCellIndexRange): DateCellRangeWithRange {
  return { i: range.minIndex, to: range.maxIndex - 1 };
}

/**
 * Generates a DateCellIndexRange based on the input timing.
 *
 * An arbitrary limit can also be applied.
 *
 * @param timing
 * @param limit
 * @param fitToTimingRange
 */
export function dateCellIndexRange(timing: DateCellTiming, limit?: DateCellTimingRangeInput, fitToTimingRange = true): DateCellIndexRange {
  const indexFactory = dateCellTimingRelativeIndexFactory(timing);
  const { startsAt: lastStartsAt } = dateCellTimingFinalStartsAtEvent(timing); // use last startsAt date for the proper date

  let minIndex: IndexNumber = 0;
  let maxIndex: IndexNumber = indexFactory(lastStartsAt) + 1; // add one since this is a DateCellIndexRange, and not a DateCellRange.

  if (limit) {
    const { start, end } = dateCellTiming(timing, limit);
    const limitMin = indexFactory(start);
    const limitMax = indexFactory(end) + 1;

    if (fitToTimingRange) {
      minIndex = Math.max(limitMin, minIndex);
      maxIndex = Math.min(limitMax, maxIndex);
    } else {
      minIndex = limitMin;
      maxIndex = limitMax;
    }
  }

  return { minIndex, maxIndex };
}

/**
 * Convenience function for calling expandDateCells() with the input DateCellCollection.
 *
 * @param collection
 * @returns
 */
export function expandDateCellCollection<B extends DateCell = DateCell>(collection: DateCellCollection<B>): DateCellDurationSpan<B>[] {
  return expandDateCellTiming(collection.timing, collection.blocks);
}

/**
 * Convenience function for calling dateCellTimingExpansionFactory() then passing the blocks.
 *
 * @param blocks
 * @param timing
 * @returns
 */
export function expandDateCellTiming<B extends DateCell = DateCell>(timing: DateCellTiming, blocks: B[]): DateCellDurationSpan<B>[] {
  return dateCellTimingExpansionFactory<B>({ timing })(blocks);
}

export type DateCellTimingExpansionFactoryInput<B extends DateCell | DateCellRange = DateCell> = DateCellArrayRef<B> | DateCellArray<B>;

/**
 * Used to convert the input DateCellTimingExpansionFactoryInput into an array of DateCellDurationSpan values
 */
export type DateCellTimingExpansionFactory<B extends DateCell | DateCellRange = DateCell> = (input: DateCellTimingExpansionFactoryInput<B>) => DateCellDurationSpan<B>[];

export interface DateCellTimingExpansionFactoryConfig<B extends DateCell | DateCellRange = DateCell> {
  /**
   * Timing to use in the configuration.
   */
  timing: DateCellTiming;
  /**
   * Range to limit duration span output to.
   *
   * If not provided, uses the input timing's range.
   * If false, the timing's range is ignored too, and only the DateCellIndex values are considered.
   */
  rangeLimit?: DateCellTimingRangeInput | false;
  /**
   * Additional filter function to filter potential blocks in/out.
   */
  filter?: FilterFunction<B>;
  /**
   * (Optional) Additional filter function based on the calcualted DateCellDurationSpan.
   */
  durationSpanFilter?: FilterFunction<DateCellDurationSpan<B>>;
  /**
   * (Optional) Max number of blocks to evaluate.
   */
  blocksEvaluationLimit?: number;
  /**
   * (Optional) Max number of DateCellDurationSpan values to return.
   */
  maxDateCellsToReturn?: number;
}

/**
 * Creates a DateCellTimingExpansionFactory
 *
 * @param config
 * @returns
 */
export function dateCellTimingExpansionFactory<B extends DateCell | DateCellRange = DateCell>(config: DateCellTimingExpansionFactoryConfig): DateCellTimingExpansionFactory<B> {
  const { timing, rangeLimit, filter: inputFilter, durationSpanFilter: inputDurationSpanFilter, maxDateCellsToReturn = Number.MAX_SAFE_INTEGER, blocksEvaluationLimit = Number.MAX_SAFE_INTEGER } = config;
  const { duration } = timing;
  const indexRange = rangeLimit !== false ? dateCellIndexRange(timing, rangeLimit) : { minIndex: Number.MIN_SAFE_INTEGER, maxIndex: Number.MAX_SAFE_INTEGER };

  const isInRange = indexRangeCheckFunction({ indexRange, inclusiveMaxIndex: false });
  const filter: FilterFunction<B> = mergeFilterFunctions<B>((x: B) => isInRange(x.i), inputFilter);
  const startsAtFactory = dateCellTimingStartsAtDateFactory(timing);
  const durationSpanFilter: FilterFunction<DateCellDurationSpan<B>> = inputDurationSpanFilter ?? (() => true);

  return (input: DateCellTimingExpansionFactoryInput<B>) => {
    const blocks = Array.isArray(input) ? input : input.blocks;
    const spans: DateCellDurationSpan<B>[] = [];

    let blocksEvaluated = 0;

    function filterAndPush(block: B, blockIndex: number) {
      // increase the evaluation count early in-case we set the blocksEvaluationLimit below.
      blocksEvaluated += 1;

      if (filter(block, blockIndex)) {
        const startsAt = startsAtFactory(block.i);
        const durationSpan: DateCellDurationSpan<B> = {
          ...block,
          startsAt,
          duration
        };

        // try the duration span filter
        if (durationSpanFilter(durationSpan, blockIndex)) {
          if (spans.length >= maxDateCellsToReturn) {
            blocksEvaluated = blocksEvaluationLimit; // trigger return below
          } else {
            spans.push(durationSpan);
          }
        }
      }
    }

    blocks.findIndex((block) => {
      if (dateCellRangeHasRange(block)) {
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

      return blocksEvaluated >= blocksEvaluationLimit; // continue iterating until we hit the evaluation limit or run out of items.
    });

    return spans;
  };
}

export type DateCellDayTimingInfoFactoryConfig = Pick<DateCellTimingExpansionFactoryConfig, 'timing' | 'rangeLimit'>;

export interface DateCellDayTimingInfo {
  /**
   * Input date or calculated date if provided a dayIndex.
   */
  readonly date: Date;
  /**
   * Index for the day for the input date.
   */
  readonly dayIndex: DateCellIndex;
  /**
   * Index for the previous index/current index depending on the TimingInfo's daily execution.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex.
   */
  readonly currentIndex: DateCellIndex;
  /**
   * Index for the next execution. Does not check if it is in range.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex + 1.
   */
  readonly nextIndex: DateCellIndex;
  /**
   * Index for the next execution, if in the range, otherwise undefined.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex + 1.
   */
  readonly nextIndexInRange: Maybe<DateCellIndex>;
  /**
   * Whether or not there are any inProgress or upcoming executions.
   *
   * True if nextIndexInRange is undefined and isInProgress is false.
   */
  readonly isComplete: boolean;
  /**
   * Whether or not today's timing has already occured in it's entirety.
   */
  readonly hasOccuredToday: boolean;
  /**
   * Whether or not a timing is currently in progress.
   *
   * This can be true when isInProgressForDayIndex is false for cases where the timing starts at the previous day index and rolls on over into the next day.
   */
  readonly isInProgress: boolean;
  /**
   * Whether or not today's timing is currently in progress for the input dayIndex.
   */
  readonly isInProgressForDayIndex: boolean;
  /**
   * Whether or not the block is within the configured range.
   */
  readonly isInRange: boolean;
  /**
   * Time the timing starts on the input day.
   */
  readonly startsAtOnDay: Date;
  /**
   * Time the timing ends on the input day.
   */
  readonly endsAtOnDay: Date;
  /**
   * "now" value used for considering current progress.
   */
  readonly now: Date;
}

/**
 * Generates DateCellDayTimingInfo about the input date relative to the input timing and range limit.
 *
 * The date may not exist within the range, but will still compute values using the input date and timing configuration.
 *
 * Can optionally specify a now that is used for checking the inProgress functionality.
 */
export type DateCellDayTimingInfoFactory = ((date: DateOrDateCellIndex, now?: Date) => DateCellDayTimingInfo) & {
  readonly _indexFactory: DateCellTimingRelativeIndexFactory;
  readonly _startsAtFactory: DateCellTimingStartsAtDateFactory;
};

export function dateCellDayTimingInfoFactory(config: DateCellDayTimingInfoFactoryConfig): DateCellDayTimingInfoFactory {
  const { timing, rangeLimit } = config;
  const { duration } = timing;
  const indexRange = rangeLimit !== false ? dateCellIndexRange(timing, rangeLimit) : { minIndex: Number.MIN_SAFE_INTEGER, maxIndex: Number.MAX_SAFE_INTEGER };
  const checkIsInRange = indexRangeCheckFunction({ indexRange, inclusiveMaxIndex: false });
  const indexFactory = dateCellTimingRelativeIndexFactory(timing);
  const dayFactory = dateCellTimingDateFactory(timing);
  const startsAtFactory = dateCellTimingStartsAtDateFactory(indexFactory);

  const fn = ((input: DateOrDateCellIndex, inputNow?: Date) => {
    const date = typeof input === 'number' ? dayFactory(input) : input;

    const dayIndex = indexFactory(input);
    const isInRange = checkIsInRange(dayIndex);

    const now = inputNow ?? date;
    const startsAtOnDay = startsAtFactory(dayIndex); // convert back to the proper date
    const endsAtOnDay = addMinutes(startsAtOnDay, duration);
    const potentiallyInProgress = !isAfter(startsAtOnDay, now); // is potentially in progress if the now is equal-to or after the start time.

    const isInProgressForDayIndex = potentiallyInProgress && !isAfter(now, endsAtOnDay);
    const hasOccuredToday = potentiallyInProgress && !isInProgressForDayIndex;

    const currentIndex: DateCellIndex = isInProgressForDayIndex || hasOccuredToday ? dayIndex : dayIndex - 1; // If not in progress and hasn't occured today, current index is the previous index.

    let isInProgress: boolean = false;

    if (isInProgressForDayIndex) {
      isInProgress = true;
    } else if (currentIndex < dayIndex) {
      const expectedStartForCurrentIndex = startsAtFactory(currentIndex);

      if (!isBefore(now, expectedStartForCurrentIndex)) {
        // if now is after the expected start time, then check that the end time hasn't occured yet.

        const expectedEndTime = addMinutes(expectedStartForCurrentIndex, duration);
        isInProgress = !isAfter(now, expectedEndTime);
      }
    }

    const nextIndex: DateCellIndex = currentIndex + 1;
    const nextIndexInRange: Maybe<DateCellIndex> = checkIsInRange(nextIndex) ? nextIndex : undefined;

    const isComplete = currentIndex >= 0 && !nextIndexInRange && (!isInRange || hasOccuredToday);

    return {
      now,
      date,
      dayIndex,
      currentIndex,
      nextIndex,
      hasOccuredToday,
      isInProgress,
      isInProgressForDayIndex,
      isInRange,
      startsAtOnDay,
      endsAtOnDay,
      nextIndexInRange,
      isComplete,
      _indexRange: indexRange
    };
  }) as Building<DateCellDayTimingInfoFactory>;

  fn._indexFactory = indexFactory;
  fn._startsAtFactory = startsAtFactory;

  return fn as DateCellDayTimingInfoFactory;
}

/**
 * DateCellTimingRelativeIndexFactory input. Can be a Date, DateCellIndex, or ISO8601DayString
 */
export type DateCellTimingRelativeIndexFactoryInput = DateOrDateCellIndex | ISO8601DayString;

/**
 * Returns the DateCellIndex of the input date relative to the configured Date.
 *
 * Input dates should be in system time zone and not normalized to a different timezone.
 */
export type DateCellTimingRelativeIndexFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt> = ((input: DateCellTimingRelativeIndexFactoryInput) => DateCellIndex) & {
  readonly _timing: T;
  readonly _normalInstance: DateTimezoneUtcNormalInstance;
};

/**
 * Returns true if the input is a DateCellTimingRelativeIndexFactory.
 *
 * @param input
 * @returns
 */
export function isDateCellTimingRelativeIndexFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt>(input: unknown): input is DateCellTimingRelativeIndexFactory<T> {
  return typeof input === 'function' && (input as DateCellTimingRelativeIndexFactory)._timing != null && (input as DateCellTimingRelativeIndexFactory)._normalInstance != null;
}

/**
 * Creates a DateCellTimingRelativeIndexFactory from the input.
 *
 * @param input
 * @returns
 */
export function dateCellTimingRelativeIndexFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt>(input: T | DateCellTimingRelativeIndexFactory<T>): DateCellTimingRelativeIndexFactory<T> {
  if (isDateCellTimingRelativeIndexFactory(input)) {
    return input;
  } else {
    const timing = input;
    const { start, normalInstance } = dateCellTimingStartPair(input);
    const startInUtc = normalInstance.baseDateToTargetDate(start); // takes the target date and puts in into UTC normal

    const factory = ((input: DateOrDateCellIndex | ISO8601DayString) => {
      const inputType = typeof input;
      let diff: number;

      if (inputType === 'number') {
        return input;
      } else if (inputType === 'string') {
        const startOfDayInUtc = parseISO8601DayStringToUTCDate(input as string); // parse as UTC
        diff = differenceInHours(startOfDayInUtc, startInUtc, { roundingMethod: 'floor' }); // compare the UTC times. Round down.
        // console.log({ startOfDayInUtc, diff, startInUtc });
      } else {
        const dateInUtc = normalInstance.baseDateToTargetDate(input as Date); // convert to UTC normal
        diff = differenceInHours(dateInUtc, startInUtc, { roundingMethod: 'floor' }); // compare the difference in UTC times. Round down.
        // console.log({ input, dateInUtc, diff, startInUtc, tz: normalInstance.configuredTimezoneString, systemTargetOffset: normalInstance.targetDateToSystemDateOffset(input as Date) / MS_IN_HOUR, targetBaseOffset: normalInstance.targetDateToBaseDateOffset(input as Date) / MS_IN_HOUR });
      }

      const daysOffset = Math.floor(diff / HOURS_IN_DAY); // total number of hours difference from the original UTC date
      return daysOffset ? daysOffset : 0; // do not return -0
    }) as Building<DateCellTimingRelativeIndexFactory<T>>;
    factory._timing = timing;
    factory._normalInstance = normalInstance;
    return factory as DateCellTimingRelativeIndexFactory<T>;
  }
}

/**
 * Function that wraps a DateCellTimingRelativeIndexFactory and converts multuple Date/DateCellIndex/DateCellRange values into an array of DateCellIndex values.
 */
export type DateCellTimingRelativeIndexArrayFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt> = ((input: ArrayOrValue<DateOrDateRangeOrDateCellIndexOrDateCellRange>) => DateCellIndex[]) & {
  readonly _indexFactory: DateCellTimingRelativeIndexFactory<T>;
};

/**
 * Creates a DateCellTimingRelativeIndexArrayFactory from the input DateCellTimingRelativeIndexFactory.
 *
 * @param indexFactory
 */
export function dateCellTimingRelativeIndexArrayFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt>(indexFactory: DateCellTimingRelativeIndexFactory<T>): DateCellTimingRelativeIndexArrayFactory<T> {
  const factory = ((input: ArrayOrValue<DateOrDateRangeOrDateCellIndexOrDateCellRange>) => {
    const inputAsArray = asArray(input);
    const result: DateCellIndex[] = [];

    inputAsArray.forEach((value: DateOrDateRangeOrDateCellIndexOrDateCellRange) => {
      let resultIndexes: DateCellIndex[];

      if (typeof value === 'object' && !isDate(value)) {
        if (isDateRange(value)) {
          resultIndexes = range(indexFactory(value.start), indexFactory(value.end) + 1);
        } else {
          resultIndexes = range(value.i, (value.to ?? value.i) + 1);
        }
      } else {
        resultIndexes = [indexFactory(value)];
      }

      pushArrayItemsIntoArray(result, resultIndexes);
    });

    return result;
  }) as Building<DateCellTimingRelativeIndexArrayFactory<T>>;
  factory._indexFactory = indexFactory;
  return factory as DateCellTimingRelativeIndexArrayFactory<T>;
}

/**
 * Gets the relative index of the input date compared to the input timing.
 *
 * @param timing
 * @param date
 */
export function getRelativeIndexForDateCellTiming(timing: DateCellTimingStartsAt, date: DateOrDateCellIndex = new Date()): DateCellIndex {
  return dateCellTimingRelativeIndexFactory(timing)(date);
}

/**
 * Similar to the DateCellTimingRelativeIndexFactory, but returns a date instead of an index for the input.
 *
 * Returns a date with the hours and minutes for "now" for the given date returned if an index is input.
 */
export type DateCellTimingDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt> = ((input: DateOrDateCellIndex, now?: Date) => Date) & {
  readonly _timing: T;
};

/**
 * Creates a DateCellTimingDateFactory.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt>(timing: T): DateCellTimingDateFactory<T> {
  const { start, normalInstance } = dateCellTimingStartPair(timing);
  const utcStartDate = normalInstance.baseDateToTargetDate(start);
  const startUtcHours = start.getUTCHours();

  const factory = ((input: DateOrDateCellIndex, inputNow?: Date) => {
    if (isDate(input)) {
      return input;
    } else {
      const now = inputNow ?? new Date();
      const nowHours = now.getUTCHours();
      const utcStartDateWithNowTime = new Date(Date.UTC(utcStartDate.getUTCFullYear(), utcStartDate.getUTCMonth(), utcStartDate.getUTCDate(), nowHours, now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()));

      // if the current hours are less than the UTC offset hours, then bump one extra day forward to be sure we're in the correct day.
      if (startUtcHours > nowHours) {
        input += 1;
      }

      const nowWithDateForIndex = addHours(utcStartDateWithNowTime, input * HOURS_IN_DAY); // add days to apply the correct offset to the target index
      return nowWithDateForIndex;
    }
  }) as Building<DateCellTimingDateFactory>;
  factory._timing = timing;
  return factory as DateCellTimingDateFactory<T>;
}

/**
 * Returns the last index of a DateCellTiming.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingEndIndex(input: DateCellTiming | DateCellTimingRelativeIndexFactory<DateCellTiming>): IndexNumber {
  const factory = dateCellTimingRelativeIndexFactory(input);
  return factory(factory._timing.end);
}

/**
 * Returns the start time of the input date or index.
 */
export type DateCellTimingStartDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt> = ((input: DateCellTimingRelativeIndexFactoryInput) => Date) & {
  readonly _indexFactory: DateCellTimingRelativeIndexFactory<T>;
};

export type DateCellTimingUseSystemAndIgnoreEnforcement = DateTimezoneConversionConfigUseSystemTimezone & {
  /**
   * Skips the assertion that the timezone matches. This defaults to true if not provided.
   */
  assertTimingMatchesTimezone: false;
};

/**
 * Creates a DateCellTimingDateFactory.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingStartDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt>(input: T | DateCellTimingRelativeIndexFactory<T>): DateCellTimingStartDateFactory<T> {
  const indexFactory = dateCellTimingRelativeIndexFactory<T>(input);
  const { start, normalInstance } = dateCellTimingStartPair(indexFactory._timing);
  const utcStartDate = normalInstance.baseDateToTargetDate(start);

  const factory = ((input: DateCellTimingRelativeIndexFactoryInput) => {
    const index = indexFactory(input); // get the index
    const startInUtc = addHours(utcStartDate, index * HOURS_IN_DAY);
    return normalInstance.targetDateToBaseDate(startInUtc);
  }) as Building<DateCellTimingStartDateFactory>;
  factory._indexFactory = indexFactory;
  return factory as DateCellTimingStartDateFactory<T>;
}

/**
 * Returns the startsAt time of the input date or index.
 */
export type DateCellTimingStartsAtDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt> = ((input: DateCellTimingRelativeIndexFactoryInput) => Date) & {
  readonly _indexFactory: DateCellTimingRelativeIndexFactory<T>;
};

/**
 * Creates a DateCellTimingStartsAtDateFactory.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingStartsAtDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt>(input: T | DateCellTimingRelativeIndexFactory<T>): DateCellTimingStartsAtDateFactory<T>;
export function dateCellTimingStartsAtDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt>(input: T | DateCellTimingRelativeIndexFactory<T>): DateCellTimingStartsAtDateFactory<T> {
  const indexFactory = dateCellTimingRelativeIndexFactory<T>(input);
  const normalInstance = indexFactory._normalInstance;
  const utcStartsAtDate = normalInstance.baseDateToTargetDate(indexFactory._timing.startsAt);

  const factory = ((input: DateCellTimingRelativeIndexFactoryInput) => {
    const index = indexFactory(input); // get the index
    const startAtInUtc = addHours(utcStartsAtDate, index * HOURS_IN_DAY);
    return normalInstance.targetDateToBaseDate(startAtInUtc);
  }) as Building<DateCellTimingStartsAtDateFactory>;
  factory._indexFactory = indexFactory;
  return factory as DateCellTimingStartsAtDateFactory<T>;
}

/**
 * Returns the startsAt time of the input date or index.
 */
export type DateCellTimingEndDateFactory<T extends DateCellTiming = DateCellTiming> = ((input: DateCellTimingRelativeIndexFactoryInput) => Date) & {
  readonly _startsAtDateFactory: DateCellTimingStartsAtDateFactory<T>;
};

/**
 * Creates a DateCellTimingStartsAtDateFactory.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingEndDateFactory<T extends DateCellTiming = DateCellTiming>(input: T | DateCellTimingRelativeIndexFactory<T>): DateCellTimingEndDateFactory<T>;
export function dateCellTimingEndDateFactory<T extends DateCellTiming = DateCellTiming>(input: T | DateCellTimingRelativeIndexFactory<T>): DateCellTimingEndDateFactory<T> {
  const startsAtDateFactory = dateCellTimingStartsAtDateFactory(input);
  const { duration } = startsAtDateFactory._indexFactory._timing;

  const factory = ((input: DateCellTimingRelativeIndexFactoryInput) => {
    const startsAt = startsAtDateFactory(input); // get the startsAt for that day
    return addMinutes(startsAt, duration); // add the duration
  }) as Building<DateCellTimingEndDateFactory>;
  factory._startsAtDateFactory = startsAtDateFactory;
  return factory as DateCellTimingEndDateFactory<T>;
}

/**
 * Returns the date of the input index.
 *
 * @param timing
 * @param date
 */
export function getRelativeDateForDateCellTiming(timing: DateCellTimingStartsAt, input: DateOrDateCellIndex): Date {
  return dateCellTimingDateFactory(timing)(input);
}

export interface UpdateDateCellTimingWithDateCellTimingEventInput {
  /**
   * Target timing to update.
   */
  readonly timing: DateCellTimingStartsAtEndRange;
  /**
   * Event used to update the timing.
   */
  readonly event: DateCellTimingEvent;
  /**
   * Custom start date day to use instead of the event's start date.
   *
   * It is generated relative to the timing's current startsAt, and not the event's starts at, so index 0 is the first day of the Timing, not the event.
   *
   * Ignored if replaceStartDay is not true.
   */
  readonly startDayDate?: DateCellTimingRelativeIndexFactoryInput;
  /**
   * Replaces the start date but keeps the startsAt time as-is.
   *
   * Can be combined with replaceStartsAt.
   */
  readonly replaceStartDay?: boolean;
  /**
   * Replaces the startsAt time, but keeps the initial start date.
   *
   * Can be combined with replaceStartDay
   */
  readonly replaceStartsAt?: boolean;
  /**
   * Replaces the end day but keeps the same time.
   */
  readonly endOnEvent?: boolean;
  /**
   * Replaces the duration but keeps the end day intact.
   */
  readonly replaceDuration?: boolean;
}

/**
 * Creates a new DateCellTiming from the input configuration.
 *
 * @param dateCellTimingStartEndRange
 * @param event
 * @param timezone
 * @returns
 */
export function updateDateCellTimingWithDateCellTimingEvent(input: UpdateDateCellTimingWithDateCellTimingEventInput): FullDateCellTiming {
  const { timing, event, replaceStartDay, replaceStartsAt, startDayDate: startDateDay, endOnEvent, replaceDuration } = input;
  const { timezone } = timing;
  const currentDuration = calculateExpectedDateCellTimingDuration(timing);

  let startsAt: Date = timing.startsAt;
  let end: Date = timing.end;
  let duration: Minutes = currentDuration;

  if (replaceStartDay || replaceStartsAt) {
    // if replacing both startsAt and start day, then just set the new starts at time
    if (replaceStartsAt && replaceStartDay) {
      startsAt = event.startsAt; // use the new startsAt as-is
    } else if (replaceStartDay) {
      // keep the same time, but use the day
      let { start: eventStartDate, normalInstance } = dateCellTimingStartPair({ startsAt: event.startsAt, timezone });

      if (startDateDay != null) {
        const startDateFactory = dateCellTimingStartDateFactory(timing);
        eventStartDate = startDateFactory(startDateDay);
      }

      startsAt = copyHoursAndMinutesFromDateWithTimezoneNormal(eventStartDate, timing.startsAt, normalInstance);
    } else {
      // if we're only replacing the startsAt, copy the hours/minutes from the target time
      const { start: currentStart, normalInstance } = dateCellTimingStartPair(timing);
      startsAt = copyHoursAndMinutesFromDateWithTimezoneNormal(currentStart, event.startsAt, normalInstance);
    }
  }

  if (endOnEvent != null || replaceDuration != null) {
    const startsAtDateFactory = dateCellTimingStartsAtDateFactory({ startsAt, timezone });
    let lastStartsAt: Date;

    // the end day should be the date provided by the event's startsAt date.
    if (endOnEvent) {
      lastStartsAt = startsAtDateFactory(event.startsAt);
    } else {
      // get the timing's last start date, and use the new startsAt date factory to calculate the new end date
      // this lets us get the proper last startsAt date for the previous last startsAt date
      const timingLastStartDate = addMinutes(end, -currentDuration);
      lastStartsAt = startsAtDateFactory(timingLastStartDate); // recalculate the new startsAt time
    }

    if (replaceDuration) {
      duration = event.duration;
    }

    end = addMinutes(lastStartsAt, duration);
  }

  return {
    timezone,
    start: dateCellTimingStart({ startsAt, timezone }), // calculate the new start
    startsAt,
    end,
    duration
  };
}

/**
 * Input for a IsDateWithinDateCellRangeFunction
 */
export type IsDateWithinDateCellRangeInput = DateOrDateCellIndex | DateRangeStart | DateRange | DateCell | DateCellRange;

/**
 * Function that returns true if the input range is equal or falls within the configured DateCellRange.
 */
export type IsDateWithinDateCellRangeFunction = (input: IsDateWithinDateCellRangeInput) => boolean;

export interface IsDateWithinDateCellRangeConfig {
  /**
   * Optional DateCellTimingStartsAt to make the indexes relative to when converting date values.
   *
   * If not provided, defaults to the index in the range if a date is provided with the system timezone, or throws an exception if a date range is input.
   */
  startsAt?: DateCellTimingStartsAt;
  /**
   * Range to compare the input to.
   */
  range: IsDateWithinDateCellRangeInput;
}

export function isDateWithinDateCellRangeFunction(config: IsDateWithinDateCellRangeConfig): IsDateWithinDateCellRangeFunction {
  const { startsAt: inputStartsAt, range: inputRange } = config;
  let startsAt: DateCellTimingStartsAt | undefined = inputStartsAt;

  let dateRange: (DateRangeStart & Partial<DateRange>) | undefined;
  let rangeInput: DateCell | DateCellRange | undefined;
  let isDateInput = false;

  if (typeof inputRange === 'number') {
    rangeInput = { i: inputRange };
  } else if (isDate(inputRange)) {
    dateRange = { start: inputRange };
    isDateInput = true;
  } else if (isDateRangeStart(inputRange)) {
    dateRange = inputRange;
  } else {
    rangeInput = inputRange as DateCell | DateCellRange;
  }

  if (!inputStartsAt) {
    if (dateRange && isDateInput) {
      startsAt = { startsAt: inputRange as Date, timezone: guessCurrentTimezone() as string };
    }
  }

  if (!startsAt) {
    throw new Error('Invalid isDateWithinDateCellRangeFunction() config. StartsAt date info could not be determined from input.');
  }

  const indexFactory = dateCellTimingRelativeIndexFactory(startsAt);

  function convertDateRangeToIndexRange(range: DateRangeStart & Partial<DateRange>) {
    const i = indexFactory(range.start);
    const end: Maybe<Date> = (range as DateRange).end;
    const to: Maybe<number> = end != null ? indexFactory(end) : undefined;
    return { i, to };
  }

  if (!rangeInput) {
    if (dateRange) {
      rangeInput = convertDateRangeToIndexRange(dateRange);
    } else {
      throw new Error('Invalid isDateWithinDateCellRangeFunction() config. Range determined from input.'); // shouldn't occur
    }
  }

  const isDateCellWithinDateCellRange = isDateCellWithinDateCellRangeFunction(rangeInput);

  return (input: IsDateWithinDateCellRangeInput) => {
    let range: DateCellOrDateCellIndexOrDateCellRange;

    if (isDate(input)) {
      range = indexFactory(input);
    } else if (isDateRangeStart(input)) {
      range = convertDateRangeToIndexRange(input);
    } else {
      range = input;
    }

    if (typeof input === 'number') {
      range = { i: input };
    }

    return isDateCellWithinDateCellRange(range);
  };
}
