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
  makeValuesGroupMap,
  findBestIndexMatchFunction,
  TimezoneStringRef
} from '@dereekb/util';
import { dateRange, DateRange, DateRangeDayDistanceInput, DateRangeStart, DateRangeType, fitDateRangeToDayPeriod, isDateRange, isDateRangeStart } from './date.range';
import { DateDurationSpan } from './date.duration';
import { differenceInDays, differenceInMilliseconds, isBefore, addDays, addMinutes, getSeconds, getMilliseconds, getMinutes, addMilliseconds, hoursToMilliseconds, addHours, differenceInHours, isAfter, minutesToHours, differenceInMinutes, startOfDay, milliseconds } from 'date-fns';
import { isDate, copyHoursAndMinutesFromDate, roundDownToMinute, copyHoursAndMinutesFromNow, isSameDate } from './date';
import { Expose, Type } from 'class-transformer';
import { DateTimezoneUtcNormalFunctionInput, DateTimezoneUtcNormalInstance, dateTimezoneUtcNormal, getCurrentSystemOffsetInHours, startOfDayInTimezoneDayStringFactory, copyHoursAndMinutesFromDateWithTimezoneNormal, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE, copyHoursAndMinutesFromNowWithTimezoneNormal, DateTimezoneConversionConfigUseSystemTimezone } from './date.timezone';
import { IsDate, IsNumber, IsOptional, Min } from 'class-validator';
import { parseISO8601DayStringToDate, parseISO8601DayStringToUTCDate } from './date.format';

/**
 * Index from 0 of which day this block represents.
 */
export type DateCellIndex = number;

/**
 * Returns true if the index is a non-negative integer.
 *
 * @param input
 */
export function isValidDateCellIndex(input: DateCellIndex): boolean {
  return input >= 0 && Number.isInteger(input);
}

/**
 * Input type that is either a Date or a DateCellIndex.
 */
export type DateOrDateCellIndex = Date | DateCellIndex;

/**
 * A duration-span block.
 */
export interface DateCell extends IndexRef {
  i: DateCellIndex;
}

export class DateCell {
  @Expose()
  @IsNumber()
  @Min(0)
  i!: DateCellIndex;

  constructor(template?: DateCell) {
    if (template) {
      this.i = template.i;
    }
  }
}

/**
 * Converts the input number or DateCell to a DateCell.
 *
 * @param dateCellOrIndex
 * @returns
 */
export function dateCell(dateCellOrIndex: DateCellIndex | DateCell): DateCell {
  return typeof dateCellOrIndex === 'number' ? { i: dateCellOrIndex } : dateCellOrIndex;
}

/**
 * An array of DateCell-like values.
 */
export type DateCellArray<B extends DateCell = DateCell> = B[];

/**
 * Reference to a DateCellArray
 */
export type DateCellArrayRef<B extends DateCell = DateCell> = {
  blocks: DateCellArray<B>;
};

/**
 * DateCellTiming with only the start time.
 *
 * The start time is midnight of what timezone it is in, and can be used to infer the target timezone offset for that date.
 */
export type DateCellTimingStart = DateRangeStart;

/**
 * The maximum number of hours that a DateCellTiming's start can be offset. This means a max timezone of UTC+12.
 *
 * The timezones UTC+13 and UTC+14 are not supported, and will experience undetermined behavior.
 */
export const MAX_DATE_BLOCK_TIMING_OFFSET_HOURS = 12;

/**
 * The minimum number of hours that a DateCellTiming's start can be offset. This means a min timezone of UTC-12.
 */
export const MIN_DATE_BLOCK_TIMING_OFFSET_HOURS = -12;

/**
 * The DateCellTimingStart and startsAt times
 */
export type DateCellTimingStartAndStartsAt = DateCellTimingStart & Pick<DateCellTiming, 'startsAt'>;

/**
 * Is combination of DateRange and DateDurationSpan. The DateRange captures a range of days that a DateCell takes up, and the DateDurationSpan
 * captures the Dates at which the Job occurs at.
 *
 * NOTES:
 * - start time should be the first second of the day (0 seconds and 0 minutes) for its given timezone. This lets us derive the proper offset.
 *   This means that for GMT+1 the starting date would be 01:00, which can then be normalized to the system timezone to normalize the correct current date. This also means we can safely create a new DateCellTiming using startOfDay(new Date()) and it will be the correct time.
 * - The start date should always be normalized before being used.
 * - The startsAt time should be greater than or equal to the normalized start
 * - The startsAt time should be on the same date as normalized start
 * - The end time should equal the ending date/time of the final end duration.
 * - (Recommended, Optional) The timezone the date block timing is for. This timezone is required for areas that experience daylight savings in order to properly handle the offsets.
 */
export interface DateCellTiming extends DateCellTimingStart, DateRange, DateDurationSpan, Partial<TimezoneStringRef> {}

/**
 * The DateRange component for a DateCellTiming. The start date is a DateCellTimingStart.
 */
export type DateCellTimingStartEndRange = DateCellTimingStart & Pick<DateCellTiming, 'end' | 'timezone'>;

/**
 * The start date of a DateCellTimingStart, along with the endDay which is a normalized day that is at midnight of the last day in the timezone.
 *
 * They are expected to both be in the same timezone.
 */
export type DateCellTimingStartEndDayDateRange = DateCellTimingStart & { endDay: Date };

/**
 * The startsAt time of the event.
 */
export type DateCellTimingEventStartsAt = Pick<DateCellTiming, 'startsAt'>;

/**
 * A startsAt time and duration.
 */
export type DateCellTimingEvent = Pick<DateCellTiming, 'startsAt' | 'duration'>;

export class DateCellTiming extends DateDurationSpan {
  @Expose()
  @IsDate()
  @Type(() => Date)
  start!: Date;

  @Expose()
  @IsDate()
  @Type(() => Date)
  end!: Date;

  @Expose()
  @IsOptional()
  timezone?: TimezoneString;

  constructor(template?: DateCellTiming) {
    super(template);

    if (template) {
      this.start = template.start;
      this.end = template.end;
    }
  }
}

export interface CurrentDateCellTimingUtcData {
  /**
   * Non-normalized start date in the system time.
   */
  originalUtcDate: Date;
  /**
   * Offset of the input timing to UTC.
   */
  originalUtcOffsetInHours: Hours;
}

export interface CurrentDateCellTimingOffsetData extends CurrentDateCellTimingUtcData {
  offset: Milliseconds;
  currentTimezoneOffsetInHours: Hours;
}

/**
 * Returns true if the two timings are equivalent.
 *
 * @param a
 * @param b
 */
export function isSameDateCellTiming(a: Maybe<DateCellTiming>, b: Maybe<DateCellTiming>): boolean {
  return a && b ? a.duration === b.duration && isSameDate(a.start, b.start) && isSameDate(a.startsAt, b.startsAt) && isSameDate(a.end, b.end) : a == b;
}

/**
 * Returns the date range from the start of the first event to the end time of the last event.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingFullRange(timing: Pick<DateCellTiming, 'start' | 'end'>): DateRange {
  return { start: timing.start, end: timing.end };
}

/**
 * Returns the date range from the start of the first event to the end time of the last event.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingEventRange(timing: Pick<DateCellTiming, 'startsAt' | 'end'>): DateRange {
  return { start: timing.startsAt, end: timing.end };
}

export function getCurrentDateCellTimingUtcData(timing: DateRangeStart): CurrentDateCellTimingUtcData {
  const start = timing.start;
  const dateHours = start.getUTCHours();

  // if it is a positive offset, then the date is in the future so we subtract the offset from 24 hours to get the proper offset.
  const originalUtcOffsetInHours = dateHours >= MAX_DATE_BLOCK_TIMING_OFFSET_HOURS ? HOURS_IN_DAY - dateHours : -dateHours;
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
export function getCurrentDateCellTimingOffsetData(timing: DateRangeStart): CurrentDateCellTimingOffsetData {
  const { originalUtcOffsetInHours, originalUtcDate } = getCurrentDateCellTimingUtcData(timing);
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

export function getCurrentDateCellTimingOffset(timing: DateRangeStart): Milliseconds {
  return getCurrentDateCellTimingOffsetData(timing).offset;
}

export type TimingIsExpectedTimezoneFunction = (timing: DateRangeStart) => boolean;

export function timingIsInExpectedTimezoneFunction(timezone: DateTimezoneUtcNormalFunctionInput) {
  const normal = dateTimezoneUtcNormal(timezone);

  return (timing: DateRangeStart) => {
    const { start } = timing;

    const offset = normal.systemDateToTargetDateOffset(start);
    const expectedTimingOffset = getCurrentDateCellTimingOffsetData(timing);
    return offset === expectedTimingOffset.offset;
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
export function getDateCellTimingFirstEventDateRange(timing: Pick<DateCellTiming, 'startsAt' | 'end'>): DateRange {
  return fitDateRangeToDayPeriod({ start: timing.startsAt, end: timing.end });
}

/**
 * Returns the fractional hours in the event.
 *
 * @param timing
 * @returns
 */
export function getDateCellTimingHoursInEvent(timing: Pick<DateCellTiming, 'startsAt' | 'end'>): FractionalHour {
  const dateRange = getDateCellTimingFirstEventDateRange(timing);
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
  const timezoneNormalInput: DateTimezoneUtcNormalFunctionInput = isDateRangeStart(input) ? hoursToMilliseconds(getCurrentDateCellTimingUtcData(input).originalUtcOffsetInHours) : input;
  const timezoneInstance = dateTimezoneUtcNormal(timezoneNormalInput);
  return timezoneInstance;
}

/**
 * Convenience function that extends timingDateTimezoneUtcNormal() but also asserts the that the timing matches it.
 *
 * @param input
 * @param timing
 * @returns
 */
export function assertedTimingDateTimezoneUtcNormal(input: TimingDateTimezoneUtcNormalInput, timing: DateCellTimingStart): DateTimezoneUtcNormalInstance {
  const timezoneInstance = timingDateTimezoneUtcNormal(input);

  if (!timingIsInExpectedTimezone(timing, timezoneInstance)) {
    throw new Error(`assertedTimingDateTimezoneUtcNormal() failed to expected to match with the timing.`);
  }

  return timezoneInstance;
}

/**
 * Converts a DateCellTimingStartEndRange and DateCellTimingEvent that originated from the same DateCellTiming back to the original DateCellTiming.
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
export function dateCellTimingFromDateRangeAndEvent(dateCellTimingStartEndRange: DateCellTimingStartEndRange, event: DateCellTimingEvent): DateCellTiming;
export function dateCellTimingFromDateRangeAndEvent(dateCellTimingStartEndRange: DateCellTimingStartEndRange, event: DateCellTimingEvent): DateCellTiming {
  const { start, end } = dateCellTimingStartEndRange;
  const { startsAt: eventStartsAt, duration } = event;

  // need the timezone instance to compute against the normal and convert to the system time, before going back.
  // this is necessary because the start is a timezone normal for UTC, and the minutes need to be converted back properly adjusting for timezones.
  const timezoneInstance = timingDateTimezoneUtcNormal(dateCellTimingStartEndRange);

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
 * Converts a DateCellTimingStartEndRange and a DateCellTimingEvent to a DateCellTiming.
 *
 * The input event does not have to be from the original DateCellTimingStartEndRange, but the start date is always retained, and the same end day is retained, but may be updated to reflect a new end date/time.
 *
 * @param dateCellTimingStartEndRange
 * @param event
 * @param timezone
 * @returns
 */
export function safeDateCellTimingFromDateRangeAndEvent(dateCellTimingStartEndRange: DateCellTimingStartEndRange, event: DateCellTimingEvent, timezone: DateTimezoneUtcNormalInstance | TimezoneString): DateCellTiming;
/**
 * @deprecated timezone should be provided, as it will behave properly for daylight savings changes.
 */
export function safeDateCellTimingFromDateRangeAndEvent(dateCellTimingStartEndRange: DateCellTimingStartEndRange, event: DateCellTimingEvent, timezone?: DateTimezoneUtcNormalInstance | TimezoneString): DateCellTiming;
export function safeDateCellTimingFromDateRangeAndEvent(dateCellTimingStartEndRange: DateCellTimingStartEndRange, event: DateCellTimingEvent, timezone?: DateTimezoneUtcNormalInstance | TimezoneString): DateCellTiming {
  const { start, end } = dateCellTimingStartEndRange;

  const timezoneInstance = assertedTimingDateTimezoneUtcNormal(timezone ?? dateCellTimingStartEndRange, dateCellTimingStartEndRange);
  // const startDayFactory = dateCellTimingStartDateFactory({ start }, timezoneInstance);
  const endDay = end; // get midnight of the day the job usually ends at

  const endDayDateRange: DateCellTimingStartEndDayDateRange = { start, endDay };
  return _dateCellTimingFromDateCellTimingStartEndDayDateRange(endDayDateRange, event, timezoneInstance);
}

/**
 * Converts a DateCellTimingStartEndDayDateRange and DateCellTimingEvent to a DateCellTiming. The event is used to derive the startsAt, duration and end time. The timezone offset is retained.
 *
 * @param dateCellTimingStartEndDayDateRange
 * @param event
 * @returns
 */
export function dateCellTimingFromDateCellTimingStartEndDayDateRange(dateCellTimingStartEndDayDateRange: DateCellTimingStartEndDayDateRange, event: DateCellTimingEvent, timezone: DateTimezoneUtcNormalInstance | TimezoneString): DateCellTiming {
  // need the timezone instance to compute against the normal and convert to the system time, before going back.
  // this is necessary because the start is a timezone normal for UTC, and the minutes need to be converted back properly adjusting for timezones.
  const timezoneInstance = assertedTimingDateTimezoneUtcNormal(timezone ?? dateCellTimingStartEndDayDateRange, dateCellTimingStartEndDayDateRange);
  return _dateCellTimingFromDateCellTimingStartEndDayDateRange(dateCellTimingStartEndDayDateRange, event, timezoneInstance);
}

/**
 * Internal function that allows safeDateCellTimingFromDateRangeAndEvent() and dateCellTimingFromDateCellTimingStartEndDayDateRange()
 * to pass their timezone instances to this function, without having to create a new instance.
 *
 * See dateCellTimingFromDateCellTimingStartEndDayDateRange() for details.
 *
 * @param dateCellTimingStartEndDayDateRange
 * @param event
 * @param timezoneInstance
 * @returns
 */
function _dateCellTimingFromDateCellTimingStartEndDayDateRange(dateCellTimingStartEndDayDateRange: DateCellTimingStartEndDayDateRange, event: DateCellTimingEvent, timezoneInstance: DateTimezoneUtcNormalInstance): DateCellTiming {
  const { start, endDay } = dateCellTimingStartEndDayDateRange;
  const { startsAt: eventStartsAt, duration } = event;

  // compute startsAt, the start time for the first event
  const startsAt = copyHoursAndMinutesFromDateWithTimezoneNormal(start, eventStartsAt, timezoneInstance);

  // compute end, the end time for the last event using the last day
  const lastDayStartsAt = dateCellTimingStartsAtDateFactory({ start, startsAt }, timezoneInstance)(endDay);

  const end = addMinutes(lastDayStartsAt, duration);

  const timing = {
    start,
    end,
    startsAt,
    duration
  };

  console.log({ timezoneInstance, startsAt, eventStartsAt, lastDayStartsAt, dateCellTimingStartEndDayDateRange, event, timing });

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
    const baseTimingOffset = getCurrentDateCellTimingUtcData(timing);

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

export function dateCellTimingStartForNowInSystemTimezone(): DateCellTimingStart {
  return {
    start: startOfDay(new Date())
  };
}

/**
 * Creates a DateCellTimingStart for now in the given timezone.
 *
 * @param timezoneInput
 * @returns
 */
export function dateCellTimingStartForNowInTimezone(timezoneInput: TimingDateTimezoneUtcNormalInput): DateCellTimingStart {
  const dateCellTimingStartSystemTimezone = dateCellTimingStartForNowInSystemTimezone();
  return changeTimingToTimezone(dateCellTimingStartSystemTimezone, timezoneInput);
}

/**
 * Returns the start date in the current/system timezone for the given date.
 *
 * @param timing
 */
export function getCurrentDateCellTimingStartDate(timing: DateCellTimingStart): Date {
  const offset = getCurrentDateCellTimingOffset(timing);
  return addMilliseconds(timing.start, offset);
}

export function isValidDateCellTimingStartDate(date: Date): boolean {
  return getMinutes(date) === 0 && getSeconds(date) === 0 && getMilliseconds(date) === 0;
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
export type DateCellTimingRelativeIndexFactory<T extends DateCellTimingStart = DateCellTimingStart> = ((input: DateCellTimingRelativeIndexFactoryInput) => DateCellIndex) & {
  readonly _timing: T;
  readonly _timingOffsetData: CurrentDateCellTimingOffsetData;
};

/**
 * Returns true if the input is a DateCellTimingRelativeIndexFactory.
 *
 * @param input
 * @returns
 */
export function isDateCellTimingRelativeIndexFactory<T extends DateCellTimingStart = DateCellTimingStart>(input: unknown): input is DateCellTimingRelativeIndexFactory<T> {
  return typeof input === 'function' && (input as DateCellTimingRelativeIndexFactory)._timing != null && (input as DateCellTimingRelativeIndexFactory)._timingOffsetData != null;
}

/**
 * Creates a DateCellTimingRelativeIndexFactory from the input.
 *
 * @param input
 * @returns
 */
export function dateCellTimingRelativeIndexFactory<T extends DateCellTimingStart = DateCellTimingStart>(input: T | DateCellTimingRelativeIndexFactory<T>): DateCellTimingRelativeIndexFactory<T> {
  if (isDateCellTimingRelativeIndexFactory(input)) {
    return input;
  } else {
    const timing = input;
    const offsetData = getCurrentDateCellTimingOffsetData(timing);
    const { originalUtcOffsetInHours: toUtcOffset, currentTimezoneOffsetInHours, originalUtcDate: originalUtcDateInSystemTimeNormal } = offsetData;
    const baseOffsetInHours = currentTimezoneOffsetInHours;

    const factory = ((input: DateOrDateCellIndex | ISO8601DayString) => {
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
    }) as Configurable<Partial<DateCellTimingRelativeIndexFactory<T>>>;
    factory._timing = timing;
    factory._timingOffsetData = offsetData;
    return factory as DateCellTimingRelativeIndexFactory<T>;
  }
}

/**
 * Function that wraps a DateCellTimingRelativeIndexFactory and converts multuple Date/DateCellIndex/DateCellRange values into an array of DateCellIndex values.
 */
export type DateCellTimingRelativeIndexArrayFactory<T extends DateCellTimingStart = DateCellTimingStart> = ((input: ArrayOrValue<DateOrDateRangeOrDateCellIndexOrDateCellRange>) => DateCellIndex[]) & {
  readonly _indexFactory: DateCellTimingRelativeIndexFactory<T>;
};

/**
 * Creates a DateCellTimingRelativeIndexArrayFactory from the input DateCellTimingRelativeIndexFactory.
 *
 * @param indexFactory
 */
export function dateCellTimingRelativeIndexArrayFactory<T extends DateCellTimingStart = DateCellTimingStart>(indexFactory: DateCellTimingRelativeIndexFactory<T>): DateCellTimingRelativeIndexArrayFactory<T> {
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
export function getRelativeIndexForDateCellTiming(timing: DateCellTimingStart, date: DateOrDateCellIndex = new Date()): DateCellIndex {
  return dateCellTimingRelativeIndexFactory(timing)(date);
}

export interface GetNextDateCellTimingIndexInput<T extends DateCellRange> {
  /**
   * Relevant index for now.
   */
  readonly currentIndex: DateCellIndex;
  /**
   * All possible ranges to pick from.
   */
  readonly ranges: ArrayOrValue<T>;
}

export interface GetNextDateCellTimingIndexResult<T extends DateCellRange> {
  /**
   * The item that matches the current index first out of the options.
   */
  readonly currentResult: Maybe<T>;
  /**
   * The next picked index, if available.
   */
  readonly nextIndex: Maybe<DateCellIndex>;
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
 * Computes a GetNextDateCellTimingIndexResult from the input.
 *
 * @param input
 */
export function getNextDateCellTimingIndex<T extends DateCellRange>(input: GetNextDateCellTimingIndexInput<T>): GetNextDateCellTimingIndexResult<T> {
  const { ranges, currentIndex } = input;

  const relativeStateGroups = makeValuesGroupMap(asArray(ranges), (range) => {
    return dateRelativeStateForDateCellRangeComparedToIndex(range, currentIndex);
  });

  const pastResults = relativeStateGroups.get('past') ?? [];
  const presentResults = relativeStateGroups.get('present') ?? [];
  const futureResults = relativeStateGroups.get('future') ?? [];

  const currentResult = presentResults[0];

  let nextResult: Maybe<T>;
  let nextIndex: Maybe<number> = currentIndex + 1;

  const nextResultFromPresent = presentResults.find((x) => dateRelativeStateForDateCellRangeComparedToIndex(x, nextIndex as number) === 'present');

  if (nextResultFromPresent) {
    nextResult = nextResultFromPresent;
  } else {
    // search through the future indexes, looking for the one with the lowest index.
    const greatestAndLeastIndexResult = getLeastAndGreatestDateCellIndexInDateCellRanges(futureResults);

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
export function dateRelativeStateForDateCellRangeComparedToIndex(range: DateCellRange, nowIndex: DateCellIndex): DateRelativeState {
  const { i, to } = dateCellRange(range.i, range.to);
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
 * Similar to the DateCellTimingRelativeIndexFactory, but returns a date instead of an index for the input.
 *
 * If an index is input, returns a date with the hours and minutes for now for the given date returned.
 */
export type DateCellTimingDateFactory<T extends DateCellTimingStart = DateCellTimingStart> = ((input: DateOrDateCellIndex) => Date) & {
  readonly _timing: T;
};

/**
 * Creates a DateCellTimingDateFactory.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingDateFactory<T extends DateCellTimingStart = DateCellTimingStart>(timing: T): DateCellTimingDateFactory<T> {
  const offsetData = getCurrentDateCellTimingOffsetData(timing);
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
export type DateCellTimingStartDateFactory<T extends DateCellTimingStart = DateCellTimingStart> = ((input: DateOrDateCellIndex) => Date) & {
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
export function dateCellTimingStartDateFactory<T extends DateCellTimingStart = DateCellTimingStart>(input: T | DateCellTimingRelativeIndexFactory<T>, timezone: TimezoneString | DateTimezoneConversionConfigUseSystemTimezone | DateCellTimingUseSystemAndIgnoreEnforcement | DateTimezoneUtcNormalInstance): DateCellTimingStartDateFactory<T> {
  const indexFactory = dateCellTimingRelativeIndexFactory<T>(input);
  const timezoneInstance = timingDateTimezoneUtcNormal(timezone);

  if ((timezoneInstance.config as DateCellTimingUseSystemAndIgnoreEnforcement).assertTimingMatchesTimezone !== false && !timingIsInExpectedTimezone(indexFactory._timing, timezoneInstance)) {
    throw new Error(`unexpected timezone "${timezone}" for start date "${indexFactory._timing.start}" for dateCellTimingStartDateFactory(). Is expected to match the timezones.`);
  }

  const { start: baseTimingStart } = indexFactory._timing;
  const baseStart = timezoneInstance.baseDateToTargetDate(baseTimingStart);

  const factory = ((input: DateOrDateCellIndex) => {
    const index = indexFactory(input); // get the index
    const startInUtc = addHours(baseStart, index * HOURS_IN_DAY);
    return timezoneInstance.targetDateToBaseDate(startInUtc);
  }) as Configurable<Partial<DateCellTimingStartDateFactory>>;
  factory._indexFactory = indexFactory;
  return factory as DateCellTimingStartDateFactory<T>;
}

/**
 * Returns the startsAt time of the input date or index.
 */
export type DateCellTimingStartsAtDateFactory<T extends DateCellTimingStart = DateCellTimingStart> = ((input: DateOrDateCellIndex) => Date) & {
  readonly _indexFactory: DateCellTimingRelativeIndexFactory<T>;
};

/**
 * Creates a DateCellTimingStartsAtDateFactory.
 *
 * @param timing
 * @returns
 */
export function dateCellTimingStartsAtDateFactory<T extends DateCellTimingStartAndStartsAt = DateCellTimingStartAndStartsAt>(input: T | DateCellTimingRelativeIndexFactory<T>, timezone: TimezoneString | DateTimezoneConversionConfigUseSystemTimezone | DateCellTimingUseSystemAndIgnoreEnforcement | DateTimezoneUtcNormalInstance): DateCellTimingStartsAtDateFactory<T>;
/**
 * @deprecated Timezone required to properly handle daylight savings times.
 *
 * @param input
 * @param timezone
 */
export function dateCellTimingStartsAtDateFactory<T extends DateCellTimingStartAndStartsAt = DateCellTimingStartAndStartsAt>(input: T | DateCellTimingRelativeIndexFactory<T>, timezone?: TimezoneString | DateTimezoneConversionConfigUseSystemTimezone | DateCellTimingUseSystemAndIgnoreEnforcement | DateTimezoneUtcNormalInstance): DateCellTimingStartsAtDateFactory<T>;
export function dateCellTimingStartsAtDateFactory<T extends DateCellTimingStartAndStartsAt = DateCellTimingStartAndStartsAt>(input: T | DateCellTimingRelativeIndexFactory<T>, timezone?: TimezoneString | DateTimezoneConversionConfigUseSystemTimezone | DateCellTimingUseSystemAndIgnoreEnforcement | DateTimezoneUtcNormalInstance): DateCellTimingStartsAtDateFactory<T> {
  const indexFactory = dateCellTimingRelativeIndexFactory<T>(input);
  const { start, startsAt: baseTimingStartsAt } = indexFactory._timing;
  const timezoneInstance = timingDateTimezoneUtcNormal(timezone ?? { start });

  if ((timezoneInstance.config as DateCellTimingUseSystemAndIgnoreEnforcement).assertTimingMatchesTimezone !== false && !timingIsInExpectedTimezone(indexFactory._timing, timezoneInstance)) {
    throw new Error(`unexpected timezone "${timezone}" for start date "${indexFactory._timing.start}" for dateCellTimingStartsAtDateFactory(). Is expected to match the timezones.`);
  }

  const baseStartsAtInUtc = timezoneInstance.baseDateToTargetDate(baseTimingStartsAt);

  const factory = ((input: DateOrDateCellIndex) => {
    const index = indexFactory(input); // get the index
    const startAtInUtc = addHours(baseStartsAtInUtc, index * HOURS_IN_DAY);
    return timezoneInstance.targetDateToBaseDate(startAtInUtc);
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
export function getRelativeDateForDateCellTiming(timing: DateCellTimingStart, input: DateOrDateCellIndex): Date {
  return dateCellTimingDateFactory(timing)(input);
}

/**
 * The DateRange input for dateCellTiming()
 */
export type DateCellTimingRangeInput = Pick<DateRangeDayDistanceInput, 'distance'> | DateRange | number;

export interface DateCellTimingOptions {
  /**
   * Timezone to evaluate the startsAt time in.
   *
   * Will convert the input startsAt time to a normal in the given timezone, then converts it back to the system timezone.
   */
  timezone?: DateTimezoneUtcNormalFunctionInput;
}

/**
 * Creates a valid DateCell timing from the DateDurationSpan and range input.
 *
 * The duration is first considered, then the date range is applied to it.
 *
 * If a number is passed as the input range, then the duration's startsAt date will be used and the input number used as the distance.
 * The input range's date takes priority over the duration's startsAt start date, meaning the input date range will be adapted
 * to fit the startsAt time.
 *
 * The input range date is used as the start and end date ranges, meaning they will be used as the expected date offset (have only hours, no minutes/seconds/milliseconds) and be validated as such.
 * The end date is used just to determine the number of days, but a minimum of 1 day is always enforced as a DateCellTiming must contain atleast 1 day.
 *
 * The start date from the inputDate is considered to to have the offset noted in DateCell, and will be retained.
 */
export function dateCellTiming(durationInput: DateDurationSpan, inputRange: DateCellTimingRangeInput, options?: DateCellTimingOptions): DateCellTiming {
  const { duration } = durationInput;
  const { timezone: timezoneInput } = options ?? {};
  const timezoneInstance = timezoneInput ? dateTimezoneUtcNormal(timezoneInput) : undefined;

  if (duration > MINUTES_IN_DAY) {
    throw new Error('dateCellTiming() duration cannot be longer than 24 hours.');
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

    if (!isValidDateCellTimingStartDate(inputRange.start)) {
      throw new Error('Invalid dateCellTiming start date passed to dateCellTiming() via inputRange.');
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
  let lastStart = addDays(startsAt, numberOfBlockedDays); // add days so the system can change for daylight savings

  if (timezoneInstance) {
    startsAt = timezoneInstance.targetDateToSystemDate(startsAt);
    lastStart = timezoneInstance.targetDateToSystemDate(lastStart); // may be affected by daylight savings
  }

  // calculate end to be the ending date/time of the final duration span
  const end: Date = addMinutes(lastStart, duration);

  return {
    start,
    end,
    startsAt,
    duration
  };
}

/**
 * Creates a DateCellTiming from the DateDurationSpan and range input with the start offset set in the pre-configured timezone.
 */
export type DateCellTimingInTimezoneFunction = ((durationInput: DateDurationSpan, inputRange: DateCellTimingRangeInput) => DateCellTiming) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
};

export function dateCellTimingInTimezoneFunction(input: TimingDateTimezoneUtcNormalInput): DateCellTimingInTimezoneFunction {
  const changeTimezoneFunction = changeTimingToTimezoneFunction(input);

  const fn = ((durationInput: DateDurationSpan, inputRange: DateCellTimingRangeInput) => {
    const timing = dateCellTiming(durationInput, inputRange, { timezone: changeTimezoneFunction._timezoneInstance });
    return changeTimezoneFunction(timing);
  }) as Building<DateCellTimingInTimezoneFunction>;

  fn._timezoneInstance = changeTimezoneFunction._timezoneInstance;
  return fn as DateCellTimingInTimezoneFunction;
}

export function dateCellTimingInTimezone(durationInput: DateDurationSpan, inputRange: DateCellTimingRangeInput, timezone: TimingDateTimezoneUtcNormalInput) {
  return dateCellTimingInTimezoneFunction(timezone)(durationInput, inputRange);
}

export interface IsValidDateCellTimingInfo {
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

export function isValidDateCellTimingInfo(timing: DateCellTiming) {
  const { end, start, startsAt, duration, timezone } = timing;

  const {
    currentTimezoneOffsetInHours: startOffsetInHours // offset as computed on the given date.
  } = getCurrentDateCellTimingOffsetData(timing);

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
  let isTimezoneValidatedEnd = false;

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
    const finalMsDifference = differenceInMilliseconds(startsAt, expectedFinalStartTime);
    const hoursDifference = Math.abs((finalMsDifference % MS_IN_DAY) / MS_IN_HOUR);
    const difference = hoursDifference === 23 ? -1 : hoursDifference; // depending on daylight savings, may be off by 1 hour

    isExpectedValidEnd = difference === 0;
    isPlausiblyValidEnd = isExpectedValidEnd || Math.abs(difference) === 1;
    isValid = isPlausiblyValidEnd;

    if (isPlausiblyValidEnd && timezone) {
      // TODO: validate properly for the timezone...
    }
  }

  const result = {
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

  return result;
}

/**
 *
 * @param timing
 * @returns
 */
export function isValidDateCellTiming(timing: DateCellTiming): boolean {
  const { isValid } = isValidDateCellTimingInfo(timing);
  return isValid;
}

/**
 * Converts the input index into the DayOfWeek that it represents.
 */
export type DateCellDayOfWeekFactory = MapFunction<DateCellIndex, DayOfWeek>;

/**
 * Creates a DateCellDayOfWeekFactory
 *
 * @param dayForIndexZero
 * @returns
 */
export function dateCellDayOfWeekFactory(inputDayForIndexZero: DayOfWeek | Date): DateCellDayOfWeekFactory {
  const dayForIndexZero = typeof inputDayForIndexZero === 'number' ? inputDayForIndexZero : (inputDayForIndexZero.getUTCDay() as DayOfWeek);
  return (index: DateCellIndex) => getNextDay(dayForIndexZero, index);
}

/**
 * Reference to a DateCellTiming
 */
export interface DateCellTimingRef {
  timing: DateCellTiming;
}

/**
 * An object that implements DateCellTimingRef and DateCellArrayRef
 */
export interface DateCellCollection<B extends DateCell = DateCell> extends DateCellTimingRef, DateCellArrayRef<B> {}

/**
 * An expanded DateCell that implements DateDurationSpan and contains the DateCell values.
 */
export type DateCellDurationSpan<B extends DateCell = DateCell> = DateDurationSpan & B;

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
        const startsAt = addDays(baseStart, block.i);
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
  const { start: zeroDate, end: endDate } = timing;

  let minIndex = 0;
  let maxIndex = differenceInDays(endDate, zeroDate) + 1;

  if (limit) {
    const { start, end } = dateCellTiming(timing, limit);
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
 * Returns blocks that are only in the given DateCellRange.
 *
 * @param blocks
 * @param range
 * @returns
 */
export function filterDateCellsInDateCellRange<T extends DateCell | DateCellRange>(blocks: T[], range: DateCellRangeWithRange): T[] {
  const dateCellIsWithinDateCellRange = isDateCellWithinDateCellRangeFunction(range);
  return blocks.filter(dateCellIsWithinDateCellRange);
}

export type IsDateCellWithinDateCellRangeInput = DateCellOrDateCellIndexOrDateCellRange;

/**
 * Function that returns true if the input range is equal or falls within the configured DateCellRange.
 */
export type IsDateCellWithinDateCellRangeFunction = (input: IsDateCellWithinDateCellRangeInput) => boolean;

export function isDateCellWithinDateCellRangeFunction(inputRange: IsDateCellWithinDateCellRangeInput): IsDateCellWithinDateCellRangeFunction {
  const range = dateCellRangeWithRange(inputRange);
  return (input: IsDateCellWithinDateCellRangeInput) => {
    if (typeof input === 'number') {
      input = { i: input };
    }

    if (input.i >= range.i) {
      const to = (input as DateCellRange).to ?? input.i;
      return to <= range.to;
    }

    return false;
  };
}

/**
 * Returns true if the first DateCell or DateCellRange contains the second input.
 *
 * @param range
 * @param isContainedWithin
 * @returns
 */
export function isDateCellWithinDateCellRange(range: IsDateCellWithinDateCellRangeInput, contains: IsDateCellWithinDateCellRangeInput) {
  return isDateCellWithinDateCellRangeFunction(range)(dateCellRangeWithRange(contains));
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
   * Optional date to make the indexes relative to when converting date values.
   *
   * If not provided, defaults to the index in the range if a date is provided, or throws an exception if a date range is input.
   */
  start?: Date;
  /**
   * Range to compare the input to.
   */
  range: IsDateWithinDateCellRangeInput;
}

export function isDateWithinDateCellRangeFunction(config: IsDateWithinDateCellRangeConfig): IsDateWithinDateCellRangeFunction {
  const { start: inputStart, range: inputRange } = config;
  let start: Date | undefined = inputStart;

  let dateRange: (DateRangeStart & Partial<DateRange>) | undefined;
  let rangeInput: DateCell | DateCellRange | undefined;

  if (typeof inputRange === 'number') {
    rangeInput = { i: inputRange };
  } else if (isDate(inputRange)) {
    dateRange = { start: inputRange };
  } else if (isDateRangeStart(inputRange)) {
    dateRange = inputRange;
  } else {
    rangeInput = inputRange as DateCell | DateCellRange;
  }

  if (start == null) {
    if (dateRange) {
      start = inputRange as Date;
    } else {
      throw new Error('Invalid isDateWithinDateCellRangeFunction() config. Start date could not be determined from input.');
    }
  }

  const indexFactory = dateCellTimingRelativeIndexFactory({ start });

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

// MARK: DateCellRange
/**
 * Represents a range of DateCell values.
 */
export interface DateCellRange extends DateCell {
  /**
   * Index this block ends at, inclusive. A block with i=0 and to=0 encompases only the block 0.
   *
   * If not provided, assumes this has no range and starts/ends at the same index, i.
   */
  to?: DateCellIndex;
}

export class DateCellRange extends DateCell {
  @Expose()
  @IsNumber()
  @IsOptional()
  @Min(0)
  to?: DateCellIndex;

  constructor(template?: DateCellRange) {
    super(template);
    if (template) {
      this.to = template.to;
    }
  }
}

/**
 * A DateCellIndex, DateCell, or DateCellRange
 */
export type DateCellOrDateCellIndexOrDateCellRange = DateCellIndex | DateCell | DateCellRange;

/**
 * Returns true if the input is a valid DateCellRange.
 *
 * @param input
 * @returns
 */
export function isValidDateCellRange(input: DateCellRange): boolean {
  const { i, to } = input;

  if (!isValidDateCellIndex(i)) {
    return false;
  } else if (to != null && (!isValidDateCellIndex(to) || to < i)) {
    return false;
  }

  return true;
}

/**
 * Returns true if the input is a sorted DateCellRange array and there are no repeat indexes.
 *
 * @param input
 * @returns
 */
export function isValidDateCellRangeSeries(input: DateCellRange[]): boolean {
  if (!Array.isArray(input)) {
    return false;
  }

  const invalidRange = input.findIndex((range) => !isValidDateCellRange(range));

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
export function getLeastDateCellIndexInDateCellRanges(input: (DateCell | DateCellRange)[]): DateCellIndex {
  return getLeastAndGreatestDateCellIndexInDateCellRanges(input)?.leastIndex ?? 0;
}

/**
 * Returns the largest index between all the input date block ranges. Returns 0 by default.
 *
 * The input range is not expected to be sorted.
 */
export function getGreatestDateCellIndexInDateCellRanges(input: (DateCell | DateCellRange)[]): DateCellIndex {
  return getLeastAndGreatestDateCellIndexInDateCellRanges(input)?.greatestIndex ?? 0;
}

export interface LeastAndGreatestDateCellIndexResult<T> {
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
export function getLeastAndGreatestDateCellIndexInDateCellRanges<T extends DateCellRange>(input: T[]): Maybe<LeastAndGreatestDateCellIndexResult<T>> {
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
    const greatestRangeIndex = (range as DateCellRange).to || range.i;

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
 * Input type used for cases where a DateRange or a DateCellRange are allowed as input but used the start/end parameters in DateRange.
 */
export interface DateCellRangeOrDateRange {
  start?: Maybe<DateOrDateCellIndex>;
  end?: Maybe<DateOrDateCellIndex>;
}

export type DateOrDateCellIndexOrDateCellRange = DateOrDateCellIndex | DateCellRange;
export type DateOrDateRangeOrDateCellIndexOrDateCellRange = DateRange | DateOrDateCellIndexOrDateCellRange;

/**
 * Creates a DateCellRange
 *
 * @param i
 * @param to
 * @returns
 */
export function dateCellRange(i: number, to?: number): DateCellRangeWithRange {
  return { i, to: to ?? i };
}

/**
 * Creates a DateCellRangeWithRange from the input DateCellIndex.
 *
 * @param dateCellIndex
 * @returns
 */
export function dateCellRangeWithRangeFromIndex(dateCellIndex: DateCellIndex): DateCellRangeWithRange {
  return dateCellRange(dateCellIndex, dateCellIndex);
}

/**
 * Creates a DateCellRangeWithRange from the input DateCellIndex, DateCell, or DateCellRange.
 *
 * @param input
 * @returns
 */
export function dateCellRangeWithRange(input: DateCellOrDateCellIndexOrDateCellRange): DateCellRangeWithRange {
  if (typeof input === 'number') {
    return dateCellRangeWithRangeFromIndex(input);
  } else {
    return dateCellRange(input.i, (input as DateCellRange).to);
  }
}

/**
 * Function that returns true if the input range covers the full range of the configured DateCellRange.
 */
export type DateCellRangeIncludedByRangeFunction = (range: DateCellOrDateCellIndexOrDateCellRange) => boolean;

/**
 * Creates a DateCellRangeIncludedByRangeFunction
 *
 * @param inputRange
 * @returns
 */
export function dateCellRangeIncludedByRangeFunction(inputRange: DateCellOrDateCellIndexOrDateCellRange): DateCellRangeIncludedByRangeFunction {
  const { i, to } = dateCellRangeWithRange(inputRange);
  return (input) => {
    const range = dateCellRangeWithRange(input);
    return range.i <= i && (range?.to ?? range.i) >= to;
  };
}

/**
 * Function that returns true if the input range overlaps the range of the configured DateCellRange.
 */
export type DateCellRangeOverlapsRangeFunction = (range: DateCellOrDateCellIndexOrDateCellRange) => boolean;

/**
 * Creates a DateCellRangeOverlapsRangeFunction
 *
 * @param inputRange
 * @returns
 */
export function dateCellRangeOverlapsRangeFunction(inputRange: DateCellOrDateCellIndexOrDateCellRange): DateCellRangeOverlapsRangeFunction {
  const { i, to } = dateCellRangeWithRange(inputRange);
  return (input) => {
    const range = dateCellRangeWithRange(input);
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
export function dateCellRangeOverlapsRange(rangeA: DateCellOrDateCellIndexOrDateCellRange, rangeB: DateCellOrDateCellIndexOrDateCellRange): boolean {
  return dateCellRangeOverlapsRangeFunction(rangeA)(rangeB);
}

/**
 * Sorts the input ranges by index and distance (to values).
 *
 * In many cases sortAscendingIndexNumberRefFunction may be preferential since
 *
 * @returns
 */
export function sortDateCellRangeAndSizeFunction<T extends DateCellRange>(): SortCompareFunction<T> {
  return (a, b) => a.i - b.i || (a.to ?? a.i) - (b.to ?? b.i);
}

/**
 * Sorts the input date ranges. This will retain the before/after order while also sorting items by index.
 *
 * @param input
 * @returns
 */
export function sortDateCellRanges<T extends DateCellRange>(input: T[]): T[] {
  return input.sort(sortAscendingIndexNumberRefFunction());
}

/**
 * DateCellRange that is known to have a to value.
 */
export type DateCellRangeWithRange = RequiredOnKeys<DateCellRange, 'to'>;

/**
 * Groups the input values into DateCellRange values.
 *
 * @param input
 */
export function groupToDateCellRanges(input: (DateCell | DateCellRange)[]): DateCellRangeWithRange[] {
  if (input.length === 0) {
    return [];
  }

  // sort by index in ascending order
  const blocks = sortDateCellRanges(input);

  function newBlockFromBlocksArrayIndex(blocksArrayIndex: number): DateCellRangeWithRange {
    const { i, to } = blocks[blocksArrayIndex] as DateCellRange;
    return {
      i,
      to: to ?? i
    };
  }

  // start at the first block
  let current: DateCellRangeWithRange = newBlockFromBlocksArrayIndex(0);

  const results: DateCellRangeWithRange[] = [];

  for (let i = 1; i < blocks.length; i += 1) {
    const block = blocks[i];
    const isContinuous = block.i <= current.to + 1;

    if (isContinuous) {
      // extend the current block.
      current.to = (blocks[i] as DateCellRange).to ?? blocks[i].i;
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
export function allIndexesInDateCellRange(input: DateCellRange): DateCellIndex[] {
  return input.to != null ? range((input as DateCellRange).i, input.to + 1) : [input.i];
}

/**
 * Returns the set of all indexes within the input.
 *
 * @param input
 * @returns
 */
export function allIndexesInDateCellRanges(input: (DateCellIndex | DateCellRange)[]): Set<DateCellIndex> {
  const set = new Set<DateCellIndex>();

  input.forEach((x) => {
    if (typeof x === 'number') {
      set.add(x);
    } else {
      const allIndexes = allIndexesInDateCellRange(x);
      addToSet(set, allIndexes);
    }
  });

  return set;
}

export interface DateCellRangeBlockCountInfo {
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
 * @param inputDateCellRange
 * @returns
 */
export function dateCellRangeBlocksCountInfo(inputDateCellRange: ArrayOrValue<DateCell | DateCellRange>): DateCellRangeBlockCountInfo {
  const group = groupToDateCellRanges(asArray(inputDateCellRange));

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
 * @param inputDateCellRange
 * @returns
 */
export function dateCellRangeBlocksCount(inputDateCellRange: ArrayOrValue<DateCell | DateCellRange>): number {
  return dateCellRangeBlocksCountInfo(inputDateCellRange).count;
}

/**
 * Checks whether or not the input range is fully included by the configured ranges.
 */
export type DateCellRangesFullyCoverDateCellRangeFunction = (range: DateCellRange) => boolean;

/**
 * Creates a dateCellRangesFullyCoverDateCellRangeFunction
 *
 * @param ranges
 * @returns
 */
export function dateCellRangesFullyCoverDateCellRangeFunction(ranges: ArrayOrValue<DateCellRange>): DateCellRangesFullyCoverDateCellRangeFunction {
  const groupedRanges = Array.isArray(ranges) ? groupToDateCellRanges(ranges) : [dateCellRangeWithRange(ranges)];

  return (inputRange: DateCellRange) => {
    const fn = dateCellRangeIncludedByRangeFunction(inputRange);
    return groupedRanges.findIndex(fn) !== -1;
  };
}

/**
 * Expands a DateCellRange into an array of DateCell values.
 *
 * @param block
 * @returns
 */
export function expandDateCellRange<B extends DateCellRange | DateCellRangeWithRange>(block: B): B[] {
  return range(block.i, dateCellEndIndex(block) + 1).map((i) => {
    return { ...block, i, to: i }; // copy block, set to as i
  });
}

/**
 * A DateCell that also has the potential for a unique identifier.
 */
export interface UniqueDateCell extends DateCell, UniqueModel {}

/**
 * Represents a range of UniqueDateCell values keyed by a similar identifier (or lack of identifier).
 */
export interface UniqueDateCellRange extends UniqueDateCell, DateCellRange {}

/**
 * Returns true if the input DateCellRange is longer than 1 block (I.E. has a "to" value greater than it's "i" value).
 *
 * @param input
 */
export function dateCellRangeHasRange(input: DateCellRange | UniqueDateCell): input is DateCellRangeWithRange {
  return (input as DateCellRange).to != null && ((input as DateCellRange).to as number) > input.i;
}

/**
 * Reads the to index if it exists, or returns the block's index itself.
 *
 * @param input
 * @returns
 */
export function dateCellEndIndex(input: DateCellRange | UniqueDateCell): IndexNumber {
  return (input as DateCellRange).to ?? input.i;
}

/**
 * A grouping of UniqueDateCell values, sorted by date range.
 */
export interface UniqueDateCellRangeGroup<B extends DateCellRange | UniqueDateCell> extends DateCellRange {
  /**
   * Blocks are sorted by index.
   */
  blocks: B[];
}

/**
 * Groups all input DateCellRange or UniqueDateCell values into a UniqueDateCellRangeGroup value amd sorts the input.
 */
export function groupUniqueDateCells<B extends DateCellRange | UniqueDateCell>(input: B[]): UniqueDateCellRangeGroup<B> {
  const blocks = sortDateCellRanges([...input]);

  const i = 0;
  let to: number;

  if (blocks.length === 0) {
    to = i;
  } else {
    const lastBlock = lastValue(blocks);
    to = (lastBlock as DateCellRange).to ?? lastBlock.i;
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
export type ExpandUniqueDateCellsFillOption = 'extend' | 'fill';

/**
 * Determines how overwrite block values that are completely overlapping eachother.
 * - current: keeps the "current" value
 * - next: the next/new value overwrites the previous one
 */
export type ExpandUniqueDateCellsRetainOverlapOption = 'current' | 'next';

export interface ExpandUniqueDateCellsConfig<B extends DateCellRange | UniqueDateCell> {
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
  fillOption: ExpandUniqueDateCellsFillOption;
  /**
   * (Optional) Determines how to handle overwrites.
   *
   * - next: will retain the latest value (next) and overwrite the current value.
   * - current: will retain the current value and ignore any future values at that index.
   *
   * Defaults to next
   */
  retainOnOverlap?: ExpandUniqueDateCellsRetainOverlapOption;
  /**
   * Used to create new items to fill empty block sets. Required when mode is set to "fill".
   */
  fillFactory?: FactoryWithRequiredInput<B, DateCellRangeWithRange>;
}

export interface ExpandUniqueDateCellsResult<B extends DateCellRange | UniqueDateCell> extends UniqueDateCellRangeGroup<B> {
  /**
   * Blocks that were competely removed. Some blocks stay partially retained.
   */
  discarded: B[];
}

/**
 * Expansion function used to sort/merge/replace DateCellRange values by block.
 *
 * Can optionally specify a second array/group of blocks that are treated as "next" blocks which can take priority or not depending on the retain options.
 */
export type ExpandUniqueDateCellsFunction<B extends DateCellRange | UniqueDateCell> = (input: B[] | UniqueDateCellRangeGroup<B>, newBlocks?: B[] | UniqueDateCellRangeGroup<B>) => ExpandUniqueDateCellsResult<B>;

type DateCellRangePriority = ExpandUniqueDateCellsRetainOverlapOption;

type DateCellRangePriorityPair<B extends DateCellRange | UniqueDateCell> = {
  priority: DateCellRangePriority;
  block: B;
};

export function expandUniqueDateCellsFunction<B extends DateCellRange | UniqueDateCell>(config: ExpandUniqueDateCellsConfig<B>): ExpandUniqueDateCellsFunction<B> {
  const { startAtIndex = 0, endAtIndex, fillOption: fill, fillFactory: inputFillFactory, retainOnOverlap: inputRetainOnOverlap } = config;
  const retainOnOverlap = inputRetainOnOverlap ?? 'next';
  const maxAllowedIndex: IndexNumber = endAtIndex ?? Number.MAX_SAFE_INTEGER;
  const fillFactory = inputFillFactory as FactoryWithRequiredInput<B, DateCellRange>;

  if (!fillFactory && fill === 'fill') {
    throw new Error('fillFactory is required when fillOption is "fill".');
  }

  return (input: B[] | UniqueDateCellRangeGroup<B>, newBlocks?: B[] | UniqueDateCellRangeGroup<B>) => {
    const inputGroup = Array.isArray(input) ? groupUniqueDateCells(input) : input;
    const sorted: DateCellRangePriorityPair<B>[] = inputGroup.blocks.map((block) => ({ priority: 'current', block }));

    if (newBlocks != null) {
      const inputOverwriteGroup = Array.isArray(newBlocks) ? groupUniqueDateCells(newBlocks) : newBlocks;
      mergeArrayIntoArray(
        sorted,
        inputOverwriteGroup.blocks.map((block) => ({ priority: 'next', block }))
      ).sort((a, b) => a.block.i - b.block.i);
    }

    const blocks: B[] = [];
    const discarded: B[] = [];

    let current: DateCellRangePriorityPair<B> = sorted[0];
    let currentNextIndex: IndexNumber;

    let next: DateCellRangePriorityPair<B> = sorted[1];
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
        const dateCellRange: DateCellRangeWithRange = {
          i,
          to
        };

        const block: B = fillFactory(dateCellRange);
        addBlockWithRange(block, i, to ?? i);
      } else if (blocks.length > 0) {
        // do not extend if no blocks have been pushed.
        const blockToExtend = lastValue(blocks);
        (blockToExtend as DateCellRange).to = inputTo;
      }

      latestTo = to;
    }

    function continueToNext(use?: B, priority?: DateCellRangePriority) {
      i += 1;
      current = use != null ? ({ block: use, priority } as DateCellRangePriorityPair<B>) : sorted[i];
      next = sorted[i + 1];

      if (next) {
        nextStartIndex = next.block.i;

        // complete loop once past the max allowed index
        if (nextStartIndex > maxAllowedIndex) {
          continueLoop = false;
        } else {
          const nextEndIndex = dateCellEndIndex(next.block);

          if (nextEndIndex <= latestTo) {
            discardCurrent(); // skip until next is not less than or equal to the latest to
            continueToNext();
          }
        }
      } else {
        continueLoop = false;
      }
    }

    function discard(pair: DateCellRangePriorityPair<B>) {
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

      const currentEndIndex = dateCellEndIndex(current.block);
      const nextEndIndex = dateCellEndIndex(next.block);

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
      const lastEndIndex = dateCellEndIndex(current.block);

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
export type ModifyDateCellsToFitRangeFunction = <B extends DateCell | DateCellRange | UniqueDateCell>(input: B[]) => B[];

/**
 * Creatse a ModifyDateCellsToFitRangeFunction
 */
export function modifyDateCellsToFitRangeFunction(range: DateCellRange): ModifyDateCellsToFitRangeFunction {
  const { i, to } = dateCellRangeWithRange(range);
  const dateCellIsWithinDateCellRange = isDateCellWithinDateCellRangeFunction(range);
  const overlapsRange = dateCellRangeOverlapsRangeFunction(range);

  return <B extends DateCell | DateCellRange | UniqueDateCell>(input: B[]) =>
    filterMaybeValues(
      input.map((x) => {
        let result: Maybe<B>;

        const inRange = dateCellIsWithinDateCellRange(x);

        if (inRange) {
          // if contained within the range then return as-is
          result = x;
        } else {
          // fit to the range otherwise
          const asRange = dateCellRangeWithRange(x);
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

export function modifyDateCellsToFitRange<B extends DateCell | DateCellRange | UniqueDateCell>(range: DateCellRange, input: B[]): B[] {
  return modifyDateCellsToFitRangeFunction(range)(input);
}

export function modifyDateCellToFitRange<B extends DateCell | DateCellRange | UniqueDateCell>(range: DateCellRange, input: B): Maybe<B> {
  return modifyDateCellsToFitRange(range, [input])[0];
}

// MARK: Compat
/**
 * @deprecated use dateCellsInDateCellRange instead.
 */
export const dateCellsInDateCellRange = filterDateCellsInDateCellRange;

/**
 * @deprecated use IsDateCellWithinDateCellRangeFunction instead.
 */
export type DateCellIsWithinDateCellRangeFunction = IsDateCellWithinDateCellRangeFunction;

/**
 * @deprecated use isDateCellWithinDateCellRangeFunction() instead.
 */
export const dateCellIsWithinDateCellRangeFunction = isDateCellWithinDateCellRangeFunction;

/**
 * @deprecated use isDateCellWithinDateCellRange() instead.
 */
export const dateCellRangeContainsDateCell = isDateCellWithinDateCellRange;

/**
 * @deprecated use DateCellDayTimingInfoFactory instead.
 */
export type DateCellDayInfoFactory = DateCellDayTimingInfoFactory;

/**
 * @deprecated use dateCellsDayTimingInfoFactory instead.
 */
export const dateCellsDayInfoFactory = dateCellDayTimingInfoFactory;

/**
 * @deprecated use DateCellTimingRelativeIndexFactoryInput instead.
 */
export type DateTimingRelativeIndexFactoryInput = DateCellTimingRelativeIndexFactoryInput;

/**
 * @deprecated use DateCellTimingRelativeIndexFactoryInput instead.
 */
export type DateTimingRelativeIndexFactory<T extends DateCellTimingStart = DateCellTimingStart> = DateCellTimingRelativeIndexFactory<T>;

/**
 * @deprecated use isDateCellTimingRelativeIndexFactory instead.
 */
export const isDateTimingRelativeIndexFactory = isDateCellTimingRelativeIndexFactory;

/**
 * @deprecated use dateCellTimingRelativeIndexFactory instead.
 */
export const dateTimingRelativeIndexFactory = dateCellTimingRelativeIndexFactory;

/**
 * @deprecated use DateCellTimingRelativeIndexArrayFactory instead.
 */
export type DateTimingRelativeIndexArrayFactory<T extends DateCellTimingStart = DateCellTimingStart> = DateCellTimingRelativeIndexArrayFactory<T>;

/**
 * @deprecated use dateCellTimingRelativeIndexArrayFactory instead.
 */
export const dateTimingRelativeIndexArrayFactory = dateCellTimingRelativeIndexArrayFactory;

/**
 * @deprecated use getRelativeIndexForDateCellTiming instead.
 */
export const getRelativeIndexForDateTiming = getRelativeIndexForDateCellTiming;
