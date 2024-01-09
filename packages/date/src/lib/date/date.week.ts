import { Building, makeValuesGroupMap, MapFunction, Maybe } from '@dereekb/util';
import { getWeek, getYear, endOfWeek, startOfMonth, endOfMonth, addWeeks, startOfWeek, setWeek, isAfter } from 'date-fns';
import { isDate } from './date';
import { DateRange } from './date.range';
import { dateTimezoneUtcNormal, DateTimezoneUtcNormalInstance, DateTimezoneUtcNormalInstanceInput, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from './date.timezone';

/**
 * A Week/Year number combination used to refer to a specific Week on a specific Year.
 *
 * 202201 is January 2022
 */
export type YearWeekCode = number;

/**
 * String-version of a YearWeekCode. Usually used as a
 */
export type YearWeekCodeString = string;

/**
 * Used for default YearWeekCode values
 */
export const UNKNOWN_YEAR_WEEK_CODE = 0;

export type UnknownYearWeekCode = typeof UNKNOWN_YEAR_WEEK_CODE;

/**
 * The week in the year. Starts from 1.
 */
export type YearWeekCodeIndex = number;

/**
 * Returns the YearWeekCodeIndex for the YearWeekCode.
 *
 * @param yearWeekCode
 * @returns
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
 * Returns the YearWeekCodePair for the YearWeekCode.
 *
 * @param yearWeekCode
 * @returns
 */
export function yearWeekCodePair(yearWeekCode: YearWeekCode): YearWeekCodePair {
  return {
    week: yearWeekCodeIndex(yearWeekCode),
    year: Math.floor(yearWeekCode / 100)
  };
}

/**
 * Creates a YearWeekCodePair using the input date and the current/system timezone.
 *
 * @param date
 * @returns
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
 * Creates a YearWeekCode from the input pair.
 *
 * @param pair
 * @returns
 */
export function yearWeekCodeFromPair(pair: YearWeekCodePair): YearWeekCode {
  const { year, week } = pair;
  const encodedYear = year * 100;
  return encodedYear + week;
}

/**
 * Creates a YearWeekCode from the input Date.
 *
 * @param date
 * @returns
 */
export function yearWeekCodeFromDate(date: Date, timezone?: YearWeekCodeDateTimezoneInput): YearWeekCode {
  if (timezone) {
    // use specified timezone
    return yearWeekCodeFactory({ timezone })(date);
  } else {
    // Use system timezone
    return yearWeekCodeFromPair(yearWeekCodePairFromDate(date));
  }
}

/**
 * Used to convert the input to a YearWeekCode.
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
  timezone?: YearWeekCodeDateTimezoneInput;
}

/**
 * Creates a DateTimezoneUtcNormalInstance using the input config.
 *
 * @param input
 * @returns
 */
export function yearWeekCodeDateTimezoneInstance(input: YearWeekCodeDateTimezoneInput): DateTimezoneUtcNormalInstance {
  const normal = input ? (input instanceof DateTimezoneUtcNormalInstance ? input : dateTimezoneUtcNormal(input)) : SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE;
  return normal;
}

/**
 * Returns the yearWeekCode for the input system Date or Year/Week combo.
 *
 * @param date
 */
export function yearWeekCode(date: Date): YearWeekCode;
export function yearWeekCode(year: number, week: YearWeekCodeIndex): YearWeekCode;
export function yearWeekCode(dateOrYear: Date | number, inputWeek?: YearWeekCodeIndex): YearWeekCode {
  return yearWeekCodeFactory({ timezone: SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE })(dateOrYear, inputWeek);
}

/**
 * Creates a YearWeekCodeFactory using the optional input config.
 *
 * @param config
 * @returns
 */
export function yearWeekCodeFactory(config?: YearWeekCodeConfig): YearWeekCodeFactory {
  const normal = yearWeekCodeDateTimezoneInstance(config?.timezone);

  const result: Building<YearWeekCodeFactory> = (dateOrYear: Date | number, inputWeek?: YearWeekCodeIndex) => {
    let pair: YearWeekCodePair;

    if (isDate(dateOrYear)) {
      const normalDate = normal.systemDateToTargetDate(dateOrYear as Date);
      pair = yearWeekCodePairFromDate(normalDate);
    } else {
      pair = {
        year: dateOrYear as number,
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
 * Returns the yearWeekCodes for the input Date's calendar month.
 *
 * @param date
 */
export function yearWeekCodeForDateRange(dateRange: DateRange): YearWeekCode[] {
  return yearWeekCodeForDateRangeInTimezone(dateRange, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE);
}

/**
 * Returns the yearWeekCodes for the input date range's calendar month and evaluates those dates from the input timezone.
 *
 * The timezone of the DateRange should be passed to ensure the proper yearWeekCodes are returned.
 *
 * @param date
 */
export function yearWeekCodeForDateRangeInTimezone(dateRange: DateRange, dateRangeTimezone: YearWeekCodeDateTimezoneInput): YearWeekCode[] {
  return yearWeekCodeForDateRangeFactory(yearWeekCodeFactory({ timezone: dateRangeTimezone }))(dateRange);
}

/**
 * Create a YearWeekCodeForMonthFactory.
 *
 * @param factory
 * @returns
 */
export function yearWeekCodeForDateRangeFactory(factory: YearWeekCodeFactory = yearWeekCodeFactory()): YearWeekCodeForDateRangeFactory {
  const { _normal } = factory;

  return (dateRange: DateRange) => {
    // do in system timezone so we can use addWeeks/startOfWeek
    const start = _normal.systemDateToTargetDate(dateRange.start as Date);
    const end = _normal.systemDateToTargetDate(dateRange.end as Date);

    const weeks: YearWeekCode[] = [];

    let current = startOfWeek(start);

    while (!isAfter(current, end)) {
      const week = factory(current);
      weeks.push(week);
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
 * Returns the yearWeekCodes for the input Date's calendar month.
 *
 * The date is expected to be relative to UTC.
 *
 * @param date
 */
export function yearWeekCodeForCalendarMonth(date: Date): YearWeekCode[] {
  return yearWeekCodeForCalendarMonthFactory(yearWeekCodeFactory({ timezone: SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE }))(date);
}

/**
 * Create a YearWeekCodeForMonthFactory.
 *
 * @param factory
 * @returns
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
 * Used to convert the input to a YearWeekCode.
 */
export type YearWeekCodeDateFactory = (yearWeekCode: YearWeekCode) => Date;

export type YearWeekCodeDateConfig = Pick<YearWeekCodeConfig, 'timezone'>;

/**
 * Creates a YearWeekCodeDateFactory using the optional input config.
 *
 * @param config
 * @returns
 */
export function yearWeekCodeDateFactory(config?: YearWeekCodeDateConfig): YearWeekCodeDateFactory {
  const normal = yearWeekCodeDateTimezoneInstance(config?.timezone);
  return (yearWeekCode: YearWeekCode) => {
    const pair = yearWeekCodePair(yearWeekCode);
    const utcYearDate = new Date(Date.UTC(pair.year, 0, 1, 0, 0, 0, 0));
    const systemYearDate = normal.systemDateToBaseDate(utcYearDate); // convert to system before using system date functions
    const date = startOfWeek(setWeek(systemYearDate, pair.week));
    const fixed = normal.targetDateToSystemDate(date); // back to timezone
    return fixed;
  };
}

/**
 * Convenience function for calling yearWeekCodeDateFactory() with the input year week code and optional timezone.
 *
 * @param yearWeekCode
 * @param timezone
 * @returns
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
  yearWeekCodeFactory?: YearWeekCodeFactory | YearWeekCodeConfig;
  yearWeekCodeReader?: YearWeekCodeReader;
  dateReader: YearWeekCodeDateReader<B>;
}

/**
 * Creates a YearWeekCodeGroupFactory.
 *
 * @param config
 * @returns
 */
export function yearWeekCodeGroupFactory<B>(config: YearWeekCodeGroupFactoryConfig<B>): YearWeekCodeGroupFactory<B> {
  const { yearWeekCodeFactory: factoryInput, yearWeekCodeReader: readerInput, dateReader } = config;
  const readJobWeekYear = typeof factoryInput === 'function' ? factoryInput : yearWeekCodeFactory(factoryInput);
  const yearWeekCodeReader = typeof readerInput === 'function' ? readerInput : (x: YearWeekCode | YearWeekCodeString) => Number(x);

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
        week: week || 0,
        items
      };
    });

    return groups;
  };
}
