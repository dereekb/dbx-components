import { Building, FactoryWithRequiredInput, MapFunction, Maybe, MS_IN_DAY } from '@dereekb/util';
import { Expose, Type } from 'class-transformer';
import { IsEnum, IsOptional, IsDate, IsNumber } from 'class-validator';
import { addDays, addHours, differenceInDays, endOfDay, endOfMonth, endOfWeek, isAfter, isPast, startOfDay, startOfMinute, startOfMonth, startOfWeek, addMilliseconds, millisecondsToHours } from 'date-fns';
import { isSameDate, isDate } from './date';
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
 * Returns true if the input is a DateRange.
 *
 * @param input
 * @returns
 */
export function isDateRange(input: unknown): input is DateRange {
  return typeof input === 'object' && isDate((input as DateRange).start) && isDate((input as DateRange).end);
}

export function isSameDateRange(a: Maybe<DateRange>, b: Maybe<DateRange>): boolean {
  return isSameDate(a?.start, b?.start) && isSameDate(a?.end, b?.end);
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
   * Includes only the target day.
   */
  DAY = 'day',
  /**
   * Includes only the target week.
   */
  WEEK = 'week',
  /**
   * Includes only the target month.
   */
  MONTH = 'month',
  /**
   * Range specified in hours with the input.
   */
  HOURS_RANGE = 'hours_range',
  /**
   * Range specified in days with the input.
   */
  DAYS_RANGE = 'days_range',
  /**
   * Range specified in weeks with the input.
   */
  WEEKS_RANGE = 'weeks_range',
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

export enum DateRangeState {
  /**
   * Range has yet to start and is in the future.
   */
  FUTURE = 'future',
  /**
   * Range is in the present, but not yet ended.
   */
  PRESENT = 'present',
  /**
   * Range is in the past.
   */
  PAST = 'past'
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
  date?: Date;
  distance?: number;
}

/**
 * dateRange() input that infers duration to be a number of days, starting from the input date if applicable.
 */
export interface DateRangeDayDistanceInput {
  date?: Date;
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
export function dateRange({ type = DateRangeType.DAYS_RANGE, date = new Date(), distance, roundToMinute: inputRoundToMinute = false }: DateRangeInput, roundToMinute = inputRoundToMinute): DateRange {
  let start: Date;
  let end: Date;

  if (roundToMinute) {
    date = startOfMinute(date); // Reset to start of minute
  }

  distance = distance ?? 1;

  const hasNegativeDistance = distance < 0;

  switch (type) {
    case DateRangeType.DAY:
      start = startOfDay(date);
      end = endOfDay(date);
      break;
    case DateRangeType.WEEK:
      start = startOfWeek(date);
      end = endOfWeek(date);
      break;
    case DateRangeType.MONTH:
      start = startOfMonth(date);
      end = endOfMonth(date);
      break;
    case DateRangeType.HOURS_RANGE:
      if (hasNegativeDistance) {
        start = addHours(date, distance);
        end = date;
      } else {
        start = date;
        end = addHours(date, distance);
      }
      break;
    case DateRangeType.DAYS_RANGE:
      if (hasNegativeDistance) {
        start = addDays(date, distance);
        end = date;
      } else {
        start = date;
        end = addDays(date, distance);
      }
      break;
    case DateRangeType.WEEKS_RANGE:
      if (hasNegativeDistance) {
        start = addDays(date, distance * 7);
        end = date;
      } else {
        start = date;
        end = addDays(date, distance * 7);
      }
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
      start = startOfMonth(endOfWeek(date));
      end = endOfWeek(endOfMonth(start));
      break;
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
 * Returns the DateRangeState from the input DateRange.
 *
 * @param param0
 * @returns
 */
export function dateRangeState({ start, end }: DateRange): DateRangeState {
  if (isPast(end)) {
    return DateRangeState.PAST;
  } else if (isPast(start)) {
    return DateRangeState.PRESENT;
  } else {
    return DateRangeState.FUTURE;
  }
}

export type DateRangeFunctionDateRangeRef<T extends Partial<DateRange> = DateRange> = {
  readonly _dateRange: T;
};

/**
 * Returns true if the input date is contained within the configured DateRange or DateRangeStart.
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
    fn = ((input: Date) => false) as IsDateInDateRangeFunction<T>;
  }

  fn._dateRange = dateRange;

  return fn as IsDateInDateRangeFunction<T>;
}

/**
 * Returns true if the input DateRange is contained within the configured DateRange.
 */
export type IsDateRangeInDateRangeFunction<T extends DateRange = DateRange> = ((dateRange: DateRange) => boolean) & DateRangeFunctionDateRangeRef<T>;

export function isDateRangeInDateRange(compareDateRange: DateRange, dateRange: DateRange): boolean {
  return isDateRangeInDateRangeFunction(dateRange)(compareDateRange);
}

/**
 * Creates an IsDateRangeInDateRangeFunction
 *
 * @param dateRange
 * @returns
 */
export function isDateRangeInDateRangeFunction<T extends DateRange = DateRange>(dateRange: T): IsDateRangeInDateRangeFunction<T> {
  const startTime = dateRange.start.getTime();
  const endTime = dateRange.end.getTime();

  const fn = ((input: DateRange) => {
    return input.start.getTime() >= startTime && input.end.getTime() <= endTime;
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
 * Reduces the date range to represent a 24 hour period.
 *
 * For example, a range of 10AM one day to 1PM three days later will be simplified to 10AM to 1PM.
 *
 * The order of times is retained. Date ranges that are 1PM to 10AM three days later will be simplified to 1PM to 10AM.
 */
export function fitDateRangeToDayPeriod<T extends DateRange = DateRange>(dateRange: T): T {
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
