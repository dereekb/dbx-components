import { type Building, type DateOrDateString, type DateRelativeState, type FactoryWithRequiredInput, groupValues, type MapFunction, type Maybe, MS_IN_DAY, type ISO8601DayString, type DayOfWeek, dayOfWeek, daysOfWeekArray } from '@dereekb/util';
import { addDays, addHours, differenceInDays, endOfDay, endOfMonth, endOfWeek, isAfter, startOfDay, startOfMinute, startOfMonth, startOfWeek, addMilliseconds, endOfMinute, startOfHour, endOfHour, addMinutes, isBefore, addWeeks, addMonths } from 'date-fns';
import { isSameDate, isDate, isSameDateDay } from './date';
import { sortByDateFunction } from './date.sort';

/**
 * Anchors a value to a specific start date, useful as a base for ranges and scheduling.
 */
export interface DateRangeStart {
  start: Date;
}

/**
 * Type guard to check if a value conforms to the {@link DateRangeStart} interface.
 *
 * @example
 * ```ts
 * isDateRangeStart({ start: new Date() }); // true
 * isDateRangeStart({ start: 'not-a-date' }); // false
 * ```
 */
export function isDateRangeStart(value: unknown): value is DateRangeStart {
  return typeof value === 'object' && isDate((value as DateRangeStart).start);
}

/**
 * Compare function for sorting {@link DateRangeStart} values in ascending chronological order by their start date.
 * Suitable for use with `Array.prototype.sort()`.
 *
 * @example
 * ```ts
 * const items: DateRangeStart[] = [
 *   { start: new Date('2024-03-01') },
 *   { start: new Date('2024-01-01') }
 * ];
 * items.sort(sortDateRangeStartAscendingCompareFunction);
 * // [{ start: 2024-01-01 }, { start: 2024-03-01 }]
 * ```
 */
export const sortDateRangeStartAscendingCompareFunction = sortByDateFunction<DateRangeStart>((x) => x.start) as <T extends DateRangeStart>(a: T, b: T) => number;

/**
 * Defines a bounded time period with a start and end date, used throughout the date module
 * for filtering, iteration, and comparison operations.
 */
export interface DateRange extends DateRangeStart {
  end: Date;
}

/**
 * Counts the total number of calendar days spanned by the range, inclusive of both endpoints.
 * Always returns at least 1, even for same-day ranges.
 *
 * @example
 * ```ts
 * const range = { start: new Date('2024-01-01'), end: new Date('2024-01-03') };
 * dateRangeDaysCount(range); // 3
 * ```
 */
export function dateRangeDaysCount(dateRange: DateRange): number {
  return differenceInDays(dateRange.end, dateRange.start) + 1;
}

/**
 * Type guard to check if a value is a valid {@link DateRange} with both start and end as Date objects.
 *
 * @example
 * ```ts
 * isDateRange({ start: new Date(), end: new Date() }); // true
 * isDateRange({ start: new Date() }); // false
 * isDateRange('not-a-range'); // false
 * ```
 */
export function isDateRange(input: unknown): input is DateRange {
  return typeof input === 'object' && isDate((input as DateRange).start) && isDate((input as DateRange).end);
}

/**
 * Compares two date ranges for exact millisecond equality on both start and end.
 * Returns true if both are nullish.
 *
 * @example
 * ```ts
 * const a = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
 * const b = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
 * isSameDateRange(a, b); // true
 * isSameDateRange(null, null); // true
 * ```
 */
export function isSameDateRange(a: Maybe<Partial<DateRange>>, b: Maybe<Partial<DateRange>>): boolean {
  return a && b ? isSameDate(a.start, b.start) && isSameDate(a.end, b.end) : a == b;
}

/**
 * Compares two date ranges for calendar-day equality, ignoring time-of-day differences.
 * Returns true if both are nullish.
 *
 * @example
 * ```ts
 * const a = { start: new Date('2024-01-01T08:00:00'), end: new Date('2024-01-31T10:00:00') };
 * const b = { start: new Date('2024-01-01T20:00:00'), end: new Date('2024-01-31T23:00:00') };
 * isSameDateDayRange(a, b); // true (same calendar days)
 * ```
 */
export function isSameDateDayRange(a: Maybe<Partial<DateRange>>, b: Maybe<Partial<DateRange>>): boolean {
  return a && b ? isSameDateDay(a.start, b.start) && isSameDateDay(a.end, b.end) : a == b;
}

/**
 * Checks whether the range is unbounded (neither start nor end is set), meaning it conceptually includes all dates.
 *
 * @example
 * ```ts
 * isInfiniteDateRange({}); // true
 * isInfiniteDateRange({ start: new Date() }); // false
 * ```
 */
export function isInfiniteDateRange(input: Partial<DateRange>): boolean {
  return input.start == null && input.end == null;
}

/**
 * Checks whether the range has only one of start or end set, but not both.
 *
 * @example
 * ```ts
 * isPartialDateRange({ start: new Date() }); // true
 * isPartialDateRange({ start: new Date(), end: new Date() }); // false
 * ```
 */
export function isPartialDateRange(input: Partial<DateRange>): input is DateRange {
  return (input.start != null || input.end != null) && !isFullDateRange(input);
}

/**
 * Checks whether the range has both start and end set.
 *
 * @example
 * ```ts
 * isFullDateRange({ start: new Date(), end: new Date() }); // true
 * isFullDateRange({ start: new Date() }); // false
 * ```
 */
export function isFullDateRange(input: Partial<DateRange>): input is DateRange {
  return input.start != null && input.end != null;
}

/**
 * Union type representing either a single Date or a {@link DateRange}.
 */
export type DateOrDateRange = Date | DateRange;

/**
 * Normalizes a Date or {@link DateRange} into a DateRange. When given a single Date,
 * uses it as start and optionally uses the provided end date (defaults to the same date).
 *
 * @example
 * ```ts
 * const range = dateOrDateRangeToDateRange(new Date('2024-01-01'), new Date('2024-01-31'));
 * // { start: 2024-01-01, end: 2024-01-31 }
 *
 * const existing = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
 * dateOrDateRangeToDateRange(existing); // returns the same range
 * ```
 */
export function dateOrDateRangeToDateRange(startOrDateRange: DateOrDateRange, end?: Maybe<Date>): DateRange {
  if (isDate(startOrDateRange)) {
    return { start: startOrDateRange, end: (end as Date) ?? startOrDateRange };
  } else {
    return startOrDateRange;
  }
}

export enum DateRangeType {
  /**
   * Full day of the date. Ignores distance.
   */
  DAY = 'day',
  /**
   * Full week of the date. Ignores distance.
   */
  WEEK = 'week',
  /**
   * Full month of the date. Ignores distance.
   */
  MONTH = 'month',
  /**
   * Full minute of the date. Ignores distance.
   */
  MINUTE = 'minute',
  /**
   * Full hour of the date. Ignores distance.
   */
  HOUR = 'hour',
  /**
   * Full minutes between the date and the target date in the given distance/direction.
   */
  MINUTES_RANGE = 'minutes_range',
  /**
   * Full hours between the date and the target date in the given distance/direction.
   */
  HOURS_RANGE = 'hours_range',
  /**
   * Days between the date and the target date in the given distance/direction.
   */
  DAYS_RANGE = 'days_range',
  /**
   * Full weeks between the date and the target date in the given distance/direction.
   */
  WEEKS_RANGE = 'weeks_range',
  /**
   * Full months between the date and the target date in the given distance/direction.
   */
  MONTHS_RANGE = 'months_range',
  /**
   * Radius specified in minutes with the input.
   */
  MINUTES_RADIUS = 'minutes_radius',
  /**
   * Radius specified in hours with the input.
   */
  HOURS_RADIUS = 'hours_radius',
  /**
   * Radius specified in days with the input.
   */
  DAYS_RADIUS = 'days_radius',
  /**
   * Radius specified in weeks with the input.
   */
  WEEKS_RADIUS = 'weeks_radius',
  /**
   * All surrounding days that would appear on a calendar with this date.
   */
  CALENDAR_MONTH = 'calendar_month'
}

/**
 * Params for building a date range.
 */
export interface DateRangeParams {
  /**
   * Type of range.
   */
  type: DateRangeType;
  /**
   * Date to filter on. If not provided, assumes now.
   */
  date: Date;
  distance?: number;
}

export interface DateRangeTypedInput {
  type: DateRangeType;
  date?: Maybe<Date>;
  distance?: Maybe<number>;
}

/**
 * Simplified input for {@link dateRange} that treats distance as a number of days from the start date,
 * avoiding the need to specify a {@link DateRangeType}.
 */
export interface DateRangeDayDistanceInput {
  date?: Maybe<Date>;
  distance: number;
}

export interface DateRangeDistanceInput extends DateRangeDayDistanceInput {
  type?: DateRangeType;
}

export type DateRangeInput = (DateRangeTypedInput | DateRangeDistanceInput) & {
  roundToMinute?: boolean;
};

/**
 * Creates a {@link DateRange} from the given type and optional parameters. Supports many range
 * strategies including fixed periods (day, week, month), directional ranges, and radii.
 *
 * @throws Error if the type is not a recognized {@link DateRangeType}
 *
 * @example
 * ```ts
 * // Full day range for today
 * dateRange(DateRangeType.DAY);
 *
 * // 3 days forward from a specific date
 * dateRange({ type: DateRangeType.DAYS_RANGE, date: new Date('2024-01-01'), distance: 3 });
 *
 * // Calendar month view (includes surrounding weeks)
 * dateRange({ type: DateRangeType.CALENDAR_MONTH, date: new Date('2024-06-15') });
 * ```
 */
export function dateRange(input: DateRangeType | DateRangeInput, inputRoundToMinute?: boolean): DateRange {
  const config: DateRangeInput = typeof input === 'string' ? { type: input } : (input as DateRangeInput);
  const { type = DateRangeType.DAYS_RANGE, date: inputDate, distance: inputDistance, roundToMinute: inputConfigRoundToMinute = false } = config;
  const rawDistance = inputDistance ?? undefined;
  const roundToMinute = inputRoundToMinute ?? inputConfigRoundToMinute;

  let date = inputDate ?? new Date();
  let distance = inputDistance ?? 1;

  let start: Date = date;
  let end: Date = date;

  if (roundToMinute) {
    date = startOfMinute(date); // Reset to start of minute
  }

  function calculateStartAndEndForDate(startOfFn: (date: Date) => Date, endOfFn: (date: Date) => Date) {
    const preStart: Date = start;
    const preEnd: Date = end;

    start = startOfFn(preStart);
    end = endOfFn(preEnd);
  }

  function calculateStartAndEndForBetween(addFn: (date: Date, number: number) => Date, distance: number = 0, startOfFn: (date: Date) => Date, endOfFn: (date: Date) => Date) {
    let preStart: Date;
    let preEnd: Date;

    switch (distance) {
      case 0:
        preStart = date;
        preEnd = date;
        break;
      default:
        const hasNegativeDistance = distance < 0;

        if (hasNegativeDistance) {
          preStart = addFn(date, distance);
          preEnd = date;
        } else {
          preStart = date;
          preEnd = addFn(date, distance);
        }
        break;
    }

    start = startOfFn(preStart);
    end = endOfFn(preEnd);
  }

  switch (type) {
    case DateRangeType.DAY:
      calculateStartAndEndForDate(startOfDay, endOfDay);
      break;
    case DateRangeType.WEEK:
      calculateStartAndEndForDate(startOfWeek, endOfWeek);
      break;
    case DateRangeType.MONTH:
      calculateStartAndEndForDate(startOfMonth, endOfMonth);
      break;
    case DateRangeType.HOUR:
      calculateStartAndEndForDate(startOfHour, endOfHour);
      break;
    case DateRangeType.MINUTE:
      calculateStartAndEndForDate(startOfMinute, endOfMinute);
      break;
    case DateRangeType.MINUTES_RANGE:
      calculateStartAndEndForBetween(addMinutes, rawDistance, startOfMinute, endOfMinute);
      break;
    case DateRangeType.HOURS_RANGE:
      calculateStartAndEndForBetween(addHours, rawDistance, startOfHour, endOfHour);
      break;
    case DateRangeType.DAYS_RANGE:
      calculateStartAndEndForBetween(addDays, rawDistance, startOfDay, endOfDay);
      break;
    case DateRangeType.WEEKS_RANGE:
      calculateStartAndEndForBetween(addWeeks, rawDistance, startOfWeek, endOfWeek);
      break;
    case DateRangeType.MONTHS_RANGE:
      calculateStartAndEndForBetween(addMonths, rawDistance, startOfMonth, endOfMonth);
      break;
    case DateRangeType.MINUTES_RADIUS:
      distance = Math.abs(distance);
      start = addMinutes(date, -distance);
      end = addMinutes(date, distance);
      break;
    case DateRangeType.HOURS_RADIUS:
      distance = Math.abs(distance);
      start = addHours(date, -distance);
      end = addHours(date, distance);
      break;
    case DateRangeType.DAYS_RADIUS:
      distance = Math.abs(distance);
      start = addDays(date, -distance);
      end = addDays(date, distance);
      break;
    case DateRangeType.WEEKS_RADIUS:
      distance = Math.abs(distance);
      start = addDays(date, -distance * 7);
      end = addDays(date, distance * 7);
      break;
    case DateRangeType.CALENDAR_MONTH:
      const monthStart = startOfMonth(endOfWeek(date));
      start = startOfWeek(monthStart);
      end = endOfWeek(endOfMonth(monthStart));
      break;
    default:
      throw new Error(`Unknown date range type: ${type}`);
  }

  return {
    start,
    end
  };
}

/**
 * Returns a range spanning the full calendar day (first to last millisecond) of the given date.
 * Convenience wrapper around {@link dateRange} with {@link DateRangeType.DAY}.
 *
 * @example
 * ```ts
 * const range = dateRangeFromStartAndEndOfDay(new Date('2024-06-15T14:30:00'));
 * // { start: 2024-06-15T00:00:00, end: 2024-06-15T23:59:59.999 }
 * ```
 */
export function dateRangeFromStartAndEndOfDay(date: Date): DateRange {
  return dateRange({ date, type: DateRangeType.DAY });
}

/**
 * Function that iterates dates within a date range at a pre-configured iteration step.
 */
export type IterateDatesInDateRangeFunction = <T = void>(dateRange: DateRange, forEachFn: (date: Date) => T) => T[];

/**
 * Returns the next value to iterate on.
 */
export type IterateDaysGetNextValueFunction = MapFunction<Date, Date>;

/**
 * Configuration for creating an {@link IterateDatesInDateRangeFunction} via {@link iterateDaysInDateRangeFunction}.
 * Controls iteration limits and the step function used to advance between dates.
 */
export interface IterateDaysInDateRangeFunctionConfig {
  /**
   * (Optional) Max number of iterations allowed when iterating a date range.
   *
   * If the iteration count exceeds this size, behavior depends on {@link throwErrorOnMaxIterations}.
   *
   * If 0 or false, there is no max size.
   *
   * Defaults to 4000.
   */
  readonly maxIterations?: number | 0 | false;
  /**
   * Whether or not to throw an error when the max iteration size is reached.
   *
   * True by default.
   */
  readonly throwErrorOnMaxIterations?: boolean;
  readonly getNextDate: IterateDaysGetNextValueFunction;
}

export const DEFAULT_ITERATE_DAYS_IN_DATE_RANGE_MAX_ITERATIONS = 4000;

export type IterateDaysInDateRangeFunctionConfigInput = IterateDaysInDateRangeFunctionConfig | IterateDaysGetNextValueFunction;

/**
 * Sentinel error thrown by {@link endItreateDaysInDateRangeEarly} to signal early termination
 * of date range iteration. Caught internally by {@link iterateDaysInDateRangeFunction}.
 */
export class IterateDaysInDateRangeFunctionBailError extends Error {
  constructor(message: string = 'bail out') {
    super(message);
  }
}

/**
 * Throws a {@link IterateDaysInDateRangeFunctionBailError} to stop date range iteration early
 * from within a forEach callback. Only works inside functions created by {@link iterateDaysInDateRangeFunction}.
 *
 * @throws {@link IterateDaysInDateRangeFunctionBailError} always
 */
export function endItreateDaysInDateRangeEarly() {
  throw new IterateDaysInDateRangeFunctionBailError();
}

/**
 * Creates a reusable function that iterates over dates within a range using a configurable step function.
 * Supports max iteration limits and early bail-out via {@link endItreateDaysInDateRangeEarly}.
 *
 * @throws Error if max iterations is exceeded and throwErrorOnMaxIterations is true
 *
 * @example
 * ```ts
 * // Iterate every 2 days
 * const iterateEvery2Days = iterateDaysInDateRangeFunction((date) => addDays(date, 2));
 * const results = iterateEvery2Days(range, (date) => date.toISOString());
 * ```
 */
export function iterateDaysInDateRangeFunction(input: IterateDaysInDateRangeFunctionConfigInput): IterateDatesInDateRangeFunction {
  const config = typeof input === 'function' ? { getNextDate: input } : input;
  const { maxIterations: inputMaxIterations = DEFAULT_ITERATE_DAYS_IN_DATE_RANGE_MAX_ITERATIONS, throwErrorOnMaxIterations = true, getNextDate } = config;
  const maxIterations: number = inputMaxIterations ? inputMaxIterations : Number.MAX_SAFE_INTEGER;

  return <T>({ start, end }: DateRange, forEachFn: (date: Date) => T) => {
    let current = start;
    const results: T[] = [];

    try {
      while (!isAfter(current, end)) {
        const result = forEachFn(current);
        results.push(result);
        current = getNextDate(current);

        if (results.length >= maxIterations) {
          if (throwErrorOnMaxIterations) {
            throw new Error(`iterateDaysInDateRangeFunction() reached max configured iterations of ${maxIterations}`);
          } else {
            break;
          }
        }
      }
    } catch (e) {
      if (!(e instanceof IterateDaysInDateRangeFunctionBailError)) {
        throw e;
      }
    }

    return results as any;
  };
}

/**
 * Iterates over dates within a {@link DateRange}, advancing by the provided getNextDate step function.
 * A simpler alternative to {@link iterateDaysInDateRangeFunction} for one-off usage.
 */
export function iterateDaysInDateRange(dateRange: DateRange, forEachFn: (date: Date) => void, getNextDate: (date: Date) => Date): void;
export function iterateDaysInDateRange<T>(dateRange: DateRange, forEachFn: (date: Date) => T, getNextDate: (date: Date) => Date): T[];
export function iterateDaysInDateRange<T = void>(dateRange: DateRange, forEachFn: (date: Date) => T, getNextDate: (date: Date) => Date): T extends void ? void : T[] {
  return iterateDaysInDateRangeFunction(getNextDate)(dateRange, forEachFn) as any;
}

/**
 * Pre-built iteration function that steps one day at a time through a {@link DateRange}.
 * Calls the provided function for each day starting from the range's start date.
 */
export const forEachDayInDateRange: IterateDatesInDateRangeFunction = iterateDaysInDateRangeFunction((current) => addDays(current, 1));

/**
 * Configuration for {@link expandDaysForDateRangeFunction} controlling the safety limit
 * on how many days can be expanded from a single range.
 */
export interface ExpandDaysForDateRangeConfig {
  /**
   * (Optional) Max expansion size for expanding a date range.
   *
   * If the expected expansion is larger than this size, an exception is thrown.
   *
   * If 0 or false, there is no max size.
   *
   * Defaults to 1500 days.
   */
  maxExpansionSize?: number | 0 | false;
}

export const DEFAULT_EXPAND_DAYS_FOR_DATE_RANGE_MAX_EXPANSION_SIZE = 1500;

export type ExpandDaysForDateRangeFunction = FactoryWithRequiredInput<Date[], DateRange>;

/**
 * Creates a reusable function that expands a {@link DateRange} into an array of individual day dates.
 * Includes a configurable safety limit to prevent accidental memory exhaustion from large ranges.
 *
 * @throws Error if the range spans more days than the configured maxExpansionSize
 *
 * @example
 * ```ts
 * const expand = expandDaysForDateRangeFunction({ maxExpansionSize: 365 });
 * const days = expand({ start: new Date('2024-01-01'), end: new Date('2024-01-03') });
 * // [2024-01-01, 2024-01-02, 2024-01-03]
 * ```
 */
export function expandDaysForDateRangeFunction(config: ExpandDaysForDateRangeConfig = {}): ExpandDaysForDateRangeFunction {
  const { maxExpansionSize: inputMaxExpansionSize = DEFAULT_EXPAND_DAYS_FOR_DATE_RANGE_MAX_EXPANSION_SIZE } = config;
  const maxExpansionSize = inputMaxExpansionSize ? inputMaxExpansionSize : Number.MAX_SAFE_INTEGER;

  return (dateRange: DateRange) => {
    const { start, end } = dateRange;

    // check the expansion isn't too large
    const distance = Math.abs(differenceInDays(start, end));

    if (distance > maxExpansionSize) {
      throw new Error(`Attempted to expand days past the max expansion size of "${distance}"`);
    }

    const dates: Date[] = forEachDayInDateRange(dateRange, (x) => x);
    return dates;
  };
}

/**
 * Expands a {@link DateRange} into an array of one Date per day. Uses the default max expansion size.
 * Convenience wrapper around {@link expandDaysForDateRangeFunction}.
 *
 * @example
 * ```ts
 * const days = expandDaysForDateRange({ start: new Date('2024-01-01'), end: new Date('2024-01-03') });
 * // [2024-01-01, 2024-01-02, 2024-01-03]
 * ```
 */
export function expandDaysForDateRange(range: DateRange): Date[] {
  return expandDaysForDateRangeFunction({})(range);
}

/**
 * Determines whether the current moment (or provided `now`) falls before, within, or after the given range.
 *
 * @example
 * ```ts
 * const range = { start: new Date('2024-01-01'), end: new Date('2024-12-31') };
 * dateRangeRelativeState(range, new Date('2024-06-15')); // 'present'
 * dateRangeRelativeState(range, new Date('2025-01-01')); // 'past'
 * dateRangeRelativeState(range, new Date('2023-12-31')); // 'future'
 * ```
 */
export function dateRangeRelativeState({ start, end }: DateRange, now: Date = new Date()): DateRelativeState {
  if (isAfter(now, end)) {
    return 'past';
  } else if (isBefore(now, start)) {
    return 'future';
  } else {
    return 'present';
  }
}

export interface GroupDateRangesByDateRelativeStatesResult<T extends DateRange> {
  readonly past: T[];
  readonly present: T[];
  readonly future: T[];
}

/**
 * Groups an array of date ranges into past, present, and future buckets based on the current moment (or provided `now`).
 *
 * @example
 * ```ts
 * const ranges = [
 *   { start: new Date('2023-01-01'), end: new Date('2023-12-31') },
 *   { start: new Date('2024-06-01'), end: new Date('2024-06-30') },
 * ];
 * const grouped = groupDateRangesByDateRelativeState(ranges, new Date('2024-06-15'));
 * // grouped.past = [first range], grouped.present = [second range], grouped.future = []
 * ```
 */
export function groupDateRangesByDateRelativeState<T extends DateRange>(dateRanges: T[], now: Date = new Date()): GroupDateRangesByDateRelativeStatesResult<T> {
  return groupValues(dateRanges, (x) => dateRangeRelativeState(x));
}

export type DateRangeFunctionDateRangeRef<T extends Partial<DateRange> = Partial<DateRange>> = {
  readonly _dateRange: T;
};

/**
 * Returns true if the input date is contained within the configured DateRange or DateRangeStart.
 *
 * A dateRange that has no start and end is considered to include all dates.
 */
export type IsDateInDateRangeFunction<T extends Partial<DateRange> = DateRange> = ((date: Date) => boolean) & DateRangeFunctionDateRangeRef<T>;

/**
 * Checks whether a date falls within a (possibly partial) date range.
 * Convenience wrapper around {@link isDateInDateRangeFunction}.
 *
 * @example
 * ```ts
 * const range = { start: new Date('2024-01-01'), end: new Date('2024-12-31') };
 * isDateInDateRange(new Date('2024-06-15'), range); // true
 * isDateInDateRange(new Date('2025-01-01'), range); // false
 * ```
 */
export function isDateInDateRange(date: Date, dateRange: Partial<DateRange>): boolean {
  return isDateInDateRangeFunction(dateRange)(date);
}

/**
 * Creates a reusable function that tests whether dates fall within the given range.
 * Handles partial ranges: if only start is set, checks >= start; if only end, checks <= end;
 * if neither, all dates are considered in range.
 *
 * @example
 * ```ts
 * const isInQ1 = isDateInDateRangeFunction({
 *   start: new Date('2024-01-01'),
 *   end: new Date('2024-03-31')
 * });
 * isInQ1(new Date('2024-02-15')); // true
 * isInQ1(new Date('2024-05-01')); // false
 * ```
 */
export function isDateInDateRangeFunction<T extends Partial<DateRange>>(dateRange: T): IsDateInDateRangeFunction<T> {
  let fn: Building<IsDateInDateRangeFunction<T>>;

  if (dateRange.start != null && dateRange.end != null) {
    // Start And End
    const startTime = dateRange.start.getTime();
    const endTime = dateRange.end.getTime();
    fn = ((input: Date) => {
      const time = input.getTime();
      return time >= startTime && time <= endTime;
    }) as IsDateInDateRangeFunction<T>;
  } else if (dateRange.start != null) {
    // Start Only
    const startTime = dateRange.start.getTime();
    fn = ((input: Date) => {
      const time = input.getTime();
      return time >= startTime;
    }) as IsDateInDateRangeFunction<T>;
  } else if (dateRange.end != null) {
    // End Only
    const endTime = dateRange.end.getTime();
    fn = ((input: Date) => {
      const time = input.getTime();
      return time <= endTime;
    }) as IsDateInDateRangeFunction<T>;
  } else {
    fn = ((input: Date) => true) as IsDateInDateRangeFunction<T>;
  }

  fn._dateRange = dateRange;

  return fn as IsDateInDateRangeFunction<T>;
}

/**
 * Returns true if the input DateRange is contained within the configured DateRange.
 */
export type IsDateRangeInDateRangeFunction<T extends Partial<DateRange> = Partial<DateRange>> = ((dateRange: DateRange) => boolean) & DateRangeFunctionDateRangeRef<T>;

/**
 * Checks whether a date range is fully contained within another (possibly partial) date range.
 * Convenience wrapper around {@link isDateRangeInDateRangeFunction}.
 *
 * @example
 * ```ts
 * const outer = { start: new Date('2024-01-01'), end: new Date('2024-12-31') };
 * const inner = { start: new Date('2024-03-01'), end: new Date('2024-06-30') };
 * isDateRangeInDateRange(inner, outer); // true
 * ```
 */
export function isDateRangeInDateRange(compareDateRange: DateRange, dateRange: Partial<DateRange>): boolean {
  return isDateRangeInDateRangeFunction(dateRange)(compareDateRange);
}

/**
 * Creates a reusable function that tests whether a given date range is fully contained within
 * the configured boundary range. Both start and end of the input must be within bounds.
 *
 * @example
 * ```ts
 * const isInYear = isDateRangeInDateRangeFunction({
 *   start: new Date('2024-01-01'),
 *   end: new Date('2024-12-31')
 * });
 * isInYear({ start: new Date('2024-03-01'), end: new Date('2024-06-30') }); // true
 * isInYear({ start: new Date('2023-12-01'), end: new Date('2024-06-30') }); // false
 * ```
 */
export function isDateRangeInDateRangeFunction<T extends Partial<DateRange> = DateRange>(dateRange: T): IsDateRangeInDateRangeFunction<T> {
  const isDateInDateRange = isDateInDateRangeFunction(dateRange);

  const fn = ((input: DateRange) => {
    return isDateInDateRange(input.start) && isDateInDateRange(input.end);
  }) as Building<IsDateRangeInDateRangeFunction<T>>;
  fn._dateRange = dateRange;
  return fn as IsDateRangeInDateRangeFunction<T>;
}

/**
 * Returns true if the input DateRange overlaps the configured DateRange in any way.
 */
export type DateRangeOverlapsDateRangeFunction<T extends DateRange = DateRange> = ((dateRange: DateRangeStart & Partial<DateRange>) => boolean) & DateRangeFunctionDateRangeRef<T>;

/**
 * Checks whether two date ranges overlap in any way (partial or full).
 * Convenience wrapper around {@link dateRangeOverlapsDateRangeFunction}.
 *
 * @example
 * ```ts
 * const a = { start: new Date('2024-01-01'), end: new Date('2024-06-30') };
 * const b = { start: new Date('2024-03-01'), end: new Date('2024-12-31') };
 * dateRangeOverlapsDateRange(a, b); // true
 * ```
 */
export function dateRangeOverlapsDateRange(compareDateRange: DateRange, dateRange: DateRange): boolean {
  return dateRangeOverlapsDateRangeFunction(dateRange)(compareDateRange);
}

/**
 * Creates a reusable function that tests whether input ranges overlap the configured boundary range.
 * Two ranges overlap if one starts before the other ends, and vice versa.
 *
 * @example
 * ```ts
 * const overlapsQ1 = dateRangeOverlapsDateRangeFunction({
 *   start: new Date('2024-01-01'),
 *   end: new Date('2024-03-31')
 * });
 * overlapsQ1({ start: new Date('2024-03-15'), end: new Date('2024-04-15') }); // true
 * overlapsQ1({ start: new Date('2024-05-01'), end: new Date('2024-06-01') }); // false
 * ```
 */
export function dateRangeOverlapsDateRangeFunction<T extends DateRange = DateRange>(dateRange: T): DateRangeOverlapsDateRangeFunction<T> {
  const startTime = dateRange.start.getTime();
  const endTime = dateRange.end.getTime();

  const fn = ((input: DateRangeStart & Partial<DateRange>) => {
    const start = input.start;
    const end = (input as DateRange).end ?? input.start;
    return start.getTime() <= endTime && end.getTime() >= startTime;
  }) as Building<DateRangeOverlapsDateRangeFunction<T>>;

  fn._dateRange = dateRange;

  return fn as DateRangeOverlapsDateRangeFunction<T>;
}

/**
 * Collapses a multi-day UTC date range down to a single 24-hour period, preserving only the
 * time-of-day relationship between start and end. Useful for extracting a daily schedule window
 * from a range that may span multiple days.
 *
 * The order of times is retained. If start and end share the same time but span multiple days,
 * the result is a full 24-hour period.
 *
 * Operates in UTC, so daylight savings transitions are not considered.
 *
 * @example
 * ```ts
 * // 10AM to 1PM across 3 days becomes same-day 10AM to 1PM
 * const range = { start: new Date('2024-01-01T10:00:00Z'), end: new Date('2024-01-03T13:00:00Z') };
 * const fitted = fitUTCDateRangeToDayPeriod(range);
 * // fitted.start = 2024-01-01T10:00:00Z, fitted.end = 2024-01-01T13:00:00Z
 * ```
 */
export function fitUTCDateRangeToDayPeriod<T extends DateRange = DateRange>(dateRange: T): T {
  const startTime = dateRange.start.getTime();
  const endTime = dateRange.end.getTime();

  const distance = endTime - startTime;
  let newDistance = distance % MS_IN_DAY;

  // if the times are the same but not on the same day, then it is a 24 hour period.
  if (newDistance === 0 && distance > 0) {
    newDistance = MS_IN_DAY;
  }

  const end = addMilliseconds(dateRange.start, newDistance);

  return {
    ...dateRange,
    start: dateRange.start,
    end
  };
}

/**
 * Clamps the input range to the pre-configured date range.
 */
export type ClampDateFunction = ((date: Date) => Date) & DateRangeFunctionDateRangeRef;

/**
 * Creates a reusable function that clamps dates to fall within the given range boundaries.
 * Dates before start are clamped to start; dates after end are clamped to end.
 * Partial ranges clamp only on the side that is defined.
 *
 * @example
 * ```ts
 * const clamp = clampDateFunction({
 *   start: new Date('2024-01-01'),
 *   end: new Date('2024-12-31')
 * });
 * clamp(new Date('2023-06-15')); // 2024-01-01
 * clamp(new Date('2024-06-15')); // 2024-06-15 (unchanged)
 * clamp(new Date('2025-06-15')); // 2024-12-31
 * ```
 */
export function clampDateFunction(dateRange: Partial<DateRange>): ClampDateFunction {
  let fn: Building<ClampDateFunction>;

  const hasStartDate = dateRange.start != null;
  const hasEndDate = dateRange.end != null;

  if (hasStartDate || hasEndDate) {
    // Start Clamp
    const startTime = dateRange.start?.getTime() || 0;

    const clampStart = (input: Date) => {
      const time = input.getTime();
      return time >= startTime ? input : (dateRange.start as Date);
    };

    // End Clamp
    const endTime = dateRange.end?.getTime() || 0;

    const clampEnd = (input: Date) => {
      const time = input.getTime();
      return time <= endTime ? input : (dateRange.end as Date);
    };

    if (hasStartDate && hasEndDate) {
      fn = ((input: Date) => {
        return clampStart(clampEnd(input));
      }) as Building<ClampDateFunction>;
    } else if (hasStartDate) {
      fn = ((input: Date) => {
        return clampStart(input);
      }) as Building<ClampDateFunction>;
    } else {
      fn = ((input: Date) => {
        return clampEnd(input);
      }) as Building<ClampDateFunction>;
    }
  } else {
    fn = ((input: Date) => input) as ClampDateFunction;
  }

  fn._dateRange = dateRange;

  return fn as ClampDateFunction;
}

/**
 * Clamps a single date to fall within the given range boundaries.
 * Convenience wrapper around {@link clampDateFunction}.
 *
 * @example
 * ```ts
 * const range = { start: new Date('2024-01-01'), end: new Date('2024-12-31') };
 * clampDateToDateRange(new Date('2023-06-15'), range); // 2024-01-01
 * ```
 */
export function clampDateToDateRange(date: Date, dateRange: Partial<DateRange>) {
  return clampDateFunction(dateRange)(date);
}

export type ClampPartialDateRangeFunction = ((date: Partial<DateRange>, clampNullValues?: boolean) => Partial<DateRange>) & DateRangeFunctionDateRangeRef;
export type ClampDateRangeFunction = ((date: Partial<DateRange>, clampNullValues?: boolean) => DateRange) & DateRangeFunctionDateRangeRef<DateRange>;

/**
 * Creates a reusable function that clamps an entire date range to fit within the configured boundaries.
 * When `clampNullValues` is true, missing start/end values on the input are replaced with the boundary values.
 *
 * @example
 * ```ts
 * const clamp = clampDateRangeFunction({
 *   start: new Date('2024-01-01'),
 *   end: new Date('2024-12-31')
 * });
 * const result = clamp({ start: new Date('2023-06-01'), end: new Date('2024-06-30') });
 * // { start: 2024-01-01, end: 2024-06-30 }
 * ```
 */
export function clampDateRangeFunction(dateRange: DateRange, defaultClampNullValues?: boolean): ClampDateRangeFunction;
export function clampDateRangeFunction(dateRange: Partial<DateRange>, defaultClampNullValues?: boolean): ClampPartialDateRangeFunction;
export function clampDateRangeFunction(dateRange: Partial<DateRange>, defaultClampNullValues = false): ClampDateRangeFunction | ClampPartialDateRangeFunction {
  const clampDate = clampDateFunction(dateRange);

  const fn = ((input: Partial<DateRange>, clampNullValues = defaultClampNullValues) => {
    const start = input.start ? clampDate(input.start) : clampNullValues ? dateRange.start : undefined;
    const end = input.end ? clampDate(input.end) : clampNullValues ? dateRange.end : undefined;
    return { start, end };
  }) as Building<ClampPartialDateRangeFunction>;
  fn._dateRange = dateRange;
  return fn as ClampPartialDateRangeFunction;
}

/**
 * Clamps a date range to fit within a boundary range.
 * Convenience wrapper around {@link clampDateRangeFunction}.
 *
 * @example
 * ```ts
 * const input = { start: new Date('2023-06-01'), end: new Date('2024-06-30') };
 * const limit = { start: new Date('2024-01-01'), end: new Date('2024-12-31') };
 * clampDateRangeToDateRange(input, limit);
 * // { start: 2024-01-01, end: 2024-06-30 }
 * ```
 */
export function clampDateRangeToDateRange(inputDateRange: Partial<DateRange>, limitToDateRange: Partial<DateRange>) {
  return clampDateRangeFunction(limitToDateRange)(inputDateRange);
}

/**
 * Transforms both of the dates in the date range function.
 */
export type TransformDateRangeDatesFunction = (dateRange: DateRange) => DateRange;

/**
 * Creates a function that applies a date transformation to both start and end of a {@link DateRange}.
 *
 * @example
 * ```ts
 * import { startOfHour } from 'date-fns';
 * const roundToHour = transformDateRangeDatesFunction(startOfHour);
 * const range = { start: new Date('2024-01-01T10:30:00'), end: new Date('2024-01-01T14:45:00') };
 * roundToHour(range); // { start: 2024-01-01T10:00:00, end: 2024-01-01T14:00:00 }
 * ```
 */
export function transformDateRangeDatesFunction(transform: MapFunction<Date, Date>): TransformDateRangeDatesFunction {
  return ({ start, end }: DateRange) => ({
    start: transform(start),
    end: transform(end)
  });
}

/**
 * Pre-built {@link TransformDateRangeDatesFunction} that rounds both start and end to the beginning of their respective days.
 */
export const transformDateRangeWithStartOfDay = transformDateRangeDatesFunction(startOfDay);

/**
 * Variant of {@link DateRange} that accepts Date objects, ISO 8601 date-time strings, or ISO 8601 day strings
 * as values, useful for accepting serialized date range input before parsing.
 */
export interface DateRangeWithDateOrStringValue {
  start: DateOrDateString | ISO8601DayString;
  end: DateOrDateString | ISO8601DayString;
}

/**
 * Returns each unique day of the week present in the range, in the order they appear starting from
 * the range's start day. For ranges spanning 7+ days, returns all days of the week.
 *
 * @example
 * ```ts
 * // Wednesday through Friday
 * const range = { start: new Date('2024-01-03'), end: new Date('2024-01-05') };
 * getDaysOfWeekInDateRange(range); // [3, 4, 5] (Wed, Thu, Fri)
 * ```
 */
export function getDaysOfWeekInDateRange(dateRange: DateRange): DayOfWeek[] {
  const days: DayOfWeek[] = [];

  const daysRange = differenceInDays(dateRange.start, dateRange.end);

  if (daysRange >= 7) {
    return daysOfWeekArray(dayOfWeek(dateRange.start));
  }

  forEachDayInDateRange(dateRange, (day) => {
    days.push(dayOfWeek(day));

    if (days.length >= 7) {
      endItreateDaysInDateRangeEarly();
    }
  });

  return days;
}
