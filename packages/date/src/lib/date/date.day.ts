import { Building, DayOfMonth, makeDateMonthForMonthOfYear, makeValuesGroupMap, MapFunction, Maybe, MonthOfYear, monthOfYearFromDate, range, YearNumber } from '@dereekb/util';
import { isDate, startOfMonth, endOfMonth } from 'date-fns';
import { DateOrDateRange, dateOrDateRangeToDateRange, forEachDayInDateRange } from './date.range';
import { dateTimezoneUtcNormal, DateTimezoneUtcNormalInstance, DateTimezoneUtcNormalInstanceInput, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from './date.timezone';

/**
 * A Day/Month/Year number combination used to refer to a specific Day on a specific Year.
 *
 * 20220101 is January 1st 2022
 */
export type YearMonthDayCode = number;

/**
 * Used for default YearMonthDay values
 */
export const UNKNOWN_YEAR_MONTH_DAY_CODE = 0;

export type UnknownYearMonthDayCode = typeof UNKNOWN_YEAR_MONTH_DAY_CODE;

/**
 * YearMonthDay values in an object.
 */
export interface YearMonthDayCodePair {
  day: number;
  month: number;
  year: number;
}

/**
 * Returns the YearNumber for the YearWeekCode.
 *
 * @param yearMonthDayCode
 * @returns
 */
export function yearMonthDayCodeYear(yearMonthDayCode: YearMonthDayCode): YearNumber {
  return Math.floor(yearMonthDayCode / 10000);
}

/**
 * Returns the MonthOfYear for the YearWeekCode.
 *
 * @param yearMonthDayCode
 * @returns
 */
export function yearMonthDayCodeMonth(yearMonthDayCode: YearMonthDayCode): MonthOfYear {
  return Math.floor((yearMonthDayCode % 10000) / 100);
}

/**
 * Returns the DayOfMonth for the YearWeekCode.
 *
 * @param yearMonthDayCode
 * @returns
 */
export function yearMonthDayCodeDay(yearMonthDayCode: YearMonthDayCode): DayOfMonth {
  return yearMonthDayCode % 100;
}

/**
 * Returns the YearMonthDayCodePair for the YearMonthDayCode.
 *
 * @param yearMonthDayCode
 * @returns
 */
export function yearMonthDayCodePair(yearMonthDayCode: YearMonthDayCode): YearMonthDayCodePair {
  return {
    year: yearMonthDayCodeYear(yearMonthDayCode),
    month: yearMonthDayCodeMonth(yearMonthDayCode),
    day: yearMonthDayCodeDay(yearMonthDayCode)
  };
}

/**
 * Creates a YearMonthDayCodePair using the input date and the current timezone.
 *
 * @param date
 * @returns
 */
export function yearMonthDayCodePairFromDate(date: Date): YearMonthDayCodePair {
  const day = date.getDate();
  const month = monthOfYearFromDate(date);
  const year = date.getFullYear();

  return {
    day,
    month,
    year
  };
}

/**
 * Creates a YearMonthDayCode from the input pair.
 *
 * @param pair
 * @returns
 */
export function yearMonthDayCodeFromPair(pair: YearMonthDayCodePair): YearMonthDayCode {
  const { year, month, day } = pair;
  const encodedYear = year * 10000;
  const encodedMonth = month * 100;
  return encodedYear + encodedMonth + day;
}

/**
 * Creates a YearMonthDayCode from the input Date.
 *
 * @param date
 * @returns
 */
export function yearMonthDayCodeFromDate(date: Date): YearMonthDayCode {
  return yearMonthDayCodeFromPair(yearMonthDayCodePairFromDate(date));
}

/**
 * Used to convert the input to a YearMonthDayCode.
 */
export type YearMonthDayCodeFactory = ((dateOrYear: Date | number, month?: MonthOfYear, day?: DayOfMonth) => YearMonthDayCode) & {
  _normal: DateTimezoneUtcNormalInstance;
};

export type YearMonthDayCodeDateTimezoneInput = DateTimezoneUtcNormalInstanceInput | DateTimezoneUtcNormalInstance;

export interface YearMonthDayCodeConfig {
  /**
   * (Optional) Input timezone configuration for a DateTimezoneUtcNormalInstance.
   *
   * Configured to use the system timezone by default.
   */
  timezone?: YearMonthDayCodeDateTimezoneInput;
}

export function yearMonthDayCodeDateTimezoneInstance(input: YearMonthDayCodeDateTimezoneInput): DateTimezoneUtcNormalInstance {
  const normal = input ? (input instanceof DateTimezoneUtcNormalInstance ? input : dateTimezoneUtcNormal(input)) : SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE;
  return normal;
}

/**
 * Returns the yearMonthDayCode for the input Date or Year/Month/Day combo.
 *
 * The date is expected to be relative to UTC.
 *
 * @param date
 */
export function yearMonthDayCode(date: Date): YearMonthDayCode;
export function yearMonthDayCode(year: number, month: MonthOfYear, day: DayOfMonth): YearMonthDayCode;
export function yearMonthDayCode(dateOrYear: Date | number, month?: MonthOfYear, day?: DayOfMonth): YearMonthDayCode {
  return yearMonthDayCodeFactory({ timezone: SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE })(dateOrYear, month, day);
}

/**
 * Creates a YearMonthDayCodeFactory using the optional input config.
 *
 * @param config
 * @returns
 */
export function yearMonthDayCodeFactory(config?: YearMonthDayCodeConfig): YearMonthDayCodeFactory {
  const normal = yearMonthDayCodeDateTimezoneInstance(config?.timezone);

  const result: Building<YearMonthDayCodeFactory> = (dateOrYear: Date | number, month?: MonthOfYear, day?: DayOfMonth) => {
    let pair: YearMonthDayCodePair;

    if (isDate(dateOrYear)) {
      const normalDate = normal.systemDateToTargetDate(dateOrYear as Date);
      pair = yearMonthDayCodePairFromDate(normalDate);
    } else {
      pair = {
        year: dateOrYear as number,
        month: month as number,
        day: day as number
      };
    }

    return yearMonthDayCodeFromPair(pair);
  };

  result._normal = normal;
  return result as YearMonthDayCodeFactory;
}

/**
 * Used for returning an array of YearMonthDayCode values for a pre-configured date range.
 */
export type YearMonthDayCodesForDateRangeFactory = (dateOrDateRange: DateOrDateRange) => YearMonthDayCode[];

/**
 * Returns the yearMonthDayCodes for the input Date's calendar month.
 *
 * The date is expected to be relative to UTC.
 *
 * @param date
 */
export function yearMonthDayCodesForDateRange(dateOrDateRange: DateOrDateRange): YearMonthDayCode[] {
  return yearMonthDayCodesForDateRangeFactory(yearMonthDayCodeFactory({ timezone: SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE }))(dateOrDateRange);
}

/**
 * Create a YearMonthDayCodesForDateRangeFactory.
 *
 * @param factory
 * @returns
 */
export function yearMonthDayCodesForDateRangeFactory(factory: YearMonthDayCodeFactory = yearMonthDayCodeFactory()): YearMonthDayCodesForDateRangeFactory {
  const { _normal } = factory;

  return (dateOrDateRange: DateOrDateRange) => {
    const dateRange = dateOrDateRangeToDateRange(dateOrDateRange);
    const start = _normal.systemDateToTargetDate(dateRange.start);
    const end = _normal.systemDateToTargetDate(dateRange.end);

    const codes: YearMonthDayCode[] = [];

    forEachDayInDateRange({ start, end }, (date) => {
      codes.push(yearMonthDayCodeFromDate(date));
    });

    return codes;
  };
}

/**
 * Used to convert the input to a YearMonthDayCode.
 */
export type YearMonthDayCodeDateFactory = (yearMonthDayCode: YearMonthDayCode) => Date;

export type YearMonthDayCodeDateConfig = Pick<YearMonthDayCodeConfig, 'timezone'>;

/**
 * Creates a YearMonthDayCodeDateFactory using the optional input config.
 *
 * @param config
 * @returns
 */
export function yearMonthDayCodeDateFactory(config?: YearMonthDayCodeDateConfig): YearMonthDayCodeDateFactory {
  const normal = yearMonthDayCodeDateTimezoneInstance(config?.timezone);
  return (yearMonthDayCode: YearMonthDayCode) => {
    const pair = yearMonthDayCodePair(yearMonthDayCode);
    const date = new Date(Date.UTC(pair.year, makeDateMonthForMonthOfYear(pair.month), pair.day, 0, 0, 0, 0));
    const fixed = normal.targetDateToBaseDate(date);
    return fixed;
  };
}

/**
 *
 */
export interface YearMonthDayCodeGroup<B> {
  readonly items: B[];
  readonly dayCode: YearMonthDayCode;
}

/**
 * Used to group the input items into an array of YearMonthDayCodeGroup values.
 */
export type YearMonthDayCodeGroupFactory<B> = (items: B[]) => YearMonthDayCodeGroup<B>[];

/**
 * MapFunction that reads the relevant date to use for the YearMonthDayCode calculation from the input item.
 */
export type YearMonthDayCodeDateReader<B> = MapFunction<B, Maybe<Date>>;

export interface YearMonthDayCodeGroupFactoryConfig<B> {
  yearMonthDayCodeFactory?: YearMonthDayCodeFactory | YearMonthDayCodeConfig;
  dateReader: YearMonthDayCodeDateReader<B>;
}

/**
 * Creates a YearMonthDayCodeGroupFactory.
 *
 * @param config
 * @returns
 */
export function yearMonthDayCodeGroupFactory<B>(config: YearMonthDayCodeGroupFactoryConfig<B>): YearMonthDayCodeGroupFactory<B> {
  const { yearMonthDayCodeFactory: factoryInput, dateReader } = config;
  const readYearMonthDayCode = typeof factoryInput === 'function' ? factoryInput : yearMonthDayCodeFactory(factoryInput);

  return (items: B[]) => {
    const map = makeValuesGroupMap(items, (item: B) => {
      let dayCode: Maybe<YearMonthDayCode>;
      const date = dateReader(item);

      if (date != null) {
        dayCode = readYearMonthDayCode(date);
      }

      return dayCode;
    });

    const groups: YearMonthDayCodeGroup<B>[] = Array.from(map.entries()).map(([dayCode, items]) => {
      return {
        dayCode: dayCode || 0,
        items
      };
    });

    return groups;
  };
}
