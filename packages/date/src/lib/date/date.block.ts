import {
  DayOfWeek,
  RequiredOnKeys,
  IndexNumber,
  IndexRange,
  indexRangeCheckFunction,
  IndexRef,
  MINUTES_IN_DAY,
  MS_IN_DAY,
  UniqueModel,
  lastValue,
  FactoryWithRequiredInput,
  FilterFunction,
  mergeFilterFunctions,
  range,
  Milliseconds,
  Hours,
  MapFunction,
  getNextDay,
  SortCompareFunction,
  sortAscendingIndexNumberRefFunction,
  mergeArrayIntoArray,
  Configurable,
  ArrayOrValue,
  asArray,
  sumOfIntegersBetween,
  filterMaybeValues,
  Maybe,
  TimezoneString,
  Building,
  addToSet,
  ISO8601DayString,
  Minutes,
  MS_IN_HOUR,
  minutesToFractionalHours,
  FractionalHour,
  HOURS_IN_DAY,
  DateRelativeState,
  groupValues,
  makeValuesGroupMap
} from '@dereekb/util';
import { dateRange, DateRange, DateRangeDayDistanceInput, DateRangeStart, DateRangeType, fitDateRangeToDayPeriod, isDateRange, isDateRangeStart } from './date.range';
import { DateDurationSpan } from './date.duration';
import { differenceInDays, differenceInMilliseconds, isBefore, addDays, addMinutes, getSeconds, getMilliseconds, getMinutes, addMilliseconds, hoursToMilliseconds, addHours, differenceInHours, isAfter, minutesToHours, differenceInMinutes, startOfDay, milliseconds } from 'date-fns';
import { isDate, copyHoursAndMinutesFromDate, roundDownToMinute, copyHoursAndMinutesFromNow } from './date';
import { Expose, Type } from 'class-transformer';
import { DateTimezoneUtcNormalFunctionInput, DateTimezoneUtcNormalInstance, dateTimezoneUtcNormal, getCurrentSystemOffsetInHours, startOfDayInTimezoneDayStringFactory, copyHoursAndMinutesFromDateWithTimezoneNormal, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE, copyHoursAndMinutesFromNowWithTimezoneNormal, DateTimezoneConversionConfigUseSystemTimezone } from './date.timezone';
import { IsDate, IsNumber, IsOptional, Min } from 'class-validator';
import { parseISO8601DayStringToDate, parseISO8601DayStringToUTCDate } from './date.format';

/**
 * Index from 0 of which day this block represents.
 */
export type DateBlockIndex = number;

/**
 * Returns true if the index is a non-negative integer.
 *
 * @param input
 */
export function isValidDateBlockIndex(input: DateBlockIndex): boolean {
  return input >= 0 && Number.isInteger(input);
}

/**
 * Input type that is either a Date or a DateBlockIndex.
 */
export type DateOrDateBlockIndex = Date | DateBlockIndex;

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
 * Converts the input number or DateBlock to a DateBlock.
 *
 * @param dateBlockOrIndex
 * @returns
 */
export function dateBlock(dateBlockOrIndex: DateBlockIndex | DateBlock): DateBlock {
  return typeof dateBlockOrIndex === 'number' ? { i: dateBlockOrIndex } : dateBlockOrIndex;
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
 * DateBlockTiming with only the start time.
 *
 * The start time is midnight of what timezone it is in, and can be used to infer the target timezone offset for that date.
 */
export type DateBlockTimingStart = DateRangeStart;

/**
 * The DateBlockTimingStart and startsAt times
 */
export type DateBlockTimingStartAndStartsAt = DateBlockTimingStart & Pick<DateBlockTiming, 'startsAt'>;

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
export interface DateBlockTiming extends DateBlockTimingStart, DateRange, DateDurationSpan {}

/**
 * The DateRange component for a DateBlockTiming. The start date is a DateBlockTimingStart.
 */
export type DateBlockTimingStartEndRange = DateBlockTimingStart & Pick<DateBlockTiming, 'end'>;

/**
 * The start date of a DateBlockTimingStart, along with the endDay which is a normalized day that is at midnight of the last day in the timezone.
 *
 * They are expected to both be in the same timezone.
 */
export type DateBlockTimingStartEndDayDateRange = DateBlockTimingStart & { endDay: Date };

/**
 * A startsAt time and duration.
 */
export type DateBlockTimingEvent = Pick<DateBlockTiming, 'startsAt' | 'duration'>;

export class DateBlockTiming extends DateDurationSpan {
  @Expose()
  @IsDate()
  @Type(() => Date)
  start!: Date;

  @Expose()
  @IsDate()
  @Type(() => Date)
  end!: Date;

  constructor(template?: DateBlockTiming) {
    super(template);

    if (template) {
      this.start = template.start;
      this.end = template.end;
    }
  }
}

export interface CurrentDateBlockTimingUtcData {
  /**
   * Non-normalized start date in the system time.
   */
  originalUtcDate: Date;
  /**
   * Offset of the input timing to UTC.
   */
  originalUtcOffsetInHours: Hours;
}

export interface CurrentDateBlockTimingOffsetData extends CurrentDateBlockTimingUtcData {
  offset: Milliseconds;
  currentTimezoneOffsetInHours: Hours;
}

/**
 * Returns the date range from the start of the first event to the end time of the last event.
 *
 * @param timing
 * @returns
 */
export function dateBlockTimingFullRange(timing: Pick<DateBlockTiming, 'start' | 'end'>): DateRange {
  return { start: timing.start, end: timing.end };
}

/**
 * Returns the date range from the start of the first event to the end time of the last event.
 *
 * @param timing
 * @returns
 */
export function dateBlockTimingEventRange(timing: Pick<DateBlockTiming, 'startsAt' | 'end'>): DateRange {
  return { start: timing.startsAt, end: timing.end };
}

export function getCurrentDateBlockTimingUtcData(timing: DateRangeStart): CurrentDateBlockTimingUtcData {
  const start = timing.start;
  const dateHours = start.getUTCHours();
  const MAX_OFFSET_HOURS = 12;

  // if it is a positive offset, then the date is in the future so we subtract the offset from 24 hours to get the proper offset.
  const originalUtcOffsetInHours = dateHours > MAX_OFFSET_HOURS ? HOURS_IN_DAY - dateHours : -dateHours;
  const originalUtcDate = addHours(start, originalUtcOffsetInHours); // convert to original UTC

  return {
    originalUtcDate,
    originalUtcOffsetInHours
  };
}

/**
 * The offset in milliseconds to the "real start date", the first second in the target day on in the system timezone.
 *
 * @param timing
 */
export function getCurrentDateBlockTimingOffsetData(timing: DateRangeStart): CurrentDateBlockTimingOffsetData {
  const { originalUtcOffsetInHours, originalUtcDate } = getCurrentDateBlockTimingUtcData(timing);
  const currentTimezoneOffsetInHours = getCurrentSystemOffsetInHours(originalUtcDate); // get the offset as it is on that day

  // calculate the true offset
  let offset: Hours = originalUtcOffsetInHours - currentTimezoneOffsetInHours;

  if (offset === -HOURS_IN_DAY) {
    offset = 0; // auckland can return -24 for itself
  }

  return {
    originalUtcDate,
    originalUtcOffsetInHours,
    offset: hoursToMilliseconds(offset),
    currentTimezoneOffsetInHours
  };
}

export function getCurrentDateBlockTimingOffset(timing: DateRangeStart): Milliseconds {
  return getCurrentDateBlockTimingOffsetData(timing).offset;
}

export type TimingIsExpectedTimezoneFunction = (timing: DateRangeStart) => boolean;

export function timingIsInExpectedTimezoneFunction(timezone: DateTimezoneUtcNormalFunctionInput) {
  const normal = dateTimezoneUtcNormal(timezone);

  return (timing: DateRangeStart) => {
    const { start } = timing;
    const offset = normal.systemDateToTargetDateOffset(start);
    const expectedTimingOffset = getCurrentDateBlockTimingOffset(timing);
    return offset === expectedTimingOffset;
  };
}

export function timingIsInExpectedTimezone(timing: DateRangeStart, timezone: DateTimezoneUtcNormalFunctionInput) {
  return timingIsInExpectedTimezoneFunction(timezone)(timing);
}

/**
 * Returns the total minutes between the start of the first event and the end of the last event.
 *
 * @param timing
 * @returns
 */
export function getDateBlockTimingFirstEventDateRange(timing: Pick<DateBlockTiming, 'startsAt' | 'end'>): DateRange {
  return fitDateRangeToDayPeriod({ start: timing.startsAt, end: timing.end });
}

/**
 * Returns the fractional hours in the event.
 *
 * @param timing
 * @returns
 */
export function getDateBlockTimingHoursInEvent(timing: Pick<DateBlockTiming, 'startsAt' | 'end'>): FractionalHour {
  const dateRange = getDateBlockTimingFirstEventDateRange(timing);
  return minutesToFractionalHours(differenceInMinutes(dateRange.end, dateRange.start));
}

export type TimingDateTimezoneUtcNormalInput = DateRangeStart | DateTimezoneUtcNormalFunctionInput;

/**
 * Creates a DateTimezoneUtcNormalInstance from the input.
 *
 * @param input
 * @returns
 */
export function timingDateTimezoneUtcNormal(input: TimingDateTimezoneUtcNormalInput): DateTimezoneUtcNormalInstance {
  const timezoneNormalInput: DateTimezoneUtcNormalFunctionInput = isDateRangeStart(input) ? hoursToMilliseconds(getCurrentDateBlockTimingUtcData(input).originalUtcOffsetInHours) : input;
  const timezoneInstance = dateTimezoneUtcNormal(timezoneNormalInput);
  return timezoneInstance;
}

/**
 * Converts a DateBlockTimingStartEndRange and DateBlockTimingEvent that originated from the same DateBlockTiming back to the original DateBlockTiming.
 *
 * NOTE: If the event's timing did not originate from the
 *
 * @param dateBlockTimingStartEndRange
 * @param event
 * @returns
 */
export function dateBlockTimingFromDateRangeAndEvent(dateBlockTimingStartEndRange: DateBlockTimingStartEndRange, event: DateBlockTimingEvent): DateBlockTiming {
  const { start, end } = dateBlockTimingStartEndRange;
  const { startsAt: eventStartsAt, duration } = event;

  // need the timezone instance to compute against the normal and convert to the system time, before going back.
  // this is necessary because the start is a timezone normal for UTC, and the minutes need to be converted back properly adjusting for timezones.
  const timezoneInstance = timingDateTimezoneUtcNormal(dateBlockTimingStartEndRange);

  // compute startsAt, the start time for the first event
  const startsAt = copyHoursAndMinutesFromDateWithTimezoneNormal(start, eventStartsAt, timezoneInstance);
  const timing = {
    start,
    end,
    startsAt,
    duration
  };

  return timing;
}

/**
 * Converts a DateBlockTimingStartEndRange and a DateBlockTimingEvent to a DateBlockTiming.
 *
 * The input event does not have to be from the original DateBlockTimingStartEndRange. The DateBlockTiming's end value will be updated to fit the DateBlockTimingEvent info.
 *
 * @param dateBlockTimingStartEndRange
 * @param event
 * @returns
 */
export function safeDateBlockTimingFromDateRangeAndEvent(dateBlockTimingStartEndRange: DateBlockTimingStartEndRange, event: DateBlockTimingEvent): DateBlockTiming {
  const { start, end } = dateBlockTimingStartEndRange;

  const timezoneInstance = timingDateTimezoneUtcNormal(dateBlockTimingStartEndRange);
  const systemTimezoneEnd = timezoneInstance.systemDateToTargetDate(end); // normalize it so it is back in it's original timezone hours/minutes
  const endNormal = startOfDay(systemTimezoneEnd); // get the start of the day
  const endDay = timezoneInstance.targetDateToSystemDate(endNormal); // get the end of the day

  const endDayDateRange: DateBlockTimingStartEndDayDateRange = { start, endDay };
  return _dateBlockTimingFromDateBlockTimingStartEndDayDateRange(endDayDateRange, event, timezoneInstance);
}

/**
 * Converts a DateBlockTimingStartEndDayDateRange and DateBlockTimingEvent to a DateBlockTiming. The event is used to derive the startsAt, duration and end time. The timezone offset is retained.
 *
 * @param dateBlockTimingStartEndDayDateRange
 * @param event
 * @returns
 */
export function dateBlockTimingFromDateBlockTimingStartEndDayDateRange(dateBlockTimingStartEndDayDateRange: DateBlockTimingStartEndDayDateRange, event: DateBlockTimingEvent): DateBlockTiming {
  // need the timezone instance to compute against the normal and convert to the system time, before going back.
  // this is necessary because the start is a timezone normal for UTC, and the minutes need to be converted back properly adjusting for timezones.
  const timezoneInstance = timingDateTimezoneUtcNormal(dateBlockTimingStartEndDayDateRange);
  return _dateBlockTimingFromDateBlockTimingStartEndDayDateRange(dateBlockTimingStartEndDayDateRange, event, timezoneInstance);
}

/**
 * Internal function that allows safeDateBlockTimingFromDateRangeAndEvent() and dateBlockTimingFromDateBlockTimingStartEndDayDateRange()
 * to pass their timezone instances to this function, without having to create a new instance.
 *
 * See dateBlockTimingFromDateBlockTimingStartEndDayDateRange() for details.
 *
 * @param dateBlockTimingStartEndDayDateRange
 * @param event
 * @param timezoneInstance
 * @returns
 */
function _dateBlockTimingFromDateBlockTimingStartEndDayDateRange(dateBlockTimingStartEndDayDateRange: DateBlockTimingStartEndDayDateRange, event: DateBlockTimingEvent, timezoneInstance: DateTimezoneUtcNormalInstance): DateBlockTiming {
  const { start, endDay } = dateBlockTimingStartEndDayDateRange;
  const { startsAt: eventStartsAt, duration } = event;

  // compute startsAt, the start time for the first event
  const startsAt = copyHoursAndMinutesFromDateWithTimezoneNormal(start, eventStartsAt, timezoneInstance);

  // compute end, the end time for the last event using the last day
  const end = addMinutes(copyHoursAndMinutesFromDateWithTimezoneNormal(endDay, eventStartsAt, timezoneInstance), duration);

  const timing = {
    start,
    end,
    startsAt,
    duration
  };

  return timing;
}

/**
 * Returns a copy of the input timing with the start time timezone in the given timezone.
 *
 * The start time is a normal, and should still refer to the same UTC date, but with the given timing's offset.
 *
 * @param timing
 */
export type ChangeTimingToTimezoneFunction = (<T extends DateRangeStart>(timing: T) => T) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
};

/**
 * Creates a ChangeTimingToTimezoneFunction from the input.
 *
 * @param input
 * @returns
 */
export function changeTimingToTimezoneFunction(input: TimingDateTimezoneUtcNormalInput): ChangeTimingToTimezoneFunction {
  const timezoneInstance = timingDateTimezoneUtcNormal(input);

  const fn = (<T extends DateRangeStart>(timing: T) => {
    const baseTimingOffset = getCurrentDateBlockTimingUtcData(timing);

    const startInUtc = baseTimingOffset.originalUtcDate;
    const start = timezoneInstance.targetDateToBaseDate(startInUtc);

    const newTiming = {
      ...timing,
      start
    };

    return newTiming;
  }) as Building<ChangeTimingToTimezoneFunction>;
  fn._timezoneInstance = timezoneInstance;
  return fn as ChangeTimingToTimezoneFunction;
}

export function changeTimingToTimezone<T extends DateRangeStart>(timing: T, timezone: TimingDateTimezoneUtcNormalInput): T {
  return changeTimingToTimezoneFunction(timezone)(timing);
}

export function changeTimingToSystemTimezone<T extends DateRangeStart>(timing: T): T {
  return changeTimingToTimezoneFunction(SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE)(timing);
}

export function dateBlockTimingStartForNowInSystemTimezone(): DateBlockTimingStart {
  return {
    start: startOfDay(new Date())
  };
}

/**
 * Creates a DateBlockTimingStart for now in the given timezone.
 *
 * @param timezoneInput
 * @returns
 */
export function dateBlockTimingStartForNowInTimezone(timezoneInput: TimingDateTimezoneUtcNormalInput): DateBlockTimingStart {
  const dateBlockTimingStartSystemTimezone = dateBlockTimingStartForNowInSystemTimezone();
  return changeTimingToTimezone(dateBlockTimingStartSystemTimezone, timezoneInput);
}

/**
 * Returns the start date in the current/system timezone for the given date.
 *
 * @param timing
 */
export function getCurrentDateBlockTimingStartDate(timing: DateBlockTimingStart): Date {
  const offset = getCurrentDateBlockTimingOffset(timing);
  return addMilliseconds(timing.start, offset);
}

export function isValidDateBlockTimingStartDate(date: Date): boolean {
  return getMinutes(date) === 0 && getSeconds(date) === 0 && getMilliseconds(date) === 0;
}

/**
 * DateTimingRelativeIndexFactory input. Can be a Date, DateBlockIndex, or ISO8601DayString
 */
export type DateTimingRelativeIndexFactoryInput = DateOrDateBlockIndex | ISO8601DayString;

/**
 * Returns the DateBlockIndex of the input date relative to the configured Date.
 *
 * Input dates should be in system time zone and not normalized to a different timezone.
 */
export type DateTimingRelativeIndexFactory<T extends DateBlockTimingStart = DateBlockTimingStart> = ((input: DateTimingRelativeIndexFactoryInput) => DateBlockIndex) & {
  readonly _timing: T;
  readonly _timingOffsetData: CurrentDateBlockTimingOffsetData;
};

/**
 * Returns true if the input is a DateTimingRelativeIndexFactory.
 *
 * @param input
 * @returns
 */
export function isDateTimingRelativeIndexFactory<T extends DateBlockTimingStart = DateBlockTimingStart>(input: unknown): input is DateTimingRelativeIndexFactory<T> {
  return typeof input === 'function' && (input as DateTimingRelativeIndexFactory)._timing != null && (input as DateTimingRelativeIndexFactory)._timingOffsetData != null;
}

/**
 * Creates a DateTimingRelativeIndexFactory from the input.
 *
 * @param input
 * @returns
 */
export function dateTimingRelativeIndexFactory<T extends DateBlockTimingStart = DateBlockTimingStart>(input: T | DateTimingRelativeIndexFactory<T>): DateTimingRelativeIndexFactory<T> {
  if (isDateTimingRelativeIndexFactory(input)) {
    return input;
  } else {
    const timing = input;
    const offsetData = getCurrentDateBlockTimingOffsetData(timing);
    const { originalUtcOffsetInHours: toUtcOffset, currentTimezoneOffsetInHours, originalUtcDate: originalUtcDateInSystemTimeNormal } = offsetData;
    const baseOffsetInHours = currentTimezoneOffsetInHours;

    const factory = ((input: DateOrDateBlockIndex | ISO8601DayString) => {
      const inputType = typeof input;

      if (inputType === 'number') {
        return input;
      } else if (inputType === 'string') {
        const startOfDayInUtc = parseISO8601DayStringToUTCDate(input as string); // convert to system timezone
        const diff = differenceInHours(startOfDayInUtc, originalUtcDateInSystemTimeNormal, { roundingMethod: 'floor' }); // compare the system times. Round down.
        const daysOffset = Math.floor(diff / HOURS_IN_DAY); // total number of hours difference from the original UTC date

        return daysOffset ? daysOffset : 0; // do not return -0
      } else {
        const inputDateTimezoneOffset = (input as Date).getTimezoneOffset(); // get current system timezone offset
        const offsetDifferenceHours = baseOffsetInHours + minutesToHours(inputDateTimezoneOffset); // handle timezone offset changes

        const baseDiff = differenceInHours(input as Date, originalUtcDateInSystemTimeNormal, { roundingMethod: 'floor' }); // compare the difference in system times. Round down.
        const diff = baseDiff + toUtcOffset - offsetDifferenceHours; // apply any timezone changes, then back to UTC for comparison
        const daysOffset = Math.floor(diff / HOURS_IN_DAY); // total number of hours difference from the original UTC date

        return daysOffset ? daysOffset : 0; // do not return -0
      }
    }) as Configurable<Partial<DateTimingRelativeIndexFactory<T>>>;
    factory._timing = timing;
    factory._timingOffsetData = offsetData;
    return factory as DateTimingRelativeIndexFactory<T>;
  }
}

/**
 * Function that wraps a DateTimingRelativeIndexFactory and converts multuple Date/DateBlockIndex/DateBlockRange values into an array of DateBlockIndex values.
 */
export type DateTimingRelativeIndexArrayFactory<T extends DateBlockTimingStart = DateBlockTimingStart> = ((input: ArrayOrValue<DateOrDateRangeOrDateBlockIndexOrDateBlockRange>) => DateBlockIndex[]) & {
  readonly _indexFactory: DateTimingRelativeIndexFactory<T>;
};

/**
 * Creates a DateTimingRelativeIndexArrayFactory from the input DateTimingRelativeIndexFactory.
 *
 * @param indexFactory
 */
export function dateTimingRelativeIndexArrayFactory<T extends DateBlockTimingStart = DateBlockTimingStart>(indexFactory: DateTimingRelativeIndexFactory<T>): DateTimingRelativeIndexArrayFactory<T> {
  const factory = ((input: ArrayOrValue<DateOrDateRangeOrDateBlockIndexOrDateBlockRange>) => {
    const inputAsArray = asArray(input);
    const result: DateBlockIndex[] = [];

    inputAsArray.forEach((value: DateOrDateRangeOrDateBlockIndexOrDateBlockRange) => {
      let resultIndexes: DateBlockIndex[];

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
  }) as Configurable<Partial<DateTimingRelativeIndexArrayFactory<T>>>;
  factory._indexFactory = indexFactory;
  return factory as DateTimingRelativeIndexArrayFactory<T>;
}

/**
 * Gets the relative index of the input date compared to the input timing.
 *
 * @param timing
 * @param date
 */
export function getRelativeIndexForDateTiming(timing: DateBlockTimingStart, date: DateOrDateBlockIndex = new Date()): DateBlockIndex {
  return dateTimingRelativeIndexFactory(timing)(date);
}

export interface GetNextDateBlockTimingIndexInput<T extends DateBlockRange> {
  /**
   * Relevant index for now.
   */
  readonly currentIndex: DateBlockIndex;
  /**
   * All possible ranges to pick from.
   */
  readonly ranges: ArrayOrValue<T>;
}

export interface GetNextDateBlockTimingIndexResult<T extends DateBlockRange> {
  /**
   * The item that matches the current index first out of the options.
   */
  readonly currentResult: Maybe<T>;
  /**
   * The next picked index, if available.
   */
  readonly nextIndex: Maybe<DateBlockIndex>;
  /**
   * The item that matches the next index first out of the options.
   */
  readonly nextResult: Maybe<T>;
  /**
   * All ranges that match/contain the current index.
   */
  readonly presentResults: T[];
  /**
   * All ranges that come before the current index.
   */
  readonly pastResults: T[];
  /**
   * All ranges that come after the current index.
   */
  readonly futureResults: T[];
}

/**
 * Computes a GetNextDateBlockTimingIndexResult from the input.
 *
 * @param input
 */
export function getNextDateBlockTimingIndex<T extends DateBlockRange>(input: GetNextDateBlockTimingIndexInput<T>): GetNextDateBlockTimingIndexResult<T> {
  const { ranges, currentIndex } = input;

  const relativeStateGroups = makeValuesGroupMap(asArray(ranges), (range) => {
    return dateRelativeStateForDateBlockRangeComparedToIndex(range, currentIndex);
  });

  const pastResults = relativeStateGroups.get('past') ?? [];
  const presentResults = relativeStateGroups.get('present') ?? [];
  const futureResults = relativeStateGroups.get('future') ?? [];

  const currentResult = presentResults[0];

  let nextResult: Maybe<T>;
  let nextIndex: Maybe<number> = currentIndex + 1;

  const nextResultFromPresent = presentResults.find((x) => dateRelativeStateForDateBlockRangeComparedToIndex(x, nextIndex as number) === 'present');

  if (nextResultFromPresent) {
    nextResult = nextResultFromPresent;
  } else {
    // search through the future indexes, looking for the one with the lowest index.
    const greatestAndLeastIndexResult = getLeastAndGreatestDateBlockIndexInDateBlockRanges(futureResults);

    if (greatestAndLeastIndexResult) {
      nextIndex = greatestAndLeastIndexResult.leastIndex;
      nextResult = greatestAndLeastIndexResult.leastIndexItem;
    } else {
      nextIndex = undefined;
    }
  }

  return {
    currentResult,
    nextIndex,
    nextResult,
    pastResults,
    presentResults,
    futureResults
  };
}

/**
 * Returns the DateRelativeState for the given index and range.
 *
 * @param nowIndex
 * @param range
 */
export function dateRelativeStateForDateBlockRangeComparedToIndex(range: DateBlockRange, nowIndex: DateBlockIndex): DateRelativeState {
  const { i, to } = dateBlockRange(range.i, range.to);
  let state: DateRelativeState;

  if (i > nowIndex) {
    state = 'future'; // if i greater, then the range is in the future.
  } else if (to < nowIndex) {
    state = 'past'; // if i is less than or equal, and to is less than i, then it is in the past
  } else {
    state = 'present';
  }

  return state;
}

/**
 * Similar to the DateTimingRelativeIndexFactory, but returns a date instead of an index for the input.
 *
 * If an index is input, returns a date with the hours and minutes for now for the given date returned.
 */
export type DateBlockTimingDateFactory<T extends DateBlockTimingStart = DateBlockTimingStart> = ((input: DateOrDateBlockIndex) => Date) & {
  readonly _timing: T;
};

/**
 * Creates a DateBlockTimingDateFactory.
 *
 * @param timing
 * @returns
 */
export function dateBlockTimingDateFactory<T extends DateBlockTimingStart = DateBlockTimingStart>(timing: T): DateBlockTimingDateFactory<T> {
  const offsetData = getCurrentDateBlockTimingOffsetData(timing);
  const utcStartDate = offsetData.originalUtcDate;

  const factory = ((input: DateOrDateBlockIndex) => {
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
  }) as Configurable<Partial<DateBlockTimingDateFactory>>;
  factory._timing = timing;
  return factory as DateBlockTimingDateFactory<T>;
}

/**
 * Returns the start time of the input date or index.
 */
export type DateBlockTimingStartDateFactory<T extends DateBlockTimingStart = DateBlockTimingStart> = ((input: DateOrDateBlockIndex) => Date) & {
  readonly _indexFactory: DateTimingRelativeIndexFactory<T>;
};

export type DateBlockTimingUseSystemAndIgnoreEnforcement = DateTimezoneConversionConfigUseSystemTimezone & {
  /**
   * Skips the assertion that the timezone matches. This defaults to true if not provided.
   */
  assertTimingMatchesTimezone: false;
};

/**
 * Creates a DateBlockTimingDateFactory. The timezone is required to properly compute the accurate startsAt date for locations that experience daylight savings.
 *
 * @param timing
 * @returns
 */
export function dateBlockTimingStartDateFactory<T extends DateBlockTimingStart = DateBlockTimingStart>(input: T | DateTimingRelativeIndexFactory<T>, timezone: TimezoneString | DateTimezoneConversionConfigUseSystemTimezone | DateBlockTimingUseSystemAndIgnoreEnforcement): DateBlockTimingStartDateFactory<T> {
  const indexFactory = dateTimingRelativeIndexFactory<T>(input);
  const timezoneInstance = timingDateTimezoneUtcNormal(timezone);

  if ((timezoneInstance.config as DateBlockTimingUseSystemAndIgnoreEnforcement).assertTimingMatchesTimezone !== false && !timingIsInExpectedTimezone(indexFactory._timing, timezoneInstance)) {
    throw new Error(`unexpected timezone "${timezone}" for start date "${indexFactory._timing.start}" for dateBlockTimingStartDateFactory(). Is expected to match the timezones.`);
  }

  const { start: baseTimingStart } = indexFactory._timing;
  const baseStart = timezoneInstance.baseDateToTargetDate(baseTimingStart);

  const factory = ((input: DateOrDateBlockIndex) => {
    const index = indexFactory(input); // get the index
    const startInUtc = addHours(baseStart, index * HOURS_IN_DAY);
    return timezoneInstance.targetDateToBaseDate(startInUtc);
  }) as Configurable<Partial<DateBlockTimingStartDateFactory>>;
  factory._indexFactory = indexFactory;
  return factory as DateBlockTimingStartDateFactory<T>;
}

/**
 * Returns the startsAt time of the input date or index.
 */
export type DateBlockTimingStartsAtDateFactory<T extends DateBlockTimingStart = DateBlockTimingStart> = ((input: DateOrDateBlockIndex) => Date) & {
  readonly _indexFactory: DateTimingRelativeIndexFactory<T>;
};

/**
 * Creates a DateBlockTimingStartsAtDateFactory.
 *
 * @param timing
 * @returns
 */
export function dateBlockTimingStartsAtDateFactory<T extends DateBlockTimingStartAndStartsAt = DateBlockTimingStartAndStartsAt>(input: T | DateTimingRelativeIndexFactory<T>): DateBlockTimingStartsAtDateFactory<T> {
  const indexFactory = dateTimingRelativeIndexFactory<T>(input);
  const { startsAt: baseTimingStartsAt } = indexFactory._timing;

  const factory = ((input: DateOrDateBlockIndex) => {
    const index = indexFactory(input); // get the index
    const hoursOffset = index * HOURS_IN_DAY;
    return addHours(baseTimingStartsAt, hoursOffset);
  }) as Configurable<Partial<DateBlockTimingStartsAtDateFactory>>;
  factory._indexFactory = indexFactory;
  return factory as DateBlockTimingStartsAtDateFactory<T>;
}

/**
 * Returns the date of the input index.
 *
 * @param timing
 * @param date
 */
export function getRelativeDateForDateBlockTiming(timing: DateBlockTimingStart, input: DateOrDateBlockIndex): Date {
  return dateBlockTimingDateFactory(timing)(input);
}

/**
 * The DateRange input for dateBlockTiming()
 */
export type DateBlockTimingRangeInput = Pick<DateRangeDayDistanceInput, 'distance'> | DateRange | number;

export interface DateBlockTimingOptions {
  /**
   * Timezone to evaluate the startsAt time in.
   *
   * Will convert the input startsAt time to a normal in the given timezone, then converts it back to the system timezone.
   */
  timezone?: DateTimezoneUtcNormalFunctionInput;
}

/**
 * Creates a valid DateBlock timing from the DateDurationSpan and range input.
 *
 * The duration is first considered, then the date range is applied to it.
 *
 * If a number is passed as the input range, then the duration's startsAt date will be used and the input number used as the distance.
 * The input range's date takes priority over the duration's startsAt start date, meaning the input date range will be adapted
 * to fit the startsAt time.
 *
 * The input range date is used as the start and end date ranges, meaning they will be used as the expected date offset (have only hours, no minutes/seconds/milliseconds) and be validated as such.
 * The end date is used just to determine the number of days, but a minimum of 1 day is always enforced as a DateBlockTiming must contain atleast 1 day.
 *
 * The start date from the inputDate is considered to to have the offset noted in DateBlock, and will be retained.
 */
export function dateBlockTiming(durationInput: DateDurationSpan, inputRange: DateBlockTimingRangeInput, options?: DateBlockTimingOptions): DateBlockTiming {
  const { duration } = durationInput;
  const { timezone: timezoneInput } = options ?? {};
  const timezoneInstance = timezoneInput ? dateTimezoneUtcNormal(timezoneInput) : undefined;

  if (duration > MINUTES_IN_DAY) {
    throw new Error('dateBlockTiming() duration cannot be longer than 24 hours.');
  }

  let { startsAt: inputStartsAt } = durationInput;

  // it is important that startsAt is evaluated the system time normal, as addDays/addMinutes and related functionality rely on the system timezone.
  let startsAt = timezoneInstance ? timezoneInstance.systemDateToTargetDate(inputStartsAt) : inputStartsAt;

  let numberOfBlockedDays: number;

  let inputDate: Date | undefined;
  let range: DateRange;

  if (typeof inputRange === 'number') {
    numberOfBlockedDays = inputRange - 1;

    range = dateRange({ type: DateRangeType.DAY, date: startsAt });
  } else if (isDateRange(inputRange)) {
    range = inputRange;
    inputDate = inputRange.start;

    if (!isValidDateBlockTimingStartDate(inputRange.start)) {
      throw new Error('Invalid dateBlockTiming start date passed to dateBlockTiming() via inputRange.');
    }

    numberOfBlockedDays = differenceInDays(inputRange.end, inputRange.start); // min of 1 day
  } else {
    inputDate = startsAt; // TODO: May not be needed?
    numberOfBlockedDays = inputRange.distance - 1;
    range = dateRange({ type: DateRangeType.DAY, date: inputDate }, true);
  }

  if (inputDate != null) {
    // input date takes priority, so move the startsAt's date to be on the same date.
    startsAt = copyHoursAndMinutesFromDate(range.start, startsAt, true);

    const startedBeforeRange = isBefore(startsAt, range.start);

    if (startedBeforeRange) {
      startsAt = addDays(startsAt, 1); // starts 24 hours later
      numberOfBlockedDays = Math.max(numberOfBlockedDays - 1, 0); // reduce number of applied days by 1, to a min of 0
    }
  } else {
    startsAt = roundDownToMinute(startsAt); // clear seconds and milliseconds from startsAt
    // numberOfBlockedDays = numberOfBlockedDays - 1; // reduce number of applied days by 1
  }

  const start = range.start;
  startsAt = timezoneInstance ? timezoneInstance.targetDateToSystemDate(startsAt) : startsAt;

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
 * Creates a DateBlockTiming from the DateDurationSpan and range input with the start offset set in the pre-configured timezone.
 */
export type DateBlockTimingInTimezoneFunction = ((durationInput: DateDurationSpan, inputRange: DateBlockTimingRangeInput) => DateBlockTiming) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
};

export function dateBlockTimingInTimezoneFunction(input: TimingDateTimezoneUtcNormalInput): DateBlockTimingInTimezoneFunction {
  const changeTimezoneFunction = changeTimingToTimezoneFunction(input);

  const fn = ((durationInput: DateDurationSpan, inputRange: DateBlockTimingRangeInput) => {
    const timing = dateBlockTiming(durationInput, inputRange, { timezone: changeTimezoneFunction._timezoneInstance });
    return changeTimezoneFunction(timing);
  }) as Building<DateBlockTimingInTimezoneFunction>;

  fn._timezoneInstance = changeTimezoneFunction._timezoneInstance;
  return fn as DateBlockTimingInTimezoneFunction;
}

export function dateBlockTimingInTimezone(durationInput: DateDurationSpan, inputRange: DateBlockTimingRangeInput, timezone: TimingDateTimezoneUtcNormalInput) {
  return dateBlockTimingInTimezoneFunction(timezone)(durationInput, inputRange);
}

export interface IsValidDateBlockTimingInfo {
  readonly isValid: boolean;
  readonly isStartRoundedToSeconds: boolean;
  readonly msDifference: boolean;
  readonly endIsAfterTheStartsAtTime: boolean;
  readonly durationLessThan24Hours: boolean;
  readonly startHasZeroSeconds: boolean;
  readonly startsAtIsAfterStart: boolean;
  readonly startsAtIsLessThan24HoursAfterStart: boolean;
  readonly isExpectedValidEnd: boolean;
  readonly isPlausiblyValidEnd: boolean;
}

export function isValidDateBlockTimingInfo(timing: DateBlockTiming, timezone?: TimezoneString) {
  const { end, start, startsAt, duration } = timing;

  const {
    currentTimezoneOffsetInHours: startOffsetInHours // offset as computed on the given date.
  } = getCurrentDateBlockTimingOffsetData(timing);

  const isStartRoundedToSeconds = start.getMilliseconds() === 0; // should have no milliseconds specified
  const msDifference = differenceInMilliseconds(startsAt, start); // startsAt is a specific instance to compare to the midnight instant of the target timezone

  const endIsAfterTheStartsAtTime = isAfter(end, startsAt);
  const durationLessThan24Hours = duration <= MINUTES_IN_DAY;
  const startHasZeroSeconds = start.getSeconds() === 0;
  const startsAtIsAfterStart = msDifference >= 0;
  const startsAtIsLessThan24HoursAfterStart = msDifference < MS_IN_DAY;

  let isValid: boolean = false;

  let isExpectedValidEnd = false;
  let isPlausiblyValidEnd = false;

  if (
    isStartRoundedToSeconds &&
    endIsAfterTheStartsAtTime && // end must be after the startsAt time
    durationLessThan24Hours &&
    startHasZeroSeconds && // start cannot have seconds
    startsAtIsAfterStart && // startsAt is after start instance, secondsDifference
    startsAtIsLessThan24HoursAfterStart // startsAt is not 24 hours or more later. If so, should start at that time instead.
  ) {
    const endOffset = getCurrentSystemOffsetInHours(timing.end);
    const timezoneOffsetDelta = endOffset - startOffsetInHours;

    const expectedFinalStartTime = addHours(addMinutes(end, -duration), timezoneOffsetDelta);
    const difference = differenceInMilliseconds(startsAt, expectedFinalStartTime) % MS_IN_DAY;

    isExpectedValidEnd = difference === 0;
    isPlausiblyValidEnd = isExpectedValidEnd || Math.abs(difference) === MS_IN_HOUR;

    isValid = isPlausiblyValidEnd;
  }

  return {
    isValid,
    isStartRoundedToSeconds,
    msDifference,
    endIsAfterTheStartsAtTime,
    durationLessThan24Hours,
    startHasZeroSeconds,
    startsAtIsAfterStart,
    startsAtIsLessThan24HoursAfterStart,
    isExpectedValidEnd,
    isPlausiblyValidEnd
  };
}

/**
 *
 * @param timing
 * @returns
 */
export function isValidDateBlockTiming(timing: DateBlockTiming): boolean {
  const { isValid } = isValidDateBlockTimingInfo(timing);
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
export function dateBlockDayOfWeekFactory(inputDayForIndexZero: DayOfWeek | Date): DateBlockDayOfWeekFactory {
  const dayForIndexZero = typeof inputDayForIndexZero === 'number' ? inputDayForIndexZero : (inputDayForIndexZero.getUTCDay() as DayOfWeek);
  return (index: DateBlockIndex) => getNextDay(dayForIndexZero, index);
}

/**
 * Reference to a DateBlockTiming
 */
export interface DateBlockTimingRef {
  timing: DateBlockTiming;
}

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
   * (Optional) Additional filter function based on the calcualted DateBlockDurationSpan.
   */
  durationSpanFilter?: FilterFunction<DateBlockDurationSpan<B>>;
  /**
   * (Optional) Max number of blocks to evaluate.
   */
  blocksEvaluationLimit?: number;
  /**
   * (Optional) Max number of DateBlockDurationSpan values to return.
   */
  maxDateBlocksToReturn?: number;
}

/**
 * Creates a DateBlocksExpansionFactory
 *
 * @param config
 * @returns
 */
export function dateBlocksExpansionFactory<B extends DateBlock | DateBlockRange = DateBlock>(config: DateBlocksExpansionFactoryConfig): DateBlocksExpansionFactory<B> {
  const { timing, rangeLimit, filter: inputFilter, durationSpanFilter: inputDurationSpanFilter, maxDateBlocksToReturn = Number.MAX_SAFE_INTEGER, blocksEvaluationLimit = Number.MAX_SAFE_INTEGER } = config;
  const { startsAt: baseStart, duration } = timing;
  const indexRange = rangeLimit !== false ? dateBlockIndexRange(timing, rangeLimit) : { minIndex: Number.MIN_SAFE_INTEGER, maxIndex: Number.MAX_SAFE_INTEGER };

  const isInRange = indexRangeCheckFunction({ indexRange, inclusiveMaxIndex: false });
  const filter: FilterFunction<B> = mergeFilterFunctions<B>((x: B) => isInRange(x.i), inputFilter);
  const durationSpanFilter: FilterFunction<DateBlockDurationSpan<B>> = inputDurationSpanFilter ?? (() => true);

  return (input: DateBlocksExpansionFactoryInput<B>) => {
    const blocks = Array.isArray(input) ? input : input.blocks;
    const spans: DateBlockDurationSpan<B>[] = [];

    let blocksEvaluated = 0;

    function filterAndPush(block: B, blockIndex: number) {
      // increase the evaluation count early in-case we set the blocksEvaluationLimit below.
      blocksEvaluated += 1;

      if (filter(block, blockIndex)) {
        const startsAt = addDays(baseStart, block.i);
        const durationSpan: DateBlockDurationSpan<B> = {
          ...block,
          startsAt,
          duration
        };

        // try the duration span filter
        if (durationSpanFilter(durationSpan, blockIndex)) {
          if (spans.length >= maxDateBlocksToReturn) {
            blocksEvaluated = blocksEvaluationLimit; // trigger return below
          } else {
            spans.push(durationSpan);
          }
        }
      }
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

      return blocksEvaluated >= blocksEvaluationLimit; // continue iterating until we hit the evaluation limit or run out of items.
    });

    return spans;
  };
}

export type DateBlockDayTimingInfoFactoryConfig = Pick<DateBlocksExpansionFactoryConfig, 'timing' | 'rangeLimit'>;

export interface DateBlockDayTimingInfo {
  /**
   * Input date or calculated date if provided a dayIndex.
   */
  date: Date;
  /**
   * Index for the day for the input date.
   */
  dayIndex: DateBlockIndex;
  /**
   * Index for the previous index/current index depending on the TimingInfo's daily execution.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex.
   */
  currentIndex: DateBlockIndex;
  /**
   * Index for the next execution. Does not check if it is in range.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex + 1.
   */
  nextIndex: DateBlockIndex;
  /**
   * Index for the next execution, if in the range, otherwise undefined.
   *
   * If the index is currently in progress given the timing, this will return the dayIndex + 1.
   */
  nextIndexInRange: Maybe<DateBlockIndex>;
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
 * Generates DateBlockDayTimingInfo about the input date relative to the input timing and range limit.
 *
 * The date may not exist within the range, but will still compute values using the input date and timing configuration.
 *
 * Can optionally specify a now that is used for checking the inProgress functionality.
 */
export type DateBlockDayTimingInfoFactory = (date: DateOrDateBlockIndex, now?: Date) => DateBlockDayTimingInfo;

export function dateBlockDayTimingInfoFactory(config: DateBlockDayTimingInfoFactoryConfig): DateBlockDayTimingInfoFactory {
  const { timing, rangeLimit } = config;
  const { duration } = timing;
  const indexRange = rangeLimit !== false ? dateBlockIndexRange(timing, rangeLimit) : { minIndex: Number.MIN_SAFE_INTEGER, maxIndex: Number.MAX_SAFE_INTEGER };
  const checkIsInRange = indexRangeCheckFunction({ indexRange, inclusiveMaxIndex: false });
  const dayIndexFactory = dateTimingRelativeIndexFactory(timing);
  const dayFactory = dateBlockTimingDateFactory(timing);
  const startsAtFactory = dateBlockTimingStartsAtDateFactory(dayIndexFactory);

  return (input: DateOrDateBlockIndex, inputNow?: Date) => {
    const date = typeof input === 'number' ? dayFactory(input) : input;

    const dayIndex = dayIndexFactory(input);
    const isInRange = checkIsInRange(dayIndex);

    const now = inputNow ?? date;
    const startsAtOnDay = startsAtFactory(dayIndex); // convert back to the proper date
    const endsAtOnDay = addMinutes(startsAtOnDay, duration);
    const potentiallyInProgress = !isAfter(startsAtOnDay, now); // is potentially in progress if the now is equal-to or after the start time.

    const isInProgress = potentiallyInProgress && !isAfter(now, endsAtOnDay);
    const hasOccuredToday = potentiallyInProgress && !isInProgress;

    const currentIndex: DateBlockIndex = isInProgress || hasOccuredToday ? dayIndex : dayIndex - 1; // If not in progress and hasn't occured today, current index is the previous index.
    const nextIndex: DateBlockIndex = currentIndex + 1;
    const nextIndexInRange: Maybe<DateBlockIndex> = checkIsInRange(nextIndex) ? nextIndex : undefined;

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
  let maxIndex = differenceInDays(endDate, zeroDate) + 1;

  if (limit) {
    const { start, end } = dateBlockTiming(timing, limit);
    const limitMin = differenceInDays(start, zeroDate);
    const hoursDiff = differenceInHours(end, zeroDate) / HOURS_IN_DAY;
    const limitMax = Math.ceil(hoursDiff);

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
  const dateBlockIsWithinDateBlockRange = isDateBlockWithinDateBlockRangeFunction(range);
  return blocks.filter(dateBlockIsWithinDateBlockRange);
}

export type IsDateBlockWithinDateBlockRangeInput = DateBlockOrDateBlockIndexOrDateBlockRange;

/**
 * Function that returns true if the input range is equal or falls within the configured DateBlockRange.
 */
export type IsDateBlockWithinDateBlockRangeFunction = (input: IsDateBlockWithinDateBlockRangeInput) => boolean;

export function isDateBlockWithinDateBlockRangeFunction(inputRange: IsDateBlockWithinDateBlockRangeInput): IsDateBlockWithinDateBlockRangeFunction {
  const range = dateBlockRangeWithRange(inputRange);
  return (input: IsDateBlockWithinDateBlockRangeInput) => {
    if (typeof input === 'number') {
      input = { i: input };
    }

    if (input.i >= range.i) {
      const to = (input as DateBlockRange).to ?? input.i;
      return to <= range.to;
    }

    return false;
  };
}

/**
 * Returns true if the first DateBlock or DateBlockRange contains the second input.
 *
 * @param range
 * @param isContainedWithin
 * @returns
 */
export function isDateBlockWithinDateBlockRange(range: IsDateBlockWithinDateBlockRangeInput, contains: IsDateBlockWithinDateBlockRangeInput) {
  return isDateBlockWithinDateBlockRangeFunction(range)(dateBlockRangeWithRange(contains));
}

/**
 * Input for a IsDateWithinDateBlockRangeFunction
 */
export type IsDateWithinDateBlockRangeInput = DateOrDateBlockIndex | DateRangeStart | DateRange | DateBlock | DateBlockRange;

/**
 * Function that returns true if the input range is equal or falls within the configured DateBlockRange.
 */
export type IsDateWithinDateBlockRangeFunction = (input: IsDateWithinDateBlockRangeInput) => boolean;

export interface IsDateWithinDateBlockRangeConfig {
  /**
   * Optional date to make the indexes relative to when converting date values.
   *
   * If not provided, defaults to the index in the range if a date is provided, or throws an exception if a date range is input.
   */
  start?: Date;
  /**
   * Range to compare the input to.
   */
  range: IsDateWithinDateBlockRangeInput;
}

export function isDateWithinDateBlockRangeFunction(config: IsDateWithinDateBlockRangeConfig): IsDateWithinDateBlockRangeFunction {
  const { start: inputStart, range: inputRange } = config;
  let start: Date | undefined = inputStart;

  let dateRange: (DateRangeStart & Partial<DateRange>) | undefined;
  let rangeInput: DateBlock | DateBlockRange | undefined;

  if (typeof inputRange === 'number') {
    rangeInput = { i: inputRange };
  } else if (isDate(inputRange)) {
    dateRange = { start: inputRange };
  } else if (isDateRangeStart(inputRange)) {
    dateRange = inputRange;
  } else {
    rangeInput = inputRange as DateBlock | DateBlockRange;
  }

  if (start == null) {
    if (dateRange) {
      start = inputRange as Date;
    } else {
      throw new Error('Invalid isDateWithinDateBlockRangeFunction() config. Start date could not be determined from input.');
    }
  }

  const indexFactory = dateTimingRelativeIndexFactory({ start });

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
      throw new Error('Invalid isDateWithinDateBlockRangeFunction() config. Range determined from input.'); // shouldn't occur
    }
  }

  const isDateBlockWithinDateBlockRange = isDateBlockWithinDateBlockRangeFunction(rangeInput);

  return (input: IsDateWithinDateBlockRangeInput) => {
    let range: DateBlockOrDateBlockIndexOrDateBlockRange;

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

    return isDateBlockWithinDateBlockRange(range);
  };
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
  @Min(0)
  to?: DateBlockIndex;

  constructor(template?: DateBlockRange) {
    super(template);
    if (template) {
      this.to = template.to;
    }
  }
}

/**
 * A DateBlockIndex, DateBlock, or DateBlockRange
 */
export type DateBlockOrDateBlockIndexOrDateBlockRange = DateBlockIndex | DateBlock | DateBlockRange;

/**
 * Returns true if the input is a valid DateBlockRange.
 *
 * @param input
 * @returns
 */
export function isValidDateBlockRange(input: DateBlockRange): boolean {
  const { i, to } = input;

  if (!isValidDateBlockIndex(i)) {
    return false;
  } else if (to != null && (!isValidDateBlockIndex(to) || to < i)) {
    return false;
  }

  return true;
}

/**
 * Returns true if the input is a sorted DateBlockRange array and there are no repeat indexes.
 *
 * @param input
 * @returns
 */
export function isValidDateBlockRangeSeries(input: DateBlockRange[]): boolean {
  if (!Array.isArray(input)) {
    return false;
  }

  const invalidRange = input.findIndex((range) => !isValidDateBlockRange(range));

  if (invalidRange !== -1) {
    return false;
  }

  let greatestIndex = -1;

  for (let i = 0; i < input.length; i += 1) {
    const range = input[i];

    if (range.i <= greatestIndex) {
      return false;
    } else {
      const nextGreatestIndex = range.to || range.i; // to is greater than or equal to i in a valid date block range.
      greatestIndex = nextGreatestIndex;
    }
  }

  return true;
}

/**
 * Returns the lowest index between all the input date block ranges. Returns 0 by default if there is no minimum or input blocks.
 *
 * The input range is not expected to be sorted.
 */
export function getLeastDateBlockIndexInDateBlockRanges(input: (DateBlock | DateBlockRange)[]): DateBlockIndex {
  return getLeastAndGreatestDateBlockIndexInDateBlockRanges(input)?.leastIndex ?? 0;
}

/**
 * Returns the largest index between all the input date block ranges. Returns 0 by default.
 *
 * The input range is not expected to be sorted.
 */
export function getGreatestDateBlockIndexInDateBlockRanges(input: (DateBlock | DateBlockRange)[]): DateBlockIndex {
  return getLeastAndGreatestDateBlockIndexInDateBlockRanges(input)?.greatestIndex ?? 0;
}

export interface LeastAndGreatestDateBlockIndexResult<T> {
  leastIndex: number;
  leastIndexItem: T;
  greatestIndex: number;
  greatestIndexItem: T;
}

/**
 * Returns the largest index between all the input date block ranges. Returns null if the input is empty.
 *
 * The input range is not expected to be sorted.
 */
export function getLeastAndGreatestDateBlockIndexInDateBlockRanges<T extends DateBlockRange>(input: T[]): Maybe<LeastAndGreatestDateBlockIndexResult<T>> {
  if (!input.length) {
    return null;
  }

  let leastIndex = Number.MAX_SAFE_INTEGER;
  let greatestIndex = 0;
  let leastIndexItem: T = input[0];
  let greatestIndexItem: T = input[0];

  for (let i = 0; i < input.length; i += 1) {
    const range = input[i];
    const leastRangeIndex = range.i;
    const greatestRangeIndex = (range as DateBlockRange).to || range.i;

    if (leastRangeIndex < leastIndex) {
      leastIndex = leastRangeIndex;
      leastIndexItem = range;
    }

    if (greatestRangeIndex > greatestIndex) {
      greatestIndex = greatestRangeIndex;
      greatestIndexItem = range;
    }
  }

  return {
    leastIndex,
    leastIndexItem,
    greatestIndex,
    greatestIndexItem
  };
}

/**
 * Input type used for cases where a DateRange or a DateBlockRange are allowed as input but used the start/end parameters in DateRange.
 */
export interface DateBlockRangeOrDateRange {
  start?: Maybe<DateOrDateBlockIndex>;
  end?: Maybe<DateOrDateBlockIndex>;
}

export type DateOrDateBlockIndexOrDateBlockRange = DateOrDateBlockIndex | DateBlockRange;
export type DateOrDateRangeOrDateBlockIndexOrDateBlockRange = DateRange | DateOrDateBlockIndexOrDateBlockRange;

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

/**
 * Creates a DateBlockRangeWithRange from the input DateBlockIndex.
 *
 * @param dateBlockIndex
 * @returns
 */
export function dateBlockRangeWithRangeFromIndex(dateBlockIndex: DateBlockIndex): DateBlockRangeWithRange {
  return dateBlockRange(dateBlockIndex, dateBlockIndex);
}

/**
 * Creates a DateBlockRangeWithRange from the input DateBlockIndex, DateBlock, or DateBlockRange.
 *
 * @param input
 * @returns
 */
export function dateBlockRangeWithRange(input: DateBlockOrDateBlockIndexOrDateBlockRange): DateBlockRangeWithRange {
  if (typeof input === 'number') {
    return dateBlockRangeWithRangeFromIndex(input);
  } else {
    return dateBlockRange(input.i, (input as DateBlockRange).to);
  }
}

/**
 * Function that returns true if the input range covers the full range of the configured DateBlockRange.
 */
export type DateBlockRangeIncludedByRangeFunction = (range: DateBlockOrDateBlockIndexOrDateBlockRange) => boolean;

/**
 * Creates a DateBlockRangeIncludedByRangeFunction
 *
 * @param inputRange
 * @returns
 */
export function dateBlockRangeIncludedByRangeFunction(inputRange: DateBlockOrDateBlockIndexOrDateBlockRange): DateBlockRangeIncludedByRangeFunction {
  const { i, to } = dateBlockRangeWithRange(inputRange);
  return (input) => {
    const range = dateBlockRangeWithRange(input);
    return range.i <= i && (range?.to ?? range.i) >= to;
  };
}

/**
 * Function that returns true if the input range overlaps the range of the configured DateBlockRange.
 */
export type DateBlockRangeOverlapsRangeFunction = (range: DateBlockOrDateBlockIndexOrDateBlockRange) => boolean;

/**
 * Creates a DateBlockRangeOverlapsRangeFunction
 *
 * @param inputRange
 * @returns
 */
export function dateBlockRangeOverlapsRangeFunction(inputRange: DateBlockOrDateBlockIndexOrDateBlockRange): DateBlockRangeOverlapsRangeFunction {
  const { i, to } = dateBlockRangeWithRange(inputRange);
  return (input) => {
    const range = dateBlockRangeWithRange(input);
    return range.i <= to && (range?.to ?? range.i) >= i;
  };
}

/**
 * Returns true if either of the ranges overlap eachother.
 *
 * @param rangeA
 * @param rangeB
 * @returns
 */
export function dateBlockRangeOverlapsRange(rangeA: DateBlockOrDateBlockIndexOrDateBlockRange, rangeB: DateBlockOrDateBlockIndexOrDateBlockRange): boolean {
  return dateBlockRangeOverlapsRangeFunction(rangeA)(rangeB);
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

  function newBlockFromBlocksArrayIndex(blocksArrayIndex: number): DateBlockRangeWithRange {
    const { i, to } = blocks[blocksArrayIndex] as DateBlockRange;
    return {
      i,
      to: to ?? i
    };
  }

  // start at the first block
  let current: DateBlockRangeWithRange = newBlockFromBlocksArrayIndex(0);

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
      current = newBlockFromBlocksArrayIndex(i);
    }
  }

  results.push(current);

  return results;
}

/**
 * Returns an array containing all indexes in the date block range.
 */
export function allIndexesInDateBlockRange(input: DateBlockRange): DateBlockIndex[] {
  return input.to != null ? range((input as DateBlockRange).i, input.to + 1) : [input.i];
}

/**
 * Returns the set of all indexes within the input.
 *
 * @param input
 * @returns
 */
export function allIndexesInDateBlockRanges(input: (DateBlockIndex | DateBlockRange)[]): Set<DateBlockIndex> {
  const set = new Set<DateBlockIndex>();

  input.forEach((x) => {
    if (typeof x === 'number') {
      set.add(x);
    } else {
      const allIndexes = allIndexesInDateBlockRange(x);
      addToSet(set, allIndexes);
    }
  });

  return set;
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
    average: count > 0 ? total / count : 0
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
 * Returns true if the input DateBlockRange is longer than 1 block (I.E. has a "to" value greater than it's "i" value).
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

/**
 * Modifies or filter out any blocks that are outside the range to fit within the configured range.
 */
export type ModifyDateBlocksToFitRangeFunction = <B extends DateBlock | DateBlockRange | UniqueDateBlock>(input: B[]) => B[];

/**
 * Creatse a ModifyDateBlocksToFitRangeFunction
 */
export function modifyDateBlocksToFitRangeFunction(range: DateBlockRange): ModifyDateBlocksToFitRangeFunction {
  const { i, to } = dateBlockRangeWithRange(range);
  const dateBlockIsWithinDateBlockRange = isDateBlockWithinDateBlockRangeFunction(range);
  const overlapsRange = dateBlockRangeOverlapsRangeFunction(range);

  return <B extends DateBlock | DateBlockRange | UniqueDateBlock>(input: B[]) =>
    filterMaybeValues(
      input.map((x) => {
        let result: Maybe<B>;

        const inRange = dateBlockIsWithinDateBlockRange(x);

        if (inRange) {
          // if contained within the range then return as-is
          result = x;
        } else {
          // fit to the range otherwise
          const asRange = dateBlockRangeWithRange(x);
          const rangesOverlap = overlapsRange(asRange);

          if (rangesOverlap) {
            result = {
              ...x,
              i: Math.max(i, asRange.i), // should be no smaller than i
              to: Math.min(to, asRange.to) // should be no larger than to
            };
          }
        }

        return result;
      })
    );
}

export function modifyDateBlocksToFitRange<B extends DateBlock | DateBlockRange | UniqueDateBlock>(range: DateBlockRange, input: B[]): B[] {
  return modifyDateBlocksToFitRangeFunction(range)(input);
}

export function modifyDateBlockToFitRange<B extends DateBlock | DateBlockRange | UniqueDateBlock>(range: DateBlockRange, input: B): Maybe<B> {
  return modifyDateBlocksToFitRange(range, [input])[0];
}

// MARK: Compat
/**
 * @deprecated use IsDateBlockWithinDateBlockRangeFunction instead.
 */
export type DateBlockIsWithinDateBlockRangeFunction = IsDateBlockWithinDateBlockRangeFunction;

/**
 * @deprecated use isDateBlockWithinDateBlockRangeFunction() instead.
 */
export const dateBlockIsWithinDateBlockRangeFunction = isDateBlockWithinDateBlockRangeFunction;

/**
 * @deprecated use isDateBlockWithinDateBlockRange() instead.
 */
export const dateBlockRangeContainsDateBlock = isDateBlockWithinDateBlockRange;

/**
 * @deprecated use DateBlockDayTimingInfoFactory instead.
 */
export type DateBlockDayInfoFactory = DateBlockDayTimingInfoFactory;

/**
 * @deprecated use dateBlocksDayTimingInfoFactory instead.
 */
export const dateBlocksDayInfoFactory = dateBlockDayTimingInfoFactory;
