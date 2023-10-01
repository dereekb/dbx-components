import { Maybe, ArrayOrValue, asArray, mergeArrayIntoArray, FilterFunction, indexRangeCheckFunction, mergeFilterFunctions, IndexRange, HOURS_IN_DAY, range, Configurable, ISO8601DayString, isDate, IndexNumber, TimezoneString } from '@dereekb/util';
import { addDays, addMinutes, isAfter, differenceInDays, differenceInHours } from 'date-fns';
import { DateCell, DateCellIndex, DateOrDateCellIndex, DateCellTiming, DateCellArrayRef, DateCellArray, DateCellTimingRangeInput, dateCellTiming, dateCellTimingStartPair, DateCellCollection, DateCellDurationSpan, DateCellTimingStartsAt } from './date.cell';
import { DateCellRange, dateCellRangeHasRange, DateCellRangeWithRange, DateCellOrDateCellIndexOrDateCellRange, dateCellRangeWithRange, DateOrDateRangeOrDateCellIndexOrDateCellRange, isDateCellRange, isDateCellWithinDateCellRangeFunction } from './date.cell.index';
import { parseISO8601DayStringToUTCDate } from './date.format';
import { DateRange, DateRangeStart, isDateRange, isDateRangeStart } from './date.range';
import { DateTimezoneConversionConfigUseSystemTimezone, DateTimezoneUtcNormalInstance } from './date.timezone';

/**
 * Convenience function for calling expandDateCells() with the input DateCellCollection.
 *
 * @param collection
 * @returns
 */
export function expandDateCellCollection<B extends DateCell = DateCell>(collection: DateCellCollection<B>): DateCellDurationSpan<B>[] {
  return expandDateCells(collection.timing, collection.blocks);
}

/**
 * Convenience function for calling dateCellsExpansionFactory() then passing the blocks.
 *
 * @param blocks
 * @param timing
 * @returns
 */
export function expandDateCells<B extends DateCell = DateCell>(timing: DateCellTiming, blocks: B[]): DateCellDurationSpan<B>[] {
  return dateCellsExpansionFactory<B>({ timing })(blocks);
}

export type DateCellsExpansionFactoryInput<B extends DateCell | DateCellRange = DateCell> = DateCellArrayRef<B> | DateCellArray<B>;

/**
 * Used to convert the input DateCellsExpansionFactoryInput into an array of DateCellDurationSpan values
 */
export type DateCellsExpansionFactory<B extends DateCell | DateCellRange = DateCell> = (input: DateCellsExpansionFactoryInput<B>) => DateCellDurationSpan<B>[];

export interface DateCellsExpansionFactoryConfig<B extends DateCell | DateCellRange = DateCell> {
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
 * Creates a DateCellsExpansionFactory
 *
 * @param config
 * @returns
 */
export function dateCellsExpansionFactory<B extends DateCell | DateCellRange = DateCell>(config: DateCellsExpansionFactoryConfig): DateCellsExpansionFactory<B> {
  const { timing, rangeLimit, filter: inputFilter, durationSpanFilter: inputDurationSpanFilter, maxDateCellsToReturn = Number.MAX_SAFE_INTEGER, blocksEvaluationLimit = Number.MAX_SAFE_INTEGER } = config;
  const { startsAt: baseStart, duration } = timing;
  const indexRange = rangeLimit !== false ? dateCellIndexRange(timing, rangeLimit) : { minIndex: Number.MIN_SAFE_INTEGER, maxIndex: Number.MAX_SAFE_INTEGER };

  const isInRange = indexRangeCheckFunction({ indexRange, inclusiveMaxIndex: false });
  const filter: FilterFunction<B> = mergeFilterFunctions<B>((x: B) => isInRange(x.i), inputFilter);
  const durationSpanFilter: FilterFunction<DateCellDurationSpan<B>> = inputDurationSpanFilter ?? (() => true);

  return (input: DateCellsExpansionFactoryInput<B>) => {
    const blocks = Array.isArray(input) ? input : input.blocks;
    const spans: DateCellDurationSpan<B>[] = [];

    let blocksEvaluated = 0;

    function filterAndPush(block: B, blockIndex: number) {
      // increase the evaluation count early in-case we set the blocksEvaluationLimit below.
      blocksEvaluated += 1;

      if (filter(block, blockIndex)) {
        const startsAt = addDays(baseStart, block.i); // TODO: Use the startsAt factory instead
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

export type DateCellDayTimingInfoFactoryConfig = Pick<DateCellsExpansionFactoryConfig, 'timing' | 'rangeLimit'>;

export interface DateCellDayTimingInfo {
  /**
   * Input date or calculated date if provided a dayIndex.
   */
  date: Date;
  /**
   * Index for the day for the input date.
   */
  dayIndex: DateCellIndex;
  /**
   * Index for the previous index/current index depending on the TimingInfo's daily execution.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex.
   */
  currentIndex: DateCellIndex;
  /**
   * Index for the next execution. Does not check if it is in range.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex + 1.
   */
  nextIndex: DateCellIndex;
  /**
   * Index for the next execution, if in the range, otherwise undefined.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex + 1.
   */
  nextIndexInRange: Maybe<DateCellIndex>;
  /**
   * Whether or not there are any inProgress or upcoming executions.
   *
   * True if nextIndexInRange is undefined and isInProgress is false.
   */
  isComplete: boolean;
  /**
   * Whether or not today's timing has already occured in it's entirety.
   */
  hasOccuredToday: boolean;
  /**
   * Whether or not today's timing is currently in progress.
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
  /**
   * Time the timing ends on the input day.
   */
  endsAtOnDay: Date;
  /**
   * "now" value used for considering current progress.
   */
  now: Date;
}

/**
 * Generates DateCellDayTimingInfo about the input date relative to the input timing and range limit.
 *
 * The date may not exist within the range, but will still compute values using the input date and timing configuration.
 *
 * Can optionally specify a now that is used for checking the inProgress functionality.
 */
export type DateCellDayTimingInfoFactory = (date: DateOrDateCellIndex, now?: Date) => DateCellDayTimingInfo;

export function dateCellDayTimingInfoFactory(config: DateCellDayTimingInfoFactoryConfig): DateCellDayTimingInfoFactory {
  const { timing, rangeLimit } = config;
  const { duration } = timing;
  const indexRange = rangeLimit !== false ? dateCellIndexRange(timing, rangeLimit) : { minIndex: Number.MIN_SAFE_INTEGER, maxIndex: Number.MAX_SAFE_INTEGER };
  const checkIsInRange = indexRangeCheckFunction({ indexRange, inclusiveMaxIndex: false });
  const dayIndexFactory = dateCellTimingRelativeIndexFactory(timing);
  const dayFactory = dateCellTimingDateFactory(timing);
  const startsAtFactory = dateCellTimingStartsAtDateFactory(dayIndexFactory);

  return (input: DateOrDateCellIndex, inputNow?: Date) => {
    const date = typeof input === 'number' ? dayFactory(input) : input;

    const dayIndex = dayIndexFactory(input);
    const isInRange = checkIsInRange(dayIndex);

    const now = inputNow ?? date;
    const startsAtOnDay = startsAtFactory(dayIndex); // convert back to the proper date
    const endsAtOnDay = addMinutes(startsAtOnDay, duration);
    const potentiallyInProgress = !isAfter(startsAtOnDay, now); // is potentially in progress if the now is equal-to or after the start time.

    const isInProgress = potentiallyInProgress && !isAfter(now, endsAtOnDay);
    const hasOccuredToday = potentiallyInProgress && !isInProgress;

    const currentIndex: DateCellIndex = isInProgress || hasOccuredToday ? dayIndex : dayIndex - 1; // If not in progress and hasn't occured today, current index is the previous index.
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
      isInRange,
      startsAtOnDay,
      endsAtOnDay,
      nextIndexInRange,
      isComplete
    };
  };
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
        diff = differenceInHours(startOfDayInUtc, startInUtc, { roundingMethod: 'floor' }); // compare the system times. Round down.
      } else {
        const dateInUtc = normalInstance.systemDateToBaseDate(input as Date); // convert to UTC normal
        diff = differenceInHours(dateInUtc, startInUtc, { roundingMethod: 'floor' }); // compare the difference in system times. Round down.
      }

      const daysOffset = Math.floor(diff / HOURS_IN_DAY); // total number of hours difference from the original UTC date
      return daysOffset ? daysOffset : 0; // do not return -0
    }) as Configurable<Partial<DateCellTimingRelativeIndexFactory<T>>>;
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

      mergeArrayIntoArray(result, resultIndexes);
    });

    return result;
  }) as Configurable<Partial<DateCellTimingRelativeIndexArrayFactory<T>>>;
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
export type DateCellTimingDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt> = ((input: DateOrDateCellIndex) => Date) & {
  readonly _timing: T;
};

/**
 * Creates a DateCellTimingDateFactory.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt>(timing: T): DateCellTimingDateFactory<T> {
  const offsetData = getDateCellTimingStartOffsetData(timing);
  const utcStartDate = offsetData.originalUtcDate;

  const factory = ((input: DateOrDateCellIndex) => {
    if (isDate(input)) {
      return input;
    } else {
      const now = new Date();
      const nowHours = now.getUTCHours();
      const utcStartDateWithNowTime = new Date(Date.UTC(utcStartDate.getUTCFullYear(), utcStartDate.getUTCMonth(), utcStartDate.getUTCDate(), nowHours, now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds()));

      // if the current hours are less than the UTC offset hours, then bump one extra day forward to be sure we're in the correct day.
      if (timing.start.getUTCHours() > nowHours) {
        input += 1;
      }

      const nowWithDateForIndex = addHours(utcStartDateWithNowTime, input * HOURS_IN_DAY);
      return nowWithDateForIndex;
    }
  }) as Configurable<Partial<DateCellTimingDateFactory>>;
  factory._timing = timing;
  return factory as DateCellTimingDateFactory<T>;
}

/**
 * Returns the start time of the input date or index.
 */
export type DateCellTimingStartDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt> = ((input: DateOrDateCellIndex) => Date) & {
  readonly _indexFactory: DateCellTimingRelativeIndexFactory<T>;
};

export type DateCellTimingUseSystemAndIgnoreEnforcement = DateTimezoneConversionConfigUseSystemTimezone & {
  /**
   * Skips the assertion that the timezone matches. This defaults to true if not provided.
   */
  assertTimingMatchesTimezone: false;
};

/**
 * Creates a DateCellTimingDateFactory. The timezone is required to properly compute the accurate startsAt date for locations that experience daylight savings.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingStartDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt>(input: T | DateCellTimingRelativeIndexFactory<T>): DateCellTimingStartDateFactory<T> {
  const indexFactory = dateCellTimingRelativeIndexFactory<T>(input);
  const normalInstance = timingDateTimezoneUtcNormal(timezone);

  if ((normalInstance.config as DateCellTimingUseSystemAndIgnoreEnforcement).assertTimingMatchesTimezone !== false && !timingIsInExpectedTimezone(indexFactory._timing, normalInstance)) {
    throw new Error(`unexpected timezone "${timezone}" for start date "${indexFactory._timing.start}" for dateCellTimingStartDateFactory(). Is expected to match the timezones.`);
  }

  const { start: baseTimingStart } = indexFactory._timing;
  const baseStart = normalInstance.baseDateToTargetDate(baseTimingStart);

  const factory = ((input: DateOrDateCellIndex) => {
    const index = indexFactory(input); // get the index
    const startInUtc = addHours(baseStart, index * HOURS_IN_DAY);
    return normalInstance.targetDateToBaseDate(startInUtc);
  }) as Configurable<Partial<DateCellTimingStartDateFactory>>;
  factory._indexFactory = indexFactory;
  return factory as DateCellTimingStartDateFactory<T>;
}

/**
 * Returns the startsAt time of the input date or index.
 */
export type DateCellTimingStartsAtDateFactory<T extends DateCellTimingStartsAt = DateCellTimingStartsAt> = ((input: DateOrDateCellIndex) => Date) & {
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
  const { start, startsAt: baseTimingStartsAt } = indexFactory._timing;
  const normalInstance = timingDateTimezoneUtcNormal(timezone ?? { start });

  if ((normalInstance.config as DateCellTimingUseSystemAndIgnoreEnforcement).assertTimingMatchesTimezone !== false && !timingIsInExpectedTimezone(indexFactory._timing, normalInstance)) {
    throw new Error(`unexpected timezone "${timezone}" for start date "${indexFactory._timing.start}" for dateCellTimingStartsAtDateFactory(). Is expected to match the timezones.`);
  }

  const baseStartsAtInUtc = normalInstance.baseDateToTargetDate(baseTimingStartsAt);

  const factory = ((input: DateOrDateCellIndex) => {
    const index = indexFactory(input); // get the index
    const startAtInUtc = addHours(baseStartsAtInUtc, index * HOURS_IN_DAY);
    return normalInstance.targetDateToBaseDate(startAtInUtc);
  }) as Configurable<Partial<DateCellTimingStartsAtDateFactory>>;
  factory._indexFactory = indexFactory;
  return factory as DateCellTimingStartsAtDateFactory<T>;
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

/**
 * Converts a DateCellTimingStartsAtEndRange and DateCellTimingEvent that originated from the same DateCellTiming back to the original DateCellTiming.
 *
 * This does not check for validity of the input event, and as such can return an invalid timing. Instead, use safeDateCellTimingFromDateRangeAndEvent() for enforced validity and return of a valid timing.
 *
 * The timezone is recommended to be provided if available, otherwise daylight savings might be impacted.
 *
 * @param dateCellTimingStartEndRange
 * @param event
 * @param timezone
 * @returns
 */
export function dateCellTimingFromDateRangeAndEvent(dateCellTimingStartEndRange: DateCellTimingStartsAtEndRange, event: DateCellTimingEvent): DateCellTiming;
export function dateCellTimingFromDateRangeAndEvent(dateCellTimingStartEndRange: DateCellTimingStartsAtEndRange, event: DateCellTimingEvent): DateCellTiming {
  const { startsAt: originalStartsAt, end, timezone } = dateCellTimingStartEndRange;
  const { startsAt: eventStartsAt, duration } = event;

  // need the timezone instance to compute against the normal and convert to the system time, before going back.
  // this is necessary because the start is a timezone normal for UTC, and the minutes need to be converted back properly adjusting for timezones.
  const normalInstance = dateTimezoneUtcNormal(dateCellTimingStartEndRange);

  // compute startsAt, the start time for the first event
  const startsAt = copyHoursAndMinutesFromDateWithTimezoneNormal(originalStartsAt, eventStartsAt, normalInstance);
  const timing = {
    timezone,
    end,
    startsAt,
    duration
  };

  return timing;
}

/**
 * Converts a DateCellTimingStartsAtEndRange and a DateCellTimingEvent to a DateCellTiming.
 *
 * The input event does not have to be from the original DateCellTimingStartsAtEndRange, but the start date is always retained, and the same end day is retained, but may be updated to reflect a new end date/time.
 *
 * @param dateCellTimingStartEndRange
 * @param event
 * @param timezone
 * @returns
 */
export function safeDateCellTimingFromDateRangeAndEvent(dateCellTimingStartEndRange: DateCellTimingStartsAtEndRange, event: DateCellTimingEvent): DateCellTiming;
export function safeDateCellTimingFromDateRangeAndEvent(dateCellTimingStartEndRange: DateCellTimingStartsAtEndRange, event: DateCellTimingEvent): DateCellTiming {
  const { startsAt, end } = dateCellTimingStartEndRange;

  const endDay = end; // get midnight of the day the job usually ends at

  const endDayDateRange: DateCellTimingStartEndDayDateRange = { start, endDay };
  return _dateCellTimingFromDateCellTimingStartEndDayDateRange(endDayDateRange, event);
}

/**
 * Converts a DateCellTimingStartEndDayDateRange and DateCellTimingEvent to a DateCellTiming. The event is used to derive the startsAt, duration and end time. The timezone offset is retained.
 *
 * @param dateCellTimingStartEndDayDateRange
 * @param event
 * @returns
 */
export function dateCellTimingFromDateCellTimingStartEndDayDateRange(dateCellTimingStartEndRange: DateCellTimingStartsAtEndRange, event: DateCellTimingEvent): DateCellTiming {
  // need the timezone instance to compute against the normal and convert to the system time, before going back.
  // this is necessary because the start is a timezone normal for UTC, and the minutes need to be converted back properly adjusting for timezones.
  const normalInstance = assertedTimingDateTimezoneUtcNormal(timezone ?? dateCellTimingStartEndDayDateRange, dateCellTimingStartEndDayDateRange);
  return _dateCellTimingFromDateCellTimingStartEndDayDateRange(dateCellTimingStartEndDayDateRange, event, normalInstance);
}

/**
 * Internal function that allows safeDateCellTimingFromDateRangeAndEvent() and dateCellTimingFromDateCellTimingStartEndDayDateRange()
 * to pass their timezone instances to this function, without having to create a new instance.
 *
 * See dateCellTimingFromDateCellTimingStartEndDayDateRange() for details.
 *
 * @param dateCellTimingStartEndDayDateRange
 * @param event
 * @param normalInstance
 * @returns
 */
function _dateCellTimingFromDateCellTimingStartEndDayDateRange(dateCellTimingStartEndRange: DateCellTimingStartsAtEndRange, event: DateCellTimingEvent, normalInstance: DateTimezoneUtcNormalInstance): DateCellTiming {
  const { start, endDay } = dateCellTimingStartEndRange;
  const { startsAt: eventStartsAt, duration } = event;

  // compute startsAt, the start time for the first event
  const startsAt = copyHoursAndMinutesFromDateWithTimezoneNormal(start, eventStartsAt, normalInstance);

  // compute end, the end time for the last event using the last day
  const lastDayStartsAt = dateCellTimingStartsAtDateFactory({ start, startsAt }, normalInstance)(endDay);

  const end = addMinutes(lastDayStartsAt, duration);

  const timing = {
    start,
    end,
    startsAt,
    duration
    // timezone
  };

  // console.log({ normalInstance, startsAt, eventStartsAt, lastDayStartsAt, dateCellTimingStartEndDayDateRange, event, timing });

  return timing;
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

  let minIndex: IndexNumber = 0;
  let maxIndex: IndexNumber = indexFactory(timing.end);

  if (limit) {
    const { start, end } = dateCellTiming(timing, limit);
    const limitMin = indexFactory(start);
    const limitMax = indexFactory(end);

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
