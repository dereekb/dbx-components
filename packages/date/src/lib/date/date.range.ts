import { Building, DateOrDateString, DateRelativeState, FactoryWithRequiredInput, groupValues, MapFunction, Maybe, MS_IN_DAY, ISO8601DayString, DayOfWeek, dayOfWeek, daysOfWeekArray } from '@dereekb/util';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsOptional, IsDate, IsNumber } from 'class-validator';
import { addDays, addHours, differenceInDays, endOfDay, endOfMonth, endOfWeek, isAfter, startOfDay, startOfMinute, startOfMonth, startOfWeek, addMilliseconds, endOfMinute, startOfHour, endOfHour, addMinutes, isBefore, addWeeks, addMonths } from 'date-fns';
import { isSameDate, isDate, isSameDateDay } from './date';
import { sortByDateFunction } from './date.sort';

/**
 * Represents a start date.
 */
export interface DateRangeStart {
  start: Date;
}

/**
 * Returns true if the input is a DateRangeStart.
 *
 * @param value
 * @returns
 */
export function isDateRangeStart(value: unknown): value is DateRangeStart {
  return typeof value === 'object' && isDate((value as DateRangeStart).start);
}

/**
 * Sorts the input DateRangeStart values in ascending order by start Date.
 *
 * @param a
 * @param b
 * @returns
 */
export const sortDateRangeStartAscendingCompareFunction = sortByDateFunction<DateRangeStart>((x) => x.start) as <T extends DateRangeStart>(a: T, b: T) => number;

/**
 * Represents a start and end date.
 */
export interface DateRange extends DateRangeStart {
  end: Date;
}

export class DateRange {
  @Expose()
  @IsDate()
  @Type(() => Date)
  start!: Date;

  @Expose()
  @IsDate()
  @Type(() => Date)
  end!: Date;

  constructor(template: DateRange) {
    if (template != null) {
      this.start = template.start;
      this.end = template.end;
    }
  }
}

/**
 * Total number of days in the range. Minimum of 1 day.
 *
 * @param dateRange
 * @returns
 */
export function dateRangeDaysCount(dateRange: DateRange): number {
  return differenceInDays(dateRange.end, dateRange.start) + 1;
}

/**
 * Returns true if the input is a DateRange.
 *
 * @param input
 * @returns
 */
export function isDateRange(input: unknown): input is DateRange {
  return typeof input === 'object' && isDate((input as DateRange).start) && isDate((input as DateRange).end);
}

export function isSameDateRange(a: Maybe<Partial<DateRange>>, b: Maybe<Partial<DateRange>>): boolean {
  return a && b ? isSameDate(a.start, b.start) && isSameDate(a.end, b.end) : a == b;
}

export function isSameDateDayRange(a: Maybe<Partial<DateRange>>, b: Maybe<Partial<DateRange>>): boolean {
  return a && b ? isSameDateDay(a.start, b.start) && isSameDateDay(a.end, b.end) : a == b;
}

/**
 * Returns true if the date range has no start or end.
 *
 * @param input
 * @returns
 */
export function isInfiniteDateRange(input: Partial<DateRange>): boolean {
  return input.start == null && input.end == null;
}

export function isPartialDateRange(input: Partial<DateRange>): input is DateRange {
  return (input.start != null || input.end != null) && !isFullDateRange(input);
}

export function isFullDateRange(input: Partial<DateRange>): input is DateRange {
  return input.start != null && input.end != null;
}

export type DateOrDateRange = Date | DateRange;

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
export class DateRangeParams {
  /**
   * Type of range.
   */
  @IsEnum(DateRangeType)
  type: DateRangeType = DateRangeType.DAY;

  /**
   * Date to filter on. If not provided, assumes now.
   */
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date: Date = new Date();

  @IsNumber()
  @IsOptional()
  distance?: number;

  constructor(template: DateRangeParams) {
    if (template) {
      this.type = template.type;
      this.date = template.date;
      this.distance = template.distance;
    }
  }
}

export interface DateRangeTypedInput {
  type: DateRangeType;
  date?: Maybe<Date>;
  distance?: Maybe<number>;
}

/**
 * dateRange() input that infers duration to be a number of days, starting from the input date if applicable.
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
 * Creates a DateRange from the input DateRangeParams
 *
 * @param param0
 * @param roundToMinute
 * @returns
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
 * Function that iterates dates within a date range at a pre-configured iteration step.
 */
export type IterateDatesInDateRangeFunction = <T = void>(dateRange: DateRange, forEachFn: (date: Date) => T) => T[];

/**
 * Returns the next value to iterate on.
 */
export type IterateDaysGetNextValueFunction = MapFunction<Date, Date>;

export interface IterateDaysInDateRangeFunctionConfig {
  /**
   * (Optiona) Max expansion size for expanding a date range.
   *
   * If the expected expansion is larger than this size, an exception is thrown.
   *
   * If 0 or false, there is no max size.
   *
   * Defaults to 4000 days.
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

export class IterateDaysInDateRangeFunctionBailError extends Error {
  constructor(message: string = 'bail out') {
    super(message);
  }
}

/**
 * Call to end iterating days in a date range early.
 */
export function endItreateDaysInDateRangeEarly() {
  throw new IterateDaysInDateRangeFunctionBailError();
}

/**
 * Creates an IterateDaysInDateRangeFunction
 *
 * @param getNextDate
 * @returns
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
 * Iterates date values within the given DateRange.
 */
export function iterateDaysInDateRange(dateRange: DateRange, forEachFn: (date: Date) => void, getNextDate: (date: Date) => Date): void;
export function iterateDaysInDateRange<T>(dateRange: DateRange, forEachFn: (date: Date) => T, getNextDate: (date: Date) => Date): T[];
export function iterateDaysInDateRange<T = void>(dateRange: DateRange, forEachFn: (date: Date) => T, getNextDate: (date: Date) => Date): T extends void ? void : T[] {
  return iterateDaysInDateRangeFunction(getNextDate)(dateRange, forEachFn) as any;
}

/**
 * Iterates each day in the date range, starting from the start date.
 *
 * @param dateRange
 * @param forEachFn
 */
export const forEachDayInDateRange: IterateDatesInDateRangeFunction = iterateDaysInDateRangeFunction((current) => addDays(current, 1));

export interface ExpandDaysForDateRangeConfig {
  /**
   * (Optiona) Max expansion size for expanding a date range.
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
 * Expands the input range into dates.
 *
 * @param param0
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
 * Expands the input range to the days.
 *
 * @param range
 * @returns
 */
export function expandDaysForDateRange(range: DateRange): Date[] {
  return expandDaysForDateRangeFunction({})(range);
}

/**
 * Returns the DateRelativeState from the input DateRange.
 *
 * @param param0
 * @returns
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

export function isDateInDateRange(date: Date, dateRange: Partial<DateRange>): boolean {
  return isDateInDateRangeFunction(dateRange)(date);
}

/**
 * Creates an IsDateInDateRangeFunction
 *
 * @param dateRange
 * @returns
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

export function isDateRangeInDateRange(compareDateRange: DateRange, dateRange: Partial<DateRange>): boolean {
  return isDateRangeInDateRangeFunction(dateRange)(compareDateRange);
}

/**
 * Creates an IsDateRangeInDateRangeFunction
 *
 * @param dateRange
 * @returns
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
export type DateRangeOverlapsDateRangeFunction<T extends DateRange = DateRange> = ((dateRange: DateRange) => boolean) & DateRangeFunctionDateRangeRef<T>;

export function dateRangeOverlapsDateRange(compareDateRange: DateRange, dateRange: DateRange): boolean {
  return dateRangeOverlapsDateRangeFunction(dateRange)(compareDateRange);
}

/**
 * Creates an DateRangeOverlapsDateRangeFunction
 *
 * @param dateRange
 * @returns
 */
export function dateRangeOverlapsDateRangeFunction<T extends DateRange = DateRange>(dateRange: T): DateRangeOverlapsDateRangeFunction<T> {
  const startTime = dateRange.start.getTime();
  const endTime = dateRange.end.getTime();

  const fn = ((input: DateRange) => {
    return input.start.getTime() <= endTime && input.end.getTime() >= startTime;
  }) as Building<DateRangeOverlapsDateRangeFunction<T>>;

  fn._dateRange = dateRange;

  return fn as DateRangeOverlapsDateRangeFunction<T>;
}

/**
 * Reduces the UTC date range to represent a 24 hour period.
 *
 * For example, a range of 10AM one day to 1PM three days later will be simplified to 10AM to 1PM.
 *
 * The order of times is retained. Date ranges that are 1PM to 10AM three days later will be simplified to 1PM to 10AM.
 *
 * For the UTC timezone, meaning changes in daylight savings are not considered.
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
 * Clamps the date to the date range. Convenience function for clampDateFunction().
 *
 * @param date
 * @param dateRange
 * @returns
 */
export function clampDateToDateRange(date: Date, dateRange: Partial<DateRange>) {
  return clampDateFunction(dateRange)(date);
}

export type ClampPartialDateRangeFunction = ((date: Partial<DateRange>, clampNullValues?: boolean) => Partial<DateRange>) & DateRangeFunctionDateRangeRef;
export type ClampDateRangeFunction = ((date: Partial<DateRange>, clampNullValues?: boolean) => DateRange) & DateRangeFunctionDateRangeRef<DateRange>;

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
 * Clamps the input range to the second date range. Convenience function for clampDateRangeFunction().
 *
 * @param inputDateRange
 * @param limitToDateRange
 * @returns
 */
export function clampDateRangeToDateRange(inputDateRange: Partial<DateRange>, limitToDateRange: Partial<DateRange>) {
  return clampDateRangeFunction(limitToDateRange)(inputDateRange);
}

/**
 * Transforms both of the dates in the date range function.
 */
export type TransformDateRangeDatesFunction = (dateRange: DateRange) => DateRange;

export function transformDateRangeDatesFunction(transform: MapFunction<Date, Date>): TransformDateRangeDatesFunction {
  return ({ start, end }: DateRange) => ({
    start: transform(start),
    end: transform(end)
  });
}

/**
 * TransformDateRangeDatesFunction that transforms the input dates to the start of the day.
 */
export const transformDateRangeWithStartOfDay = transformDateRangeDatesFunction(startOfDay);

/**
 * DateRange that has values comprised of either a Date, ISO8601DateString, or ISO8601DayString
 */
export interface DateRangeWithDateOrStringValue {
  start: DateOrDateString | ISO8601DayString;
  end: DateOrDateString | ISO8601DayString;
}

/**
 * Returns each unique day of the week in the date range in the order they appear.
 *
 * @param dateRange
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
