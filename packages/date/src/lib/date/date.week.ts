import { Building, makeValuesGroupMap, MapFunction, Maybe } from '@dereekb/util';
import { isDate, getWeek, getYear, endOfWeek, startOfMonth, endOfMonth, isBefore, addWeeks, startOfWeek, setWeek } from 'date-fns';
import { dateTimezoneUtcNormal, DateTimezoneUtcNormalInstance, DateTimezoneUtcNormalInstanceInput, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from './date.timezone';

/**
 * A Week/Year number combination used to refer to a specific Week on a specific Year.
 *
 * 202201 is January 2022
 */
export type YearWeekCode = number;

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

export function yearWeekCodeDateTimezoneInstance(input: YearWeekCodeDateTimezoneInput): DateTimezoneUtcNormalInstance {
  const normal = input ? (input instanceof DateTimezoneUtcNormalInstance ? input : dateTimezoneUtcNormal(input)) : SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE;
  return normal;
}

/**
 * Returns the yearWeekCode for the input Date or Year/Week combo.
 *
 * The date is expected to be relative to UTC.
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
    let year: number;
    let week: YearWeekCodeIndex;

    if (isDate(dateOrYear)) {
      const normalDate = normal.systemDateToTargetDate(dateOrYear as Date);
      week = getWeek(normalDate);

      // check if the date is not in the previous year, in which case we need to add one.
      if (week === 1) {
        year = getYear(endOfWeek(normalDate)); // the last day is the important one to get the year from.
      } else {
        year = getYear(normalDate);
      }
    } else {
      year = dateOrYear as number;
      week = inputWeek as YearWeekCodeIndex;
    }

    const encodedYear = year * 100;
    return encodedYear + week;
  };

  result._normal = normal;
  return result as YearWeekCodeFactory;
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

  return (date: Date) => {
    const normalDate = _normal.systemDateToTargetDate(date as Date);
    const start = startOfMonth(endOfWeek(normalDate));
    const end = endOfWeek(endOfMonth(start));

    const weeks: YearWeekCode[] = [];

    let current = start;

    while (isBefore(current, end)) {
      const week = factory(current);
      weeks.push(week);
      current = addWeeks(current, 1);
    }

    return weeks;
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
    const date = startOfWeek(setWeek(new Date(Date.UTC(pair.year, 0, 1, 0, 0, 0, 0)), pair.week));
    const fixed = normal.targetDateToSystemDate(date);
    return fixed;
  };
}

/**
 *
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
export type YearWeekCodeDateReader<B> = MapFunction<B, Maybe<Date>>;

export interface YearWeekCodeGroupFactoryConfig<B> {
  yearWeekCodeFactory?: YearWeekCodeFactory | YearWeekCodeConfig;
  dateReader: YearWeekCodeDateReader<B>;
}

/**
 * Creates a YearWeekCodeGroupFactory.
 *
 * @param config
 * @returns
 */
export function yearWeekCodeGroupFactory<B>(config: YearWeekCodeGroupFactoryConfig<B>): YearWeekCodeGroupFactory<B> {
  const { yearWeekCodeFactory: factoryInput, dateReader } = config;
  const readJobWeekYear = typeof factoryInput === 'function' ? factoryInput : yearWeekCodeFactory(factoryInput);

  return (items: B[]) => {
    const map = makeValuesGroupMap(items, (item: B) => {
      let yearWeekCode: Maybe<YearWeekCode>;
      const date = dateReader(item);

      if (date != null) {
        yearWeekCode = readJobWeekYear(date);
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

// MARK: Compat
/**
 * @deprecated use UNKNOWN_YEAR_WEEK_CODE instead.
 */
export const UNKNOWN_JOB_YEAR_WEEK = UNKNOWN_YEAR_WEEK_CODE;
