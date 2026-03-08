import { type DateRange } from '@dereekb/date';
import {
  type StringOrder,
  type Maybe,
  pushArrayItemsIntoArray,
  firstValueFromIterable,
  type DayOfWeek,
  addToSet,
  range,
  type DecisionFunction,
  type FilterFunction,
  type IndexRange,
  invertFilter,
  enabledDaysFromDaysOfWeek,
  type EnabledDays,
  daysOfWeekFromEnabledDays,
  iterablesAreSetEquivalent,
  type ArrayOrValue,
  forEachInIterable,
  mergeFilterFunctions,
  type TimezoneString,
  type TimezoneStringRef,
  type Building,
  sortNumbersAscendingFunction,
  type Days,
  type DateRelativeDirection
} from '@dereekb/util';
import { Expose } from 'class-transformer';
import { IsString, Matches, IsOptional, Min, IsArray } from 'class-validator';
import { getDay, addMinutes } from 'date-fns';
import { isDate, requireCurrentTimezone } from './date';
import { calculateExpectedDateCellTimingDurationPair, type DateCell, type DateCellDurationSpan, type DateCellIndex, type DateCellTiming, type DateCellTimingDateRange, type DateCellTimingStartsAtEndRange, type FullDateCellTiming, isSameFullDateCellTiming, type DateCellTimingEventStartsAt, isFullDateCellTiming, type DateCellTimingTimezoneInput, dateCellTimingTimezoneNormalInstance, type DateCellIndexDatePair } from './date.cell';
import { type DateCellTimingRelativeIndexFactoryInput, dateCellTimingRelativeIndexFactory, type DateCellTimingExpansionFactory, dateCellTimingExpansionFactory, dateCellIndexRange, updateDateCellTimingWithDateCellTimingEvent, dateCellTimingStartsAtDateFactory, type DateCellTimingRelativeIndexFactory, dateCellTimingDateFactory } from './date.cell.factory';
import { dateCellDurationSpanHasNotStartedFilterFunction, dateCellDurationSpanHasNotEndedFilterFunction, dateCellDurationSpanHasEndedFilterFunction, dateCellDurationSpanHasStartedFilterFunction } from './date.cell.filter';
import { type DateCellRangeOrDateRange, type DateCellRange, type DateCellRangeWithRange, groupToDateCellRanges } from './date.cell.index';
import { dateCellDayOfWeekFactory } from './date.cell.week';
import { formatToISO8601DayStringForUTC } from './date.format';
import { isSameDateRange } from './date.range';
import { dateTimezoneUtcNormal, type DateTimezoneUtcNormalInstance } from './date.timezone';
import { type YearWeekCodeConfig, yearWeekCodeDateTimezoneInstance } from './date.week';

/**
 * Encodes days of the week as numeric codes for use in schedule filtering.
 *
 * Values 1-7 map to individual days (offset by +1 from DayOfWeek), while
 * 8 and 9 serve as shorthand for all weekdays or weekend days respectively.
 */
export enum DateCellScheduleDayCode {
  /**
   * Special no-op/unused code
   */
  NONE = 0,
  SUNDAY = 1, // Day.SUNDAY + 1
  MONDAY = 2,
  TUESDAY = 3,
  WEDNESDAY = 4,
  THURSDAY = 5,
  FRIDAY = 6,
  SATURDAY = 7,
  /**
   * All weekdays (Mon-Fri)
   */
  WEEKDAY = 8,
  /**
   * All weekend days (Sat/Sun)
   */
  WEEKEND = 9
}

/**
 * Returns day codes representing all seven days of the week using the WEEKDAY and WEEKEND shorthand codes.
 *
 * @returns array containing WEEKDAY and WEEKEND codes
 */
export function fullWeekDateCellScheduleDayCodes() {
  return [DateCellScheduleDayCode.WEEKDAY, DateCellScheduleDayCode.WEEKEND];
}

/**
 * Returns individual day codes for Monday through Friday.
 *
 * @returns array of five weekday codes
 */
export function weekdayDateCellScheduleDayCodes() {
  return [DateCellScheduleDayCode.MONDAY, DateCellScheduleDayCode.TUESDAY, DateCellScheduleDayCode.WEDNESDAY, DateCellScheduleDayCode.THURSDAY, DateCellScheduleDayCode.FRIDAY];
}

/**
 * Returns individual day codes for Saturday and Sunday.
 *
 * @returns array of two weekend codes
 */
export function weekendDateCellScheduleDayCodes() {
  return [DateCellScheduleDayCode.SATURDAY, DateCellScheduleDayCode.SUNDAY];
}

/**
 * Creates an EnabledDays from the input by expanding schedule day codes to their corresponding days of the week.
 *
 * @param input - schedule day codes to convert (WEEKDAY/WEEKEND shorthand codes are expanded)
 * @returns an EnabledDays object with boolean flags for each day
 */
export function enabledDaysFromDateCellScheduleDayCodes(input: Maybe<Iterable<DateCellScheduleDayCode>>): EnabledDays {
  const days = expandDateCellScheduleDayCodesToDayOfWeekSet(Array.from(new Set(input)));
  return enabledDaysFromDaysOfWeek(days);
}

/**
 * Creates an array of simplified DateCellScheduleDayCode values from the input EnabledDays, using shorthand codes (WEEKDAY/WEEKEND) where possible.
 *
 * @param input - enabled days to convert back to schedule day codes
 * @returns simplified array of day codes
 */
export function dateCellScheduleDayCodesFromEnabledDays(input: Maybe<EnabledDays>): DateCellScheduleDayCode[] {
  const days = daysOfWeekFromEnabledDays(input);
  const scheduleDayCodes = days.map((x) => x + 1);
  return simplifyDateCellScheduleDayCodes(scheduleDayCodes);
}

/**
 * Encoded days of the week that the job block schedule should contain.
 */
export type DateCellScheduleEncodedWeek = '' | StringOrder<`${DateCellScheduleDayCode}`, ''>;

export const DATE_CELL_SCHEDULE_ENCODED_WEEK_REGEX = /^[0-9]{0,9}$/;

/**
 * Returns true if the input is a DateCellScheduleEncodedWeek.
 *
 * @param input - string to validate against the encoded week regex
 * @returns whether the string matches the encoded week format
 */
export function isDateCellScheduleEncodedWeek(input: string): input is DateCellScheduleEncodedWeek {
  return DATE_CELL_SCHEDULE_ENCODED_WEEK_REGEX.test(input);
}

/**
 * Returns true if the input string represents an empty DateCellScheduleEncodedWeek (no days selected).
 *
 * @param input - string to check for emptiness
 * @returns whether the encoded week represents no selected days
 */
export function isEmptyDateCellScheduleEncodedWeek(input: string): input is DateCellScheduleEncodedWeek {
  return input === '' || input === '0';
}

/**
 * Creates a DateCellScheduleEncodedWeek from an array of DateCellScheduleDayCode values.
 *
 * The returned encoded week is simplified so redundant individual day codes are replaced with shorthand (e.g., Mon-Fri becomes WEEKDAY).
 *
 * @param codes - day codes to encode into the compact string representation
 * @returns the encoded week string
 *
 * @example
 * ```ts
 * // Encode weekdays only
 * dateCellScheduleEncodedWeek([DateCellScheduleDayCode.MONDAY, DateCellScheduleDayCode.TUESDAY, DateCellScheduleDayCode.WEDNESDAY, DateCellScheduleDayCode.THURSDAY, DateCellScheduleDayCode.FRIDAY]);
 * // Returns '8' (WEEKDAY shorthand)
 *
 * // Encode specific days
 * dateCellScheduleEncodedWeek([DateCellScheduleDayCode.MONDAY, DateCellScheduleDayCode.WEDNESDAY]);
 * // Returns '24'
 * ```
 */
export function dateCellScheduleEncodedWeek(codes: Iterable<DateCellScheduleDayCode>): DateCellScheduleEncodedWeek {
  const result = simplifyDateCellScheduleDayCodes(codes);
  return result.join('') as DateCellScheduleEncodedWeek;
}

/**
 * Reduces/merges any day codes into more simplified day codes.
 *
 * For instance, if all five weekdays are selected, they will be reduced to WEEKDAY (8).
 * Similarly, Saturday + Sunday becomes WEEKEND (9).
 *
 * @param codes - day codes to simplify
 * @returns simplified array with shorthand codes where applicable
 *
 * @example
 * ```ts
 * // All weekdays collapse to WEEKDAY
 * simplifyDateCellScheduleDayCodes([2, 3, 4, 5, 6]);
 * // Returns [DateCellScheduleDayCode.WEEKDAY]  // [8]
 *
 * // Saturday + Sunday collapses to WEEKEND
 * simplifyDateCellScheduleDayCodes([1, 7]);
 * // Returns [DateCellScheduleDayCode.WEEKEND]  // [9]
 *
 * // Mixed: partial weekdays remain individual
 * simplifyDateCellScheduleDayCodes([2, 4]);
 * // Returns [DateCellScheduleDayCode.MONDAY, DateCellScheduleDayCode.WEDNESDAY]  // [2, 4]
 * ```
 */
export function simplifyDateCellScheduleDayCodes(codes: Iterable<DateCellScheduleDayCode>): DateCellScheduleDayCode[] {
  const codesSet = new Set(codes);
  const result: DateCellScheduleDayCode[] = [];

  if (codesSet.size >= 2) {
    let weekDays: Maybe<DateCellScheduleDayCode[]>;
    let hasAllWeekDays: boolean = codesSet.has(DateCellScheduleDayCode.WEEKDAY);

    if (!hasAllWeekDays) {
      weekDays = range(DateCellScheduleDayCode.MONDAY, DateCellScheduleDayCode.SATURDAY).filter((code) => codesSet.has(code));
      hasAllWeekDays = weekDays.length === 5;
    }

    const hasSaturday = codesSet.has(DateCellScheduleDayCode.SATURDAY);
    const hasSunday = codesSet.has(DateCellScheduleDayCode.SUNDAY);
    const hasAllWeekendDays: boolean = codesSet.has(DateCellScheduleDayCode.WEEKEND) || (hasSaturday && hasSunday);

    if (!hasAllWeekendDays && hasSunday) {
      result.push(DateCellScheduleDayCode.SUNDAY);
    }

    if (!hasAllWeekDays) {
      pushArrayItemsIntoArray(result, weekDays as DateCellScheduleDayCode[]);
    }

    if (!hasAllWeekendDays && hasSaturday) {
      result.push(DateCellScheduleDayCode.SATURDAY);
    }

    if (hasAllWeekDays) {
      result.push(DateCellScheduleDayCode.WEEKDAY);
    }

    if (hasAllWeekendDays) {
      result.push(DateCellScheduleDayCode.WEEKEND);
    }
  } else {
    const only = firstValueFromIterable(codesSet);

    if (only) {
      result.push(only);
    }
  }

  return result;
}

/**
 * Flexible input type for day codes: accepts an encoded week string, a single code, an array, or a Set.
 */
export type DateCellScheduleDayCodesInput = DateCellScheduleEncodedWeek | ArrayOrValue<DateCellScheduleDayCode> | Set<DateCellScheduleDayCode>;

/**
 * Expands the input DateCellScheduleDayCodesInput to a Set of DayOfWeek values, converting from the +1 offset used by schedule day codes back to standard DayOfWeek.
 *
 * @param input - day codes to expand (shorthand codes like WEEKDAY are expanded to individual days)
 * @returns set of DayOfWeek values
 */
export function expandDateCellScheduleDayCodesToDayOfWeekSet(input: DateCellScheduleDayCodesInput): Set<DayOfWeek> {
  const days = new Set<DayOfWeek>();
  const dayCodesSet = expandDateCellScheduleDayCodesToDayCodesSet(input);

  forEachInIterable(dayCodesSet, (code) => {
    days.add((code - 1) as DayOfWeek);
  });

  return days;
}

/**
 * Converts DayOfWeek values to their corresponding DateCellScheduleDayCode values (offset by +1).
 *
 * @param input - days of the week to convert
 * @returns set of individual schedule day codes (no shorthand grouping applied)
 */
export function dateCellScheduleDayCodesSetFromDaysOfWeek(input: Iterable<DayOfWeek>): Set<DateCellScheduleDayCode> {
  const codes = new Set<DateCellScheduleDayCode>();

  forEachInIterable(input, (code) => {
    codes.add((code + 1) as DateCellScheduleDayCode);
  });

  return codes;
}

/**
 * Expands the input into a sorted array of individual DateCellScheduleDayCode values.
 *
 * Shorthand codes (WEEKDAY, WEEKEND) are expanded to their constituent day codes, sorted ascending.
 *
 * @param input - day codes to expand
 * @returns sorted array of individual day codes (1-7 only, no shorthand)
 */
export function expandDateCellScheduleDayCodes(input: DateCellScheduleDayCodesInput): DateCellScheduleDayCode[] {
  return Array.from(expandDateCellScheduleDayCodesToDayCodesSet(input)).sort(sortNumbersAscendingFunction);
}

/**
 * Expands the input DateCellScheduleDayCodesInput to a Set of individual DateCellScheduleDayCode values (1-7), expanding shorthand codes like WEEKDAY and WEEKEND.
 *
 * @param input - day codes to expand into a set
 * @returns set of individual day codes with shorthand codes resolved
 */
export function expandDateCellScheduleDayCodesToDayCodesSet(input: DateCellScheduleDayCodesInput): Set<DateCellScheduleDayCode> {
  const codes: DateCellScheduleDayCode[] = rawDateCellScheduleDayCodes(input);
  const days = new Set<DateCellScheduleDayCode>();

  codes.forEach((code) => {
    switch (code) {
      case 0:
        // do nothing
        break;
      case 8:
        addToSet(days, weekdayDateCellScheduleDayCodes()); // monday-friday
        break;
      case 9:
        addToSet(days, weekendDateCellScheduleDayCodes());
        break;
      default: // remove offset
        days.add(code);
        break;
    }
  });

  return days;
}

/**
 * Converts the input to an array of DateCellScheduleDayCode values without expanding shorthand codes (WEEKDAY/WEEKEND remain as-is).
 *
 * Filters out the NONE (0) code.
 *
 * @param input - day codes input in any supported format
 * @returns raw array of day codes with NONE values removed
 */
export function rawDateCellScheduleDayCodes(input: DateCellScheduleDayCodesInput): DateCellScheduleDayCode[] {
  let dayCodes: DateCellScheduleDayCode[];

  switch (typeof input) {
    case 'string':
      dayCodes = Array.from(new Set(input)).map((x) => Number(x)) as DateCellScheduleDayCode[];
      break;
    case 'number':
      dayCodes = [input];
      break;
    default:
      dayCodes = Array.from(input);
      break;
  }

  return dayCodes.filter((x) => Boolean(x)); // filter out "none" code
}

/**
 * Used to convert the input dates into a DateCellScheduleDayCode.
 */
export type DateCellScheduleDayCodeFactory = (date: Date) => DateCellScheduleDayCode;

/**
 * Configuration for creating a DateCellScheduleDayCodeFactory, specifying the timezone context.
 */
export type DateCellScheduleDayCodeConfig = Pick<YearWeekCodeConfig, 'timezone'>;

/**
 * Creates a DateCellScheduleDayCodeFactory that converts dates to their corresponding day code, accounting for timezone normalization.
 *
 * @param config - optional timezone configuration; defaults to system timezone if not provided
 * @returns a factory function that maps a Date to its DateCellScheduleDayCode
 */
export function dateCellScheduleDayCodeFactory(config?: DateCellScheduleDayCodeConfig): DateCellScheduleDayCodeFactory {
  const normal = yearWeekCodeDateTimezoneInstance(config?.timezone);
  return (date: Date) => {
    const target = normal.systemDateToTargetDate(date);
    const day = getDay(target);
    return day + 1;
  };
}

/**
 * Returns true if both inputs, when fully expanded to individual day codes, represent the same set of days.
 *
 * @param a - first day codes input to compare
 * @param b - second day codes input to compare
 * @returns whether both inputs resolve to the same days of the week
 */
export function dateCellScheduleDayCodesAreSetsEquivalent(a: DateCellScheduleDayCodesInput, b: DateCellScheduleDayCodesInput): boolean {
  const ae = expandDateCellScheduleDayCodes(a);
  const be = expandDateCellScheduleDayCodes(b);
  return iterablesAreSetEquivalent(ae, be);
}

// MARK: DateCellSchedule
/**
 * Schedule configuration used to control which DateCell values are active for a recurring event.
 *
 * Combines weekly recurrence patterns (via encoded week days) with explicit include/exclude lists
 * for fine-grained control over individual date cell indices.
 */
export interface DateCellSchedule {
  /**
   * Days of the week to include.
   */
  w: DateCellScheduleEncodedWeek;
  /**
   * Specific DateCellIndex values to include.
   */
  d?: DateCellIndex[];
  /**
   * Specific DateCellIndex values to exclude.
   */
  ex?: DateCellIndex[];
}

/**
 * Returns true if the input is structurally a DateCellSchedule (has the expected shape).
 *
 * @param input - object to check
 * @returns whether the input matches the DateCellSchedule structure
 */
export function isDateCellSchedule(input: object): input is DateCellSchedule {
  if (typeof input === 'object') {
    const asRange = input as DateCellSchedule;
    return (typeof asRange.w === 'string' && !asRange.ex) || (Array.isArray(asRange.ex) && !asRange.d) || Array.isArray(asRange.d);
  }

  return false;
}

/**
 * Returns true if both schedules have the same encoded week, included indices, and excluded indices.
 *
 * @param a - first schedule to compare
 * @param b - second schedule to compare
 * @returns whether both schedules are equivalent
 */
export function isSameDateCellSchedule(a: Maybe<DateCellSchedule>, b: Maybe<DateCellSchedule>): boolean {
  if (a && b) {
    return a.w === b.w && iterablesAreSetEquivalent(a.ex ?? [], b.ex ?? []) && iterablesAreSetEquivalent(a.d ?? [], b.d ?? []);
  } else {
    return a == b;
  }
}

export class DateCellSchedule implements DateCellSchedule {
  @Expose()
  @IsString()
  @Matches(DATE_CELL_SCHEDULE_ENCODED_WEEK_REGEX)
  w!: DateCellScheduleEncodedWeek;

  @Expose()
  @IsOptional()
  @Min(0, { each: true })
  @IsArray()
  d?: DateCellIndex[];

  @Expose()
  @IsOptional()
  @Min(0, { each: true })
  @IsArray()
  ex?: DateCellIndex[];

  constructor(template?: DateCellSchedule) {
    if (template) {
      this.w = template.w;
      this.d = template.d;
      this.ex = template.ex;
    }
  }
}

/**
 * A DateCellSchedule combined with a DateRange and timezone, bounding the schedule to a specific date window.
 */
export interface DateCellScheduleDateRange extends DateCellSchedule, DateCellTimingDateRange {}

/**
 * A special DateCellScheduleDateRange that has both the start and end times at the start of the day in the target timezone for their given ranges.
 */
export type DateCellScheduleStartOfDayDateRange = DateCellScheduleDateRange;

/**
 * Returns true if the input is possibly a DateCellScheduleDateRange (has schedule fields and valid start/end dates).
 *
 * Does not check that the input is a valid FullDateCellScheduleRange.
 *
 * @param input - object to check
 * @returns whether the input has the structure of a DateCellScheduleDateRange
 */
export function isDateCellScheduleDateRange(input: object): input is DateCellScheduleDateRange {
  if (typeof input === 'object') {
    const asRange = input as FullDateCellScheduleRange;
    return isDateCellSchedule(asRange) && isDate(asRange.end) && isDate(asRange.start);
  }

  return false;
}

/**
 * Returns true if the input is a DateCellScheduleDateRange whose start and end are both at the start of day in its timezone, and has no duration or startsAt fields.
 *
 * @param input - object to check
 * @returns whether the input is a start-of-day schedule date range
 */
export function isDateCellScheduleStartOfDayDateRange(input: object): input is DateCellScheduleStartOfDayDateRange {
  if (isDateCellScheduleDateRange(input) && (input as Partial<FullDateCellScheduleRange>).duration == null && (input as Partial<FullDateCellScheduleRange>).startsAt == null) {
    const { start, end, timezone } = input;

    const normalInstance = dateTimezoneUtcNormal(timezone);
    return normalInstance.isStartOfDayInTargetTimezone(start) && normalInstance.isStartOfDayInTargetTimezone(end);
  }

  return false;
}

/**
 * Returns true if both inputs have the same schedule and date range.
 *
 * @param a - first schedule date range to compare
 * @param b - second schedule date range to compare
 * @returns whether both have identical date ranges and schedules
 */
export function isSameDateCellScheduleDateRange(a: Maybe<DateCellScheduleDateRange>, b: Maybe<DateCellScheduleDateRange>): boolean {
  if (a && b) {
    return isSameDateRange(a, b) && isSameDateCellSchedule(a, b);
  } else {
    return a == b;
  }
}

/**
 * Input for dateCellScheduleDateRange().
 *
 * It should be comprised of parts of a valid DateCellScheduleDateRange already. This means the start/end or startsAt/end is valid and for the given timezone.
 *
 * Invalid input has undetermined behavior.
 */
export type DateCellScheduleDateRangeInput = DateCellSchedule & Partial<TimezoneStringRef & (DateRange | DateCellTimingStartsAtEndRange)>;

/**
 * Creates a DateCellScheduleDateRange from the input, normalizing the start date to the start of day in the target timezone.
 *
 * Accepts either a start/end pair or a startsAt/end pair. If no end is provided, defaults to one minute after start.
 *
 * @param input - schedule and partial date range information to assemble
 * @returns a fully resolved schedule date range with timezone-aware start/end
 */
export function dateCellScheduleDateRange(input: DateCellScheduleDateRangeInput): DateCellScheduleDateRange {
  const { w, ex, d, start: inputStart, startsAt: inputStartsAt, end: inputEnd, timezone: inputTimezone } = input as DateCellSchedule & Partial<FullDateCellScheduleRange>;
  const timezone: TimezoneString = inputTimezone ?? requireCurrentTimezone(); // treat input as the current timezone
  const normalInstance = dateTimezoneUtcNormal(timezone);

  let start: Date;
  let end: Date;

  // either start or startsAt is provided
  if (inputStart != null) {
    const startInSystemTimezone = normalInstance.systemDateToTargetDate(inputStart); // start needs to be in the system timezone normal before processing.
    start = normalInstance.startOfDayInTargetTimezone(startInSystemTimezone); // ensure the start of the day is set/matches the timezone.
  } else {
    if (inputStartsAt != null) {
      // use ISO day string path to avoid system-timezone-dependent startOfDay; matches dateCellTiming behavior
      const startsAtInTarget = normalInstance.baseDateToTargetDate(inputStartsAt);
      start = normalInstance.startOfDayInTargetTimezone(formatToISO8601DayStringForUTC(startsAtInTarget));
    } else if (inputEnd != null) {
      start = normalInstance.startOfDayInTargetTimezone(inputEnd); // start on the same day as the end date
    } else {
      throw new Error('Could not determine the proper start value for the dateCellScheduleDateRange().');
    }
  }

  // set the end value
  end = inputEnd ?? addMinutes(start, 1); // default the end to one minute after the start

  return {
    w,
    ex,
    d,
    start,
    end,
    timezone
  };
}

/**
 * Changes any input DateCellScheduleDateRange to a new DateCellScheduleDateRange in the configured timezone.
 */
export type ChangeDateCellScheduleDateRangeToTimezoneFunction = ((dateRange: DateCellScheduleDateRange) => DateCellScheduleDateRange) & {
  readonly _normalInstance: DateTimezoneUtcNormalInstance;
};

/**
 * Creates a reusable function that converts any DateCellScheduleDateRange to the specified target timezone while preserving the same wall-clock day boundaries.
 *
 * @param timezoneInput - the target timezone to convert ranges into
 * @returns a conversion function with the internal normal instance exposed as `_normalInstance`
 */
export function changeDateCellScheduleDateRangeToTimezoneFunction(timezoneInput: DateCellTimingTimezoneInput): ChangeDateCellScheduleDateRangeToTimezoneFunction {
  const normalInstance = dateCellTimingTimezoneNormalInstance(timezoneInput);
  const timezone = normalInstance.configuredTimezoneString as string;

  const fn = ((input: DateCellScheduleDateRange) => {
    const inputTimingNormalInstance = dateCellTimingTimezoneNormalInstance(input);

    const startNormal = inputTimingNormalInstance.baseDateToTargetDate(input.start);
    const endNormal = inputTimingNormalInstance.baseDateToTargetDate(input.end);

    const start = normalInstance.targetDateToBaseDate(startNormal);
    const end = normalInstance.targetDateToBaseDate(endNormal);

    const result: DateCellScheduleDateRange = {
      w: input.w,
      d: input.d,
      ex: input.ex,
      start,
      end,
      timezone
    };

    return result;
  }) as Building<ChangeDateCellScheduleDateRangeToTimezoneFunction>;
  fn._normalInstance = normalInstance;
  return fn as ChangeDateCellScheduleDateRangeToTimezoneFunction;
}

/**
 * Convenience function for calling changeDateCellScheduleDateRangeToTimezoneFunction() and passing the new timing and timezone.
 *
 * @param timing - the schedule date range to convert
 * @param timezone - the target timezone
 * @returns the schedule date range re-expressed in the target timezone
 */
export function changeDateCellScheduleDateRangeToTimezone(timing: DateCellScheduleDateRange, timezone: DateCellTimingTimezoneInput): DateCellScheduleDateRange {
  return changeDateCellScheduleDateRangeToTimezoneFunction(timezone)(timing);
}

/**
 * A DateCellScheduleDateRange that also includes the event's startsAt time.
 */
export interface DateCellScheduleEventRange extends DateCellScheduleDateRange, DateCellTimingEventStartsAt {}

/**
 * Returns true if both inputs have the same schedule, date range, and event startsAt.
 *
 * @param a - first event range to compare
 * @param b - second event range to compare
 * @returns whether both event ranges are equivalent
 */
export function isSameDateCellScheduleEventRange(a: Maybe<DateCellScheduleEventRange>, b: Maybe<DateCellScheduleEventRange>): boolean {
  if (a && b) {
    return isSameDateCellScheduleDateRange(a, b) && isSameDateCellScheduleEventRange(a, b);
  } else {
    return a == b;
  }
}

/**
 * A DateCellScheduleEventRange that includes the duration and implements FullDateCellTiming.
 */
export interface FullDateCellScheduleRange extends DateCellScheduleEventRange, FullDateCellTiming {}

/**
 * Returns true if the input is possibly a FullDateCellScheduleRange (has schedule fields and full timing fields).
 *
 * Does not check that the input is a valid FullDateCellScheduleRange.
 *
 * @param input - object to check
 * @returns whether the input has the structure of a FullDateCellScheduleRange
 */
export function isFullDateCellScheduleDateRange(input: object): input is FullDateCellScheduleRange {
  if (typeof input === 'object') {
    const asRange = input as FullDateCellScheduleRange;
    return isDateCellSchedule(asRange) && isFullDateCellTiming(asRange);
  }

  return false;
}

/**
 * Returns true if both inputs have the same FullDateCellScheduleRange (schedule, date range, startsAt, and duration).
 *
 * @param a - first full schedule range to compare
 * @param b - second full schedule range to compare
 * @returns whether both full schedule ranges are equivalent
 */
export function isSameFullDateCellScheduleDateRange(a: Maybe<FullDateCellScheduleRange>, b: Maybe<FullDateCellScheduleRange>): boolean {
  if (a && b) {
    return isSameDateCellScheduleDateRange(a, b) && isSameFullDateCellTiming(a, b);
  } else {
    return a == b;
  }
}

/**
 * Union of schedule range types accepted by fullDateCellScheduleRange(), ordered from most complete (FullDateCellScheduleRange) to partial (DateCellScheduleDateRangeInput).
 */
export type FullDateCellScheduleRangeInputDateRange = DateCellScheduleDateRange | DateCellScheduleEventRange | FullDateCellScheduleRange | DateCellScheduleDateRangeInput;

export interface FullDateCellScheduleRangeInput {
  /**
   * Input schedule range to expand from.
   */
  readonly dateCellScheduleRange: FullDateCellScheduleRangeInputDateRange;
  /**
   * (Optional) Duration of the timing to use.
   *
   * If a duration is provided in the timing, this is ignored unless updateWithDefaults is true.
   */
  readonly duration?: number;
  /**
   * (Optional) Hours/Minutes to copy from when setting the inital startsAt.
   *
   * This will not change the timing's start/end date range, but it will update the end date.
   *
   * If a startsAt is provided in the timing, this is ignored unless updateWithDefaults is true.
   */
  readonly startsAtTime?: Date;
  /**
   * Whether or not to always update the range with the default duration/startsAt time
   */
  readonly updateWithDefaults?: boolean;
}

/**
 * If a duration is not set, this is the default used.
 */
export const DEFAULT_FULL_DATE_SCHEDULE_RANGE_DURATION = 1;

/**
 * Creates a FullDateCellScheduleRange from the input, filling in missing startsAt, duration, and end values with defaults.
 *
 * If the input already has full timing info, it is used as-is unless `updateWithDefaults` forces overrides.
 * When startsAt or duration are missing, they are derived from the start date or use a 1-minute default duration.
 *
 * @param input - configuration with the schedule range and optional default overrides
 * @returns a fully populated schedule range with timing, duration, and schedule data
 *
 * @example
 * ```ts
 * const range = fullDateCellScheduleRange({
 *   dateCellScheduleRange: {
 *     w: '89', // all week
 *     start: startDate,
 *     end: endDate,
 *     timezone: 'America/Denver'
 *   },
 *   startsAtTime: new Date('2025-01-01T09:00:00Z'),
 *   duration: 60
 * });
 * // range now has startsAt, duration, and correctly adjusted end date
 * ```
 */
export function fullDateCellScheduleRange(input: FullDateCellScheduleRangeInput): FullDateCellScheduleRange {
  const { dateCellScheduleRange, duration: inputDefaultDuration, startsAtTime: inputDefaultStartsAtTime, updateWithDefaults } = input;
  let initialFullDateRange: FullDateCellScheduleRange;

  const inputStartsAt = (dateCellScheduleRange as Partial<FullDateCellScheduleRange>).startsAt;
  const inputDuration = (dateCellScheduleRange as Partial<FullDateCellScheduleRange>).duration;

  const needsDurationAdjustment = inputStartsAt == null || (updateWithDefaults && inputDefaultDuration != null);
  const needsStartsAtAdjustment = inputDuration == null || (updateWithDefaults && inputDefaultStartsAtTime != null);

  if (isFullDateCellScheduleDateRange(dateCellScheduleRange)) {
    initialFullDateRange = dateCellScheduleRange; // no need to create a FullDateCellScheduleRange
  } else {
    // fill in the blanks for the date range
    const initialDateRange = dateCellScheduleDateRange(dateCellScheduleRange) as FullDateCellScheduleRange;
    initialDateRange.startsAt = inputStartsAt ?? initialDateRange.start;
    initialDateRange.duration = inputDuration ?? DEFAULT_FULL_DATE_SCHEDULE_RANGE_DURATION; // copy duration and startsAt
    initialFullDateRange = initialDateRange;

    if (isDateCellScheduleStartOfDayDateRange(dateCellScheduleRange)) {
      const startOfLastDay = initialFullDateRange.end;
      const startsAtOnLastDay = dateCellTimingStartsAtDateFactory(initialFullDateRange)(startOfLastDay);
      initialFullDateRange.end = addMinutes(startsAtOnLastDay, initialDateRange.duration);
    }
  }

  let fullDateCellTiming: FullDateCellTiming = initialFullDateRange;

  // Apply adjustments as needed
  if (needsDurationAdjustment || needsStartsAtAdjustment) {
    fullDateCellTiming = updateDateCellTimingWithDateCellTimingEvent({
      timing: initialFullDateRange,
      event: {
        startsAt: inputDefaultStartsAtTime ?? initialFullDateRange.startsAt,
        duration: inputDefaultDuration ?? initialFullDateRange.duration
      },
      // flag to replace the necessary items
      replaceStartsAt: needsStartsAtAdjustment,
      replaceDuration: needsDurationAdjustment
    });
  }

  const result: FullDateCellScheduleRange = {
    timezone: fullDateCellTiming.timezone,
    start: fullDateCellTiming.start,
    startsAt: fullDateCellTiming.startsAt,
    end: fullDateCellTiming.end,
    duration: fullDateCellTiming.duration,
    w: initialFullDateRange.w,
    ex: initialFullDateRange.ex,
    d: initialFullDateRange.d
  };

  return result;
}

// MARK: DateCellScheduleDate
/**
 * Input for a DateCellScheduleDateFilter: accepts either a Date or a DateCellIndex to test against the schedule.
 */
export type DateCellScheduleDateFilterInput = DateCellTimingRelativeIndexFactoryInput;

/**
 * Returns true if the date falls within the schedule.
 */
export type DateCellScheduleDateFilter = DecisionFunction<DateCellScheduleDateFilterInput> & {
  readonly _dateCellTimingRelativeIndexFactory: DateCellTimingRelativeIndexFactory;
};

/**
 * dateCellScheduleDateFilter() configuration.
 */
export interface DateCellScheduleDateFilterConfig extends DateCellSchedule, Partial<DateCellTimingStartsAtEndRange & DateCellTimingDateRange> {
  /**
   * The min/max date range for the filter.
   */
  readonly minMaxDateRange?: Maybe<Partial<DateCellRangeOrDateRange>>;
  /**
   * Whether or not to restrict the start as the min date if a min date is not set in minMaxDateRange. True by default.
   */
  readonly setStartAsMinDate?: boolean;
}

/**
 * Creates a shallow copy of a DateCellScheduleDateFilterConfig, useful for preserving configuration before mutation.
 *
 * @param inputFilter - the filter config to copy
 * @returns a new config object with the same values
 */
export function copyDateCellScheduleDateFilterConfig(inputFilter: DateCellScheduleDateFilterConfig): DateCellScheduleDateFilterConfig {
  return {
    start: inputFilter.start,
    startsAt: inputFilter.startsAt,
    end: inputFilter.end,
    timezone: inputFilter.timezone,
    w: inputFilter.w,
    d: inputFilter.d,
    ex: inputFilter.ex,
    // filter extras
    minMaxDateRange: inputFilter.minMaxDateRange,
    setStartAsMinDate: inputFilter.setStartAsMinDate
  };
}

/**
 * Creates a DateCellScheduleDateFilter that decides whether a given date or index falls within the schedule.
 *
 * The filter checks: (1) allowed days of the week from the encoded week, (2) explicit include/exclude lists,
 * and (3) optional min/max date boundaries. The filter accounts for timezone normalization.
 *
 * @param config - schedule, timing, and boundary configuration
 * @returns a decision function that returns true when the input date/index is within the schedule
 *
 * @example
 * ```ts
 * const filter = dateCellScheduleDateFilter({
 *   w: '8', // weekdays only
 *   startsAt: new Date('2025-01-06T09:00:00Z'),
 *   end: new Date('2025-01-31T10:00:00Z'),
 *   timezone: 'America/Denver',
 *   ex: [2] // exclude index 2 (Wednesday Jan 8)
 * });
 *
 * filter(0);  // true (Monday Jan 6)
 * filter(2);  // false (excluded)
 * filter(5);  // false (Saturday Jan 11)
 * ```
 */
export function dateCellScheduleDateFilter(config: DateCellScheduleDateFilterConfig): DateCellScheduleDateFilter {
  const { w, start: inputStart, startsAt: inputStartsAt, end: inputEnd, timezone: inputTimezone, setStartAsMinDate = true, minMaxDateRange } = config;

  const timezone = inputTimezone ?? requireCurrentTimezone(); // if the timezone is not provided, assume the startsAt is a system timezone normal.
  const normalInstance = dateTimezoneUtcNormal(timezone);

  // derive the startsAt time for the range. If not provided, defaults to inputStart, or midnight today in the target timezone.
  const startsAt: Date = inputStartsAt != null ? inputStartsAt : (inputStart ?? normalInstance.startOfDayInTargetTimezone());
  const allowedDays: Set<DayOfWeek> = expandDateCellScheduleDayCodesToDayOfWeekSet(w);

  const startsAtInSystem: Date = normalInstance.systemDateToTargetDate(startsAt); // convert to the system date
  const firstDateDay = getDay(startsAtInSystem) as DayOfWeek;
  const dayForIndex = dateCellDayOfWeekFactory(firstDateDay);
  const _dateCellTimingRelativeIndexFactory = dateCellTimingRelativeIndexFactory({ startsAt, timezone });

  let end: Maybe<Date>;

  if (inputEnd != null) {
    // use the startsAt time instead of the end time because endsAt can fall into the next day index range
    const { expectedFinalStartsAt } = calculateExpectedDateCellTimingDurationPair({ startsAt, timezone, end: inputEnd });
    end = expectedFinalStartsAt;
  }

  const indexFloor = setStartAsMinDate ? 0 : Number.MIN_SAFE_INTEGER;
  const minAllowedIndex = minMaxDateRange?.start != null ? Math.max(indexFloor, _dateCellTimingRelativeIndexFactory(minMaxDateRange.start)) : indexFloor; // start date should be the min inde
  const maxAllowedIndex = end != null ? _dateCellTimingRelativeIndexFactory(end) : minMaxDateRange?.end != null ? _dateCellTimingRelativeIndexFactory(minMaxDateRange.end) : Number.MAX_SAFE_INTEGER; // max "to" value

  const includedIndexes = new Set(config.d);
  const excludedIndexes = new Set(config.ex);

  const fn = ((input: DateCellScheduleDateFilterInput) => {
    let i: DateCellIndex;
    let day: DayOfWeek;

    if (typeof input === 'number') {
      i = input;
    } else {
      i = _dateCellTimingRelativeIndexFactory(input);
    }

    day = dayForIndex(i);
    const result = (i >= minAllowedIndex && i <= maxAllowedIndex && allowedDays.has(day) && !excludedIndexes.has(i)) || includedIndexes.has(i);
    return result;
  }) as Building<DateCellScheduleDateFilter>;

  fn._dateCellTimingRelativeIndexFactory = _dateCellTimingRelativeIndexFactory;

  return fn as DateCellScheduleDateFilter;
}

/**
 * Configuration for findNextDateInDateCellScheduleFilter().
 */
export interface FindNextDateInDateCellScheduleFilterInput {
  /**
   * Starting date or index to search from.
   */
  readonly date: DateCellScheduleDateFilterInput;
  /**
   * The schedule filter to test against.
   */
  readonly filter: DateCellScheduleDateFilter;
  /**
   * Direction to search: 'past' moves backward, 'future' moves forward.
   */
  readonly direction: DateRelativeDirection;
  /**
   * Maximum number of days to search before giving up.
   */
  readonly maxDistance: Days;
  /**
   * Whether or not to exclude the input date. False by default.
   */
  readonly excludeInputDate?: boolean;
}

/**
 * Searches forward or backward from a starting date/index to find the next date cell index that passes the schedule filter.
 *
 * Returns null if no matching date is found within the maxDistance limit.
 *
 * @param config - search parameters including start date, filter, direction, and distance limit
 * @returns the matching index/date pair, or null if none found within range
 *
 * @example
 * ```ts
 * const filter = dateCellScheduleDateFilter({
 *   w: '8', // weekdays
 *   startsAt: mondayDate,
 *   end: endDate,
 *   timezone: 'America/Denver'
 * });
 *
 * // Find next weekday from a Saturday
 * const next = findNextDateInDateCellScheduleFilter({
 *   date: saturdayDate,
 *   filter,
 *   direction: 'future',
 *   maxDistance: 7
 * });
 * // next.date is the following Monday
 * ```
 */
export function findNextDateInDateCellScheduleFilter(config: FindNextDateInDateCellScheduleFilterInput): Maybe<DateCellIndexDatePair> {
  const { date, filter, direction, maxDistance, excludeInputDate } = config;
  const { _dateCellTimingRelativeIndexFactory } = filter;

  const firstDateIndex = _dateCellTimingRelativeIndexFactory(date);
  const offsetDelta = direction === 'past' ? -1 : 1;

  let nextDatePair: Maybe<DateCellIndexDatePair>;

  for (let offset = excludeInputDate ? 1 : 0; offset < maxDistance; offset += 1) {
    const i = firstDateIndex + offset * offsetDelta;

    if (filter(i)) {
      const dateFactory = dateCellTimingDateFactory(_dateCellTimingRelativeIndexFactory._timing);

      nextDatePair = {
        i,
        date: dateFactory(i, isDate(date) ? date : undefined) // pass back the "now" time
      };
      break;
    }
  }

  return nextDatePair;
}

// MARK: DateCellScheduleDateCellTimingFilter
/**
 * A decision function that filters DateCell blocks based on a schedule applied to a specific timing.
 */
export type DateCellScheduleDateCellTimingFilter<B extends DateCell = DateCell> = DecisionFunction<B>;

/**
 * Configuration for dateCellScheduleDateCellTimingFilter()
 */
export interface DateCellScheduleDateCellTimingFilterConfig {
  /**
   * Timing to filter with.
   */
  timing: DateCellTiming;
  /**
   * Schedule to filter with.
   */
  schedule: DateCellSchedule;
  /**
   * Wether or not to expand on the inverse of the schedule, returning blocks that are not in the schedule.
   *
   * Other date filtering behaves the same (I.E. onlyBlocksNotYetStarted, etc.)
   */
  invertSchedule?: boolean;
  /**
   * (Optional) date to use when filtering from now.
   */
  now?: Date;
  /**
   * (Optional) filters in blocks that have started. Can be combined with the other filters.
   */
  onlyBlocksThatHaveStarted?: boolean;
  /**
   * (Optional) filters in blocks that have ended. Can be combined with the other filters.
   */
  onlyBlocksThatHaveEnded?: boolean;
  /**
   * (Optional) filters in blocks that have not yet started. Can be combined with the other filters.
   */
  onlyBlocksNotYetStarted?: boolean;
  /**
   * (Optional) filters in blocks that have not yet ended. Can be combined with the other filters.
   */
  onlyBlocksNotYetEnded?: boolean;
  /**
   * (Optional) custom filter function. Can be combined with the other filters.
   */
  durationSpanFilter?: FilterFunction<DateCellDurationSpan<DateCell>>;
  /**
   * (Optional) Maximum number of blocks to return.
   */
  maxDateCellsToReturn?: number;
}

/**
 * Creates a DateCellScheduleDateCellTimingFilter that tests whether a DateCell block's index is allowed by the schedule within the given timing.
 *
 * @param config - timing and schedule to build the filter from
 * @returns a decision function returning true for allowed blocks
 */
export function dateCellScheduleDateCellTimingFilter<B extends DateCell = DateCell>({ timing, schedule }: DateCellScheduleDateCellTimingFilterConfig): DateCellScheduleDateCellTimingFilter<B> {
  const isAllowed = dateCellScheduleDateFilter({
    w: schedule.w,
    d: schedule.d,
    ex: schedule.ex,
    startsAt: timing.startsAt,
    end: timing.end,
    timezone: timing.timezone
  });

  return (block: Readonly<B>) => {
    const i = block.i;
    return isAllowed(i);
  };
}

/**
 * Creates a DateCellTimingExpansionFactory that expands date cell ranges into duration spans, filtered by a schedule and optional time-based criteria (started, ended, etc.).
 *
 * @param config - timing, schedule, and optional temporal/custom filters
 * @returns an expansion factory that converts DateCellRange arrays into filtered DateCellDurationSpan arrays
 */
export function expandDateCellScheduleFactory<B extends DateCell = DateCell>(config: DateCellScheduleDateCellTimingFilterConfig): DateCellTimingExpansionFactory<B> {
  const { invertSchedule = false, now, onlyBlocksThatHaveEnded, onlyBlocksThatHaveStarted, onlyBlocksNotYetEnded, onlyBlocksNotYetStarted, maxDateCellsToReturn, durationSpanFilter: inputDurationSpanFilter } = config;
  let durationSpanFilter: FilterFunction<DateCellDurationSpan<DateCell>> | undefined;
  const durationSpanFilters: FilterFunction<DateCellDurationSpan<DateCell>>[] = [];

  if (inputDurationSpanFilter) {
    durationSpanFilters.push(inputDurationSpanFilter);
  }

  if (onlyBlocksNotYetStarted) {
    durationSpanFilters.push(dateCellDurationSpanHasNotStartedFilterFunction(now));
  } else if (onlyBlocksThatHaveEnded) {
    durationSpanFilters.push(dateCellDurationSpanHasEndedFilterFunction(now));
  } else {
    if (onlyBlocksThatHaveStarted) {
      durationSpanFilters.push(dateCellDurationSpanHasStartedFilterFunction(now));
    }

    if (onlyBlocksNotYetEnded) {
      durationSpanFilters.push(dateCellDurationSpanHasNotEndedFilterFunction(now));
    }
  }

  durationSpanFilter = mergeFilterFunctions(...durationSpanFilters);

  const expansionFactory = dateCellTimingExpansionFactory<B>({
    timing: config.timing,
    filter: invertFilter(dateCellScheduleDateCellTimingFilter(config) as FilterFunction, invertSchedule), // TODO: Use invertDecision
    durationSpanFilter,
    maxDateCellsToReturn
  });

  return expansionFactory;
}

/**
 * Input for expandDateCellSchedule(), extending the filter config with an optional index range limit.
 */
export interface ExpandDateCellScheduleInput extends DateCellScheduleDateCellTimingFilterConfig {
  /**
   * Index range to limit the expansion to. Capped to the timing's own range.
   */
  readonly limitIndexRange?: IndexRange;
}

/**
 * Expands a DateCellTiming and DateCellSchedule into concrete DateCellDurationSpan values representing each active block in the event.
 *
 * Only blocks whose indices pass the schedule filter (and any time-based filters) are included.
 * An optional limitIndexRange further restricts which indices are expanded, capped to the timing's own range.
 *
 * @param input - timing, schedule, and optional filters/range limit
 * @returns array of duration spans for each active date cell
 *
 * @example
 * ```ts
 * const spans = expandDateCellSchedule({
 *   timing: myTiming,
 *   schedule: { w: '8', ex: [3] } // weekdays, excluding index 3
 * });
 * // Returns DateCellDurationSpan[] for each weekday block except index 3
 * ```
 */
export function expandDateCellSchedule(input: ExpandDateCellScheduleInput): DateCellDurationSpan<DateCell>[] {
  const { timing, limitIndexRange } = input;
  const expansionFactory = expandDateCellScheduleFactory(input);
  const completeRange = dateCellIndexRange(timing);
  const range = limitIndexRange ? { minIndex: Math.max(limitIndexRange.minIndex, completeRange.minIndex), maxIndex: Math.min(limitIndexRange.maxIndex, completeRange.maxIndex) } : completeRange;
  const dateCellForRange: DateCellRange = {
    i: range.minIndex,
    to: range.maxIndex
  }; // Index is considered to be used as inclusive already, so no need to use dateCellIndexRangeToDateCellRange

  return expansionFactory([dateCellForRange]);
}

/**
 * Input for expandDateCellScheduleRange(), which derives both timing and schedule from a single schedule range.
 */
export interface ExpandDateCellScheduleRangeInput extends Omit<DateCellScheduleDateCellTimingFilterConfig, 'schedule' | 'timing'> {
  readonly dateCellScheduleRange: FullDateCellScheduleRangeInputDateRange;
  /**
   * (Optional) Duration of the timing to replace the dateCellScheduleRange's duration.
   */
  readonly duration?: number;
  /**
   * (Optional) Hours/Minutes to replace the dateCellScheduleRange's startsAt time.
   *
   * Note, this will modify the timing's end date to be a valid time.
   */
  readonly startsAtTime?: Date;
}

/**
 * Expands a schedule range into concrete DateCellDurationSpan values by first building a FullDateCellScheduleRange from the input, then expanding it.
 *
 * Allows overriding the duration and startsAt time on the schedule range before expansion.
 *
 * @param input - schedule range and optional override values
 * @returns array of duration spans for each active date cell in the range
 */
export function expandDateCellScheduleRange(input: ExpandDateCellScheduleRangeInput): DateCellDurationSpan<DateCell>[] {
  const { dateCellScheduleRange, duration, startsAtTime } = input;
  const fullDateRange = fullDateCellScheduleRange({
    dateCellScheduleRange,
    duration,
    startsAtTime,
    updateWithDefaults: true
  });

  return expandDateCellSchedule({ ...input, schedule: fullDateRange, timing: fullDateRange });
}

// MARK: DateCellScheduleRange
/**
 * Alias for ExpandDateCellScheduleRangeInput used when the goal is to produce DateCellRange groups.
 */
export type ExpandDateCellScheduleRangeToDateCellRangeInput = ExpandDateCellScheduleRangeInput;

/**
 * Expands a schedule range and groups the resulting duration spans into contiguous DateCellRangeWithRange values.
 *
 * @param input - schedule range expansion configuration
 * @returns grouped date cell ranges with their associated date ranges
 */
export function expandDateCellScheduleRangeToDateCellRanges(input: ExpandDateCellScheduleRangeToDateCellRangeInput): DateCellRangeWithRange[] {
  const dateCellDurationSpans = expandDateCellScheduleRange(input);
  return groupToDateCellRanges(dateCellDurationSpans);
}
