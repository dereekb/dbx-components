import { type Building, makeValuesGroupMap, type MapFunction, type Maybe } from '@dereekb/util';
import { getWeek, getYear, endOfWeek, startOfMonth, endOfMonth, addWeeks, startOfWeek, setWeek, isAfter } from 'date-fns';
import { isDate } from './date';
import { type DateRange } from './date.range';
import { dateTimezoneUtcNormal, DateTimezoneUtcNormalInstance, type DateTimezoneUtcNormalInstanceInput, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from './date.timezone';

/**
 * A Week/Year number combination used to refer to a specific Week on a specific Year.
 *
 * 202201 is January 2022
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type YearWeekCode = number;

/**
 * String-version of a YearWeekCode. Usually used as a
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic string
 */
export type YearWeekCodeString = string;

/**
 * Used for default YearWeekCode values
 */
export const UNKNOWN_YEAR_WEEK_CODE = 0;

export type UnknownYearWeekCode = typeof UNKNOWN_YEAR_WEEK_CODE;

/**
 * The week in the year. Starts from 1.
 *
 * @semanticType
 * @semanticTopic date
 * @semanticTopic numeric
 */
export type YearWeekCodeIndex = number;

/**
 * Extracts the week-of-year index (1-52) from a {@link YearWeekCode}.
 *
 * @param yearWeekCode - the encoded year+week code (e.g. 202401 = week 1 of 2024)
 * @returns the week index portion
 *
 * @example
 * ```ts
 * yearWeekCodeIndex(202415); // 15
 * ```
 */
export function yearWeekCodeIndex(yearWeekCode: YearWeekCode): YearWeekCodeIndex {
  return yearWeekCode % 100;
}

/**
 * Pair of the YearWeekCodeIndex and the year.
 */
export interface YearWeekCodePair {
  week: YearWeekCodeIndex;
  year: number;
}

/**
 * Decodes a {@link YearWeekCode} into its year and week components.
 *
 * @param yearWeekCode - the encoded year+week code
 * @returns the decoded pair with year and week
 *
 * @example
 * ```ts
 * yearWeekCodePair(202415); // { year: 2024, week: 15 }
 * ```
 */
export function yearWeekCodePair(yearWeekCode: YearWeekCode): YearWeekCodePair {
  return {
    week: yearWeekCodeIndex(yearWeekCode),
    year: Math.floor(yearWeekCode / 100)
  };
}

/**
 * Creates a {@link YearWeekCodePair} from a Date using the system timezone.
 *
 * Handles year-boundary weeks correctly (e.g. Dec 31 that falls in week 1 of the next year).
 *
 * @param date - the date to compute the week pair for
 * @returns the year and week-of-year pair
 *
 * @example
 * ```ts
 * yearWeekCodePairFromDate(new Date('2024-04-15'));
 * // { year: 2024, week: 16 }
 * ```
 */
export function yearWeekCodePairFromDate(date: Date): YearWeekCodePair {
  let year: YearWeekCode;
  const week = getWeek(date);

  // check if the date is not in the previous year, in which case we need to add one.
  if (week === 1) {
    year = getYear(endOfWeek(date)); // the last day is the important one to get the year from.
  } else {
    year = getYear(date);
  }

  return {
    year,
    week
  };
}

/**
 * Encodes a {@link YearWeekCodePair} into a single {@link YearWeekCode} number.
 *
 * @param pair - the year and week to encode
 * @returns the encoded code (e.g. { year: 2024, week: 15 } => 202415)
 *
 * @example
 * ```ts
 * yearWeekCodeFromPair({ year: 2024, week: 15 }); // 202415
 * ```
 */
export function yearWeekCodeFromPair(pair: YearWeekCodePair): YearWeekCode {
  const { year, week } = pair;
  const encodedYear = year * 100;
  return encodedYear + week;
}

/**
 * Computes the {@link YearWeekCode} for a Date, optionally in a specific timezone.
 *
 * @param date - the date to compute the week code for
 * @param timezone - optional timezone (defaults to system timezone)
 * @returns the encoded year+week code
 *
 * @example
 * ```ts
 * yearWeekCodeFromDate(new Date('2024-04-15')); // 202416
 * ```
 */
export function yearWeekCodeFromDate(date: Date, timezone?: YearWeekCodeDateTimezoneInput): YearWeekCode {
  let result: YearWeekCode;

  if (timezone) {
    result = yearWeekCodeFactory({ timezone })(date);
  } else {
    result = yearWeekCodeFromPair(yearWeekCodePairFromDate(date));
  }

  return result;
}

/**
 * A function that computes a {@link YearWeekCode} from either a Date or explicit year+week values.
 */
export type YearWeekCodeFactory = ((dateOrYear: Date | number, inputWeek?: YearWeekCodeIndex) => YearWeekCode) & {
  _normal: DateTimezoneUtcNormalInstance;
};

export type YearWeekCodeDateTimezoneInput = DateTimezoneUtcNormalInstanceInput | DateTimezoneUtcNormalInstance;

export interface YearWeekCodeConfig {
  /**
   * (Optional) Input timezone configuration for a DateTimezoneUtcNormalInstance.
   *
   * Configured to use the system timezone by default.
   */
  readonly timezone?: YearWeekCodeDateTimezoneInput;
}

/**
 * Resolves a timezone input into a {@link DateTimezoneUtcNormalInstance} for use with YearWeekCode calculations.
 *
 * Falls back to the system timezone instance if the input is falsy.
 *
 * @param input - timezone string, config, or instance
 * @returns the resolved normal instance
 */
export function yearWeekCodeDateTimezoneInstance(input: YearWeekCodeDateTimezoneInput): DateTimezoneUtcNormalInstance {
  return input ? (input instanceof DateTimezoneUtcNormalInstance ? input : dateTimezoneUtcNormal(input)) : SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE;
}

/**
 * Computes the {@link YearWeekCode} from a Date (using system timezone) or from explicit year and week values.
 *
 * @param date - the date to compute the week code for
 * @returns the encoded year+week code
 *
 * @example
 * ```ts
 * yearWeekCode(new Date('2024-04-15')); // 202416
 * yearWeekCode(2024, 15);               // 202415
 * ```
 */
export function yearWeekCode(date: Date): YearWeekCode;
export function yearWeekCode(year: number, week: YearWeekCodeIndex): YearWeekCode;
export function yearWeekCode(dateOrYear: Date | number, inputWeek?: YearWeekCodeIndex): YearWeekCode {
  return yearWeekCodeFactory({ timezone: SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE })(dateOrYear, inputWeek);
}

/**
 * Creates a {@link YearWeekCodeFactory} that computes YearWeekCode values in the configured timezone.
 *
 * The factory accepts either a Date or explicit year+week values.
 *
 * @param config - optional timezone configuration (defaults to system timezone)
 * @returns a factory function for computing YearWeekCode values
 *
 * @example
 * ```ts
 * const factory = yearWeekCodeFactory({ timezone: 'America/Chicago' });
 * factory(new Date('2024-04-15')); // 202416
 * factory(2024, 15);               // 202415
 * ```
 */
export function yearWeekCodeFactory(config?: YearWeekCodeConfig): YearWeekCodeFactory {
  const normal = yearWeekCodeDateTimezoneInstance(config?.timezone);

  const result: Building<YearWeekCodeFactory> = (dateOrYear: Date | number, inputWeek?: YearWeekCodeIndex) => {
    let pair: YearWeekCodePair;

    if (isDate(dateOrYear)) {
      const normalDate = normal.systemDateToTargetDate(dateOrYear);
      pair = yearWeekCodePairFromDate(normalDate);
    } else {
      pair = {
        year: dateOrYear,
        week: inputWeek as YearWeekCodeIndex
      };
    }

    return yearWeekCodeFromPair(pair);
  };

  result._normal = normal;
  return result as YearWeekCodeFactory;
}

/**
 * Used for returning an array of YearWeekCode values for a pre-configured date range.
 */
export type YearWeekCodeForDateRangeFactory = (dateRange: DateRange) => YearWeekCode[];

/**
 * Returns all {@link YearWeekCode} values that overlap with the given date range, using the system timezone.
 *
 * @param dateRange - the date range to compute week codes for
 * @returns an array of YearWeekCode values covering the range
 */
export function yearWeekCodeForDateRange(dateRange: DateRange): YearWeekCode[] {
  return yearWeekCodeForDateRangeInTimezone(dateRange, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE);
}

/**
 * Returns all {@link YearWeekCode} values that overlap with the given date range, evaluated in the specified timezone.
 *
 * @param dateRange - the range to compute week codes for
 * @param dateRangeTimezone - the timezone context for accurate week boundary calculation
 * @returns an array of YearWeekCode values covering the range
 */
export function yearWeekCodeForDateRangeInTimezone(dateRange: DateRange, dateRangeTimezone: YearWeekCodeDateTimezoneInput): YearWeekCode[] {
  return yearWeekCodeForDateRangeFactory(yearWeekCodeFactory({ timezone: dateRangeTimezone }))(dateRange);
}

/**
 * Creates a {@link YearWeekCodeForDateRangeFactory} that computes all week codes overlapping a date range.
 *
 * @param factory - the YearWeekCodeFactory to use (defaults to system timezone)
 * @returns a factory that accepts a DateRange and returns overlapping YearWeekCode values
 */
export function yearWeekCodeForDateRangeFactory(factory: YearWeekCodeFactory = yearWeekCodeFactory()): YearWeekCodeForDateRangeFactory {
  const { _normal } = factory;

  return (dateRange: DateRange) => {
    // do in system timezone so we can use addWeeks/startOfWeek
    const start = _normal.systemDateToTargetDate(dateRange.start);
    const end = _normal.systemDateToTargetDate(dateRange.end);

    const weeks: YearWeekCode[] = [];

    let current = startOfWeek(start);

    while (!isAfter(current, end)) {
      // use yearWeekCodePairFromDate directly since current is already in target timezone form after systemDateToTargetDate
      weeks.push(yearWeekCodeFromPair(yearWeekCodePairFromDate(current)));
      current = addWeeks(current, 1);
    }

    // TODO: Add test for {"start":"2023-09-24T03:21:24.127Z","end":"2023-09-30T04:59:59.999Z"}

    return weeks;
  };
}

/**
 * Used for returning an array of YearWeekCode values for a pre-configured date range.
 */
export type YearWeekCodeForCalendarMonthFactory = (date: Date) => YearWeekCode[];

/**
 * Returns all {@link YearWeekCode} values for the calendar month containing the given date, using the system timezone.
 *
 * @param date - a date within the target month
 * @returns an array of YearWeekCode values for the month
 */
export function yearWeekCodeForCalendarMonth(date: Date): YearWeekCode[] {
  return yearWeekCodeForCalendarMonthFactory(yearWeekCodeFactory({ timezone: SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE }))(date);
}

/**
 * Creates a {@link YearWeekCodeForCalendarMonthFactory} that computes all week codes for a calendar month.
 *
 * @param factory - the YearWeekCodeFactory to use (defaults to system timezone)
 * @returns a factory that accepts a Date and returns YearWeekCode values for that month
 */
export function yearWeekCodeForCalendarMonthFactory(factory: YearWeekCodeFactory = yearWeekCodeFactory()): YearWeekCodeForCalendarMonthFactory {
  const { _normal } = factory;
  const dateRangeFactory = yearWeekCodeForDateRangeFactory(factory);

  return (date: Date) => {
    const normalDate = _normal.systemDateToTargetDate(date);
    const start = startOfMonth(endOfWeek(normalDate));

    const normalEnd = endOfWeek(endOfMonth(start));
    const end = _normal.targetDateToSystemDate(normalEnd);
    return dateRangeFactory({ start, end });
  };
}

/**
 * A function that converts a {@link YearWeekCode} back to the start-of-week Date.
 */
export type YearWeekCodeDateFactory = (yearWeekCode: YearWeekCode) => Date;

export type YearWeekCodeDateConfig = Pick<YearWeekCodeConfig, 'timezone'>;

/**
 * Creates a factory that converts a {@link YearWeekCode} back into the start-of-week Date for that week.
 *
 * @param config - optional timezone configuration
 * @returns a function that converts a YearWeekCode to its corresponding start-of-week Date
 *
 * @example
 * ```ts
 * const toDate = yearWeekCodeDateFactory({ timezone: 'America/Chicago' });
 * const weekStart = toDate(202415); // Sunday of week 15, 2024
 * ```
 */
export function yearWeekCodeDateFactory(config?: YearWeekCodeDateConfig): YearWeekCodeDateFactory {
  const normal = yearWeekCodeDateTimezoneInstance(config?.timezone);
  return (yearWeekCode: YearWeekCode) => {
    const pair = yearWeekCodePair(yearWeekCode);
    const utcYearDate = new Date(Date.UTC(pair.year, 0, 1, 0, 0, 0, 0));
    const systemYearDate = normal.systemDateToBaseDate(utcYearDate); // convert to system before using system date functions
    const date = startOfWeek(setWeek(systemYearDate, pair.week));
    // back to timezone
    return normal.targetDateToSystemDate(date);
  };
}

/**
 * Returns the start-of-week Date for the given {@link YearWeekCode}, optionally in a specific timezone.
 *
 * @param yearWeekCode - the encoded year+week code
 * @param timezone - optional timezone (defaults to system timezone)
 * @returns the Date at the start of the specified week
 *
 * @example
 * ```ts
 * startOfWeekForYearWeekCode(202415); // Sunday of week 15, 2024
 * ```
 */
export function startOfWeekForYearWeekCode(yearWeekCode: YearWeekCode, timezone?: YearWeekCodeDateTimezoneInput): Date {
  return yearWeekCodeDateFactory({ timezone })(yearWeekCode);
}

/**
 * Values grouped by a YearWeekCode value.
 */
export interface YearWeekCodeGroup<B> {
  readonly items: B[];
  readonly week: YearWeekCode;
}

/**
 * Used to group the input items into an array of YearWeekCodeGroup values.
 */
export type YearWeekCodeGroupFactory<B> = (items: B[]) => YearWeekCodeGroup<B>[];

/**
 * MapFunction that reads the relevant date to use for the YearWeekCode calculation from the input item.
 */
export type YearWeekCodeDateReader<B> = MapFunction<B, Maybe<Date | YearWeekCode | YearWeekCodeString>>;
export type YearWeekCodeReader = MapFunction<YearWeekCode | YearWeekCodeString, YearWeekCode>;

export interface YearWeekCodeGroupFactoryConfig<B> {
  readonly yearWeekCodeFactory?: YearWeekCodeFactory | YearWeekCodeConfig;
  readonly yearWeekCodeReader?: YearWeekCodeReader;
  readonly dateReader: YearWeekCodeDateReader<B>;
}

/**
 * Creates a {@link YearWeekCodeGroupFactory} that groups items by their {@link YearWeekCode}.
 *
 * Uses the configured date reader to extract a date or week code from each item, then groups items that share the same week.
 *
 * @param config - reader and factory configuration
 * @returns a factory that groups input items by YearWeekCode
 *
 * @example
 * ```ts
 * const group = yearWeekCodeGroupFactory({
 *   dateReader: (item) => item.date,
 * });
 * const groups = group([{ date: new Date('2024-04-15') }, { date: new Date('2024-04-16') }]);
 * // groups[0].week === 202416, groups[0].items has both items
 * ```
 */
export function yearWeekCodeGroupFactory<B>(config: YearWeekCodeGroupFactoryConfig<B>): YearWeekCodeGroupFactory<B> {
  const { yearWeekCodeFactory: factoryInput, yearWeekCodeReader: readerInput, dateReader } = config;
  const readJobWeekYear = typeof factoryInput === 'function' ? factoryInput : yearWeekCodeFactory(factoryInput);
  const yearWeekCodeReader = typeof readerInput === 'function' ? readerInput : Number;

  return (items: B[]) => {
    const map = makeValuesGroupMap(items, (item: B) => {
      let yearWeekCode: Maybe<YearWeekCode>;
      const date = dateReader(item);

      if (date != null) {
        if (isDate(date)) {
          yearWeekCode = readJobWeekYear(date);
        } else {
          yearWeekCode = yearWeekCodeReader(date);
        }
      }

      return yearWeekCode;
    });

    const groups: YearWeekCodeGroup<B>[] = Array.from(map.entries()).map(([week, items]) => {
      return {
        week: week ?? 0,
        items
      };
    });

    return groups;
  };
}
