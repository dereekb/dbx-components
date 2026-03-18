import { type Building, type DayOfMonth, makeDateMonthForMonthOfYear, makeValuesGroupMap, type MapFunction, type Maybe, type MonthOfYear, monthOfYearFromDate, type YearNumber } from '@dereekb/util';
import { isDate } from 'date-fns';
import { type DateOrDateRange, dateOrDateRangeToDateRange, forEachDayInDateRange } from './date.range';
import { dateTimezoneUtcNormal, DateTimezoneUtcNormalInstance, type DateTimezoneUtcNormalInstanceInput, SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE } from './date.timezone';

/**
 * Encodes a calendar date as a single YYYYMMDD integer for efficient date-day comparisons and grouping.
 *
 * The encoding uses `year * 10000 + month * 100 + day`, so January 1st 2022 becomes `20220101`.
 * This allows simple numeric comparisons to determine chronological order between dates.
 */
export type YearMonthDayCode = number;

/**
 * Sentinel value representing an unset or unknown date. Used as a default/fallback
 * when a valid YearMonthDayCode is not available.
 */
export const UNKNOWN_YEAR_MONTH_DAY_CODE = 0;

/**
 * Type representing the sentinel unknown/unset YearMonthDayCode value (0).
 */
export type UnknownYearMonthDayCode = typeof UNKNOWN_YEAR_MONTH_DAY_CODE;

/**
 * Decomposed representation of a {@link YearMonthDayCode} as individual year, month, and day fields.
 * Useful when the individual date components need to be accessed or manipulated independently.
 */
export interface YearMonthDayCodePair {
  day: number;
  month: number;
  year: number;
}

/**
 * Extracts the year component from a {@link YearMonthDayCode} by dividing out the month and day digits.
 *
 * @param yearMonthDayCode - Encoded YYYYMMDD value to extract the year from
 */
export function yearMonthDayCodeYear(yearMonthDayCode: YearMonthDayCode): YearNumber {
  return Math.floor(yearMonthDayCode / 10000);
}

/**
 * Extracts the month component (1-12) from a {@link YearMonthDayCode} by isolating the middle two digits.
 *
 * @param yearMonthDayCode - Encoded YYYYMMDD value to extract the month from
 */
export function yearMonthDayCodeMonth(yearMonthDayCode: YearMonthDayCode): MonthOfYear {
  return Math.floor((yearMonthDayCode % 10000) / 100);
}

/**
 * Extracts the day-of-month component (1-31) from a {@link YearMonthDayCode} by isolating the last two digits.
 *
 * @param yearMonthDayCode - Encoded YYYYMMDD value to extract the day from
 */
export function yearMonthDayCodeDay(yearMonthDayCode: YearMonthDayCode): DayOfMonth {
  return yearMonthDayCode % 100;
}

/**
 * Decomposes a {@link YearMonthDayCode} into its individual year, month, and day components.
 *
 * @param yearMonthDayCode - Encoded YYYYMMDD value to decompose
 */
export function yearMonthDayCodePair(yearMonthDayCode: YearMonthDayCode): YearMonthDayCodePair {
  return {
    year: yearMonthDayCodeYear(yearMonthDayCode),
    month: yearMonthDayCodeMonth(yearMonthDayCode),
    day: yearMonthDayCodeDay(yearMonthDayCode)
  };
}

/**
 * Creates a {@link YearMonthDayCodePair} by reading year, month, and day directly from the Date
 * using the system's local timezone. No timezone normalization is applied here; callers
 * that need timezone-aware conversion should use {@link yearMonthDayCodeFactory} instead.
 *
 * @param date - Date to extract components from using local timezone
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
 * Encodes a {@link YearMonthDayCodePair} into a single {@link YearMonthDayCode} integer
 * using the formula `year * 10000 + month * 100 + day`.
 *
 * @param pair - Decomposed date components to encode
 */
export function yearMonthDayCodeFromPair(pair: YearMonthDayCodePair): YearMonthDayCode {
  const { year, month, day } = pair;
  const encodedYear = year * 10000;
  const encodedMonth = month * 100;
  return encodedYear + encodedMonth + day;
}

/**
 * Convenience function that converts a Date directly to a {@link YearMonthDayCode}
 * using the system's local timezone. For timezone-aware conversion, use {@link yearMonthDayCodeFactory}.
 *
 * @param date - Date to encode using local timezone
 */
export function yearMonthDayCodeFromDate(date: Date): YearMonthDayCode {
  return yearMonthDayCodeFromPair(yearMonthDayCodePairFromDate(date));
}

/**
 * Timezone-aware function that converts either a Date or explicit year/month/day components
 * into a {@link YearMonthDayCode}. Exposes its internal {@link DateTimezoneUtcNormalInstance}
 * via `_normal` so related utilities can share the same timezone configuration.
 */
export type YearMonthDayCodeFactory = ((dateOrYear: Date | number, month?: MonthOfYear, day?: DayOfMonth) => YearMonthDayCode) & {
  _normal: DateTimezoneUtcNormalInstance;
};

/**
 * Accepted timezone input for YearMonthDayCode utilities. Can be either raw configuration
 * for creating a {@link DateTimezoneUtcNormalInstance} or an existing instance to reuse.
 */
export type YearMonthDayCodeDateTimezoneInput = DateTimezoneUtcNormalInstanceInput | DateTimezoneUtcNormalInstance;

/**
 * Configuration for creating timezone-aware YearMonthDayCode utilities.
 */
export interface YearMonthDayCodeConfig {
  /**
   * (Optional) Input timezone configuration for a DateTimezoneUtcNormalInstance.
   *
   * Configured to use the system timezone by default.
   */
  readonly timezone?: YearMonthDayCodeDateTimezoneInput;
}

/**
 * Resolves a {@link YearMonthDayCodeDateTimezoneInput} into a {@link DateTimezoneUtcNormalInstance},
 * falling back to the system timezone when no input is provided.
 *
 * @param input - Timezone configuration or existing instance to resolve
 */
export function yearMonthDayCodeDateTimezoneInstance(input: YearMonthDayCodeDateTimezoneInput): DateTimezoneUtcNormalInstance {
  const normal = input ? (input instanceof DateTimezoneUtcNormalInstance ? input : dateTimezoneUtcNormal(input)) : SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE;
  return normal;
}

/**
 * Converts a Date or explicit year/month/day components into a {@link YearMonthDayCode}
 * using the system timezone. This is the simplest entry point for one-off conversions;
 * for repeated conversions or custom timezones, prefer {@link yearMonthDayCodeFactory}.
 *
 * @example
 * ```ts
 * // From a Date
 * const code = yearMonthDayCode(new Date(2022, 0, 1)); // 20220101
 *
 * // From explicit components (year, month 1-12, day)
 * const code2 = yearMonthDayCode(2022, 1, 15); // 20220115
 * ```
 */
export function yearMonthDayCode(date: Date): YearMonthDayCode;
export function yearMonthDayCode(year: number, month: MonthOfYear, day: DayOfMonth): YearMonthDayCode;
export function yearMonthDayCode(dateOrYear: Date | number, month?: MonthOfYear, day?: DayOfMonth): YearMonthDayCode {
  return yearMonthDayCodeFactory({ timezone: SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE })(dateOrYear, month, day);
}

/**
 * Creates a reusable, timezone-aware {@link YearMonthDayCodeFactory}. The factory normalizes
 * dates to the configured timezone before encoding, ensuring consistent day boundaries
 * regardless of the system's local timezone.
 *
 * @example
 * ```ts
 * // Factory for America/Denver timezone
 * const toCode = yearMonthDayCodeFactory({ timezone: { timezone: 'America/Denver' } });
 * const code = toCode(new Date('2022-01-02T01:00:00Z')); // 20220101 (still Jan 1 in Denver)
 *
 * // From explicit components (no timezone normalization needed)
 * const code2 = toCode(2022, 6, 15); // 20220615
 * ```
 *
 * @param config - Optional timezone configuration; defaults to system timezone
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
 * Pre-configured function that produces an array of {@link YearMonthDayCode} values
 * for every day within a given date range, using consistent timezone normalization.
 */
export type YearMonthDayCodesForDateRangeFactory = (dateOrDateRange: DateOrDateRange) => YearMonthDayCode[];

/**
 * Returns a {@link YearMonthDayCode} for every day in the given date range using the system timezone.
 * For a single Date input, the range covers that date's full calendar month.
 * For repeated use or custom timezones, prefer {@link yearMonthDayCodesForDateRangeFactory}.
 *
 * @example
 * ```ts
 * // Get codes for a 3-day range
 * const codes = yearMonthDayCodesForDateRange({
 *   start: new Date(2022, 0, 1),
 *   end: new Date(2022, 0, 3)
 * });
 * // [20220101, 20220102, 20220103]
 * ```
 *
 * @param dateOrDateRange - A single Date (expanded to its calendar month) or an explicit date range
 */
export function yearMonthDayCodesForDateRange(dateOrDateRange: DateOrDateRange): YearMonthDayCode[] {
  return yearMonthDayCodesForDateRangeFactory(yearMonthDayCodeFactory({ timezone: SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE }))(dateOrDateRange);
}

/**
 * Creates a reusable {@link YearMonthDayCodesForDateRangeFactory} that enumerates every day
 * in a date range and returns the corresponding {@link YearMonthDayCode} values.
 * Shares timezone normalization with the provided factory for consistent day boundaries.
 *
 * @param factory - YearMonthDayCodeFactory to use for encoding; defaults to system timezone
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
 * Converts a {@link YearMonthDayCode} back into a Date, applying timezone normalization
 * to produce a Date representing midnight of that day in the configured timezone.
 */
export type YearMonthDayCodeDateFactory = (yearMonthDayCode: YearMonthDayCode) => Date;

/**
 * Configuration for {@link yearMonthDayCodeDateFactory}, controlling which timezone
 * the resulting Date objects are normalized to.
 */
export type YearMonthDayCodeDateConfig = Pick<YearMonthDayCodeConfig, 'timezone'>;

/**
 * Creates a {@link YearMonthDayCodeDateFactory} that decodes a {@link YearMonthDayCode} back
 * into a Date at midnight in the configured timezone. This is the inverse of
 * {@link yearMonthDayCodeFactory}: `yearMonthDayCodeDateFactory(cfg)(yearMonthDayCodeFactory(cfg)(date))`
 * returns a Date representing midnight of the original date's day.
 *
 * @example
 * ```ts
 * const toDate = yearMonthDayCodeDateFactory({ timezone: { timezone: 'America/Denver' } });
 * const date = toDate(20220115); // Date representing Jan 15, 2022 midnight in Denver
 * ```
 *
 * @param config - Optional timezone configuration; defaults to system timezone
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
 * A group of items that share the same {@link YearMonthDayCode}, produced by
 * {@link yearMonthDayCodeGroupFactory}. Useful for rendering day-based groupings
 * such as activity feeds or calendar views.
 */
export interface YearMonthDayCodeGroup<B> {
  readonly items: B[];
  readonly dayCode: YearMonthDayCode;
}

/**
 * Groups an array of items by their associated day, returning an array of
 * {@link YearMonthDayCodeGroup} entries. Items whose date is null/undefined
 * are grouped under {@link UNKNOWN_YEAR_MONTH_DAY_CODE}.
 */
export type YearMonthDayCodeGroupFactory<B> = (items: B[]) => YearMonthDayCodeGroup<B>[];

/**
 * Extracts the Date to use for {@link YearMonthDayCode} grouping from an item.
 * Returning null/undefined causes the item to be placed in the unknown group.
 */
export type YearMonthDayCodeDateReader<B> = MapFunction<B, Maybe<Date>>;

/**
 * Configuration for {@link yearMonthDayCodeGroupFactory}.
 */
export interface YearMonthDayCodeGroupFactoryConfig<B> {
  /**
   * Factory or config used to convert dates to day codes. Accepts either a pre-built
   * {@link YearMonthDayCodeFactory} or raw {@link YearMonthDayCodeConfig} to create one.
   */
  readonly yearMonthDayCodeFactory?: YearMonthDayCodeFactory | YearMonthDayCodeConfig;
  /**
   * Function that extracts the relevant Date from each item for day-code grouping.
   */
  readonly dateReader: YearMonthDayCodeDateReader<B>;
}

/**
 * Creates a {@link YearMonthDayCodeGroupFactory} that partitions items into day-based groups.
 * Each item's date is read via the configured `dateReader`, converted to a {@link YearMonthDayCode},
 * and used as the grouping key. Items with no date fall into the `0` (unknown) group.
 *
 * @example
 * ```ts
 * interface Event { name: string; date: Date }
 *
 * const groupByDay = yearMonthDayCodeGroupFactory<Event>({
 *   dateReader: (event) => event.date,
 *   yearMonthDayCodeFactory: { timezone: { timezone: 'America/Denver' } }
 * });
 *
 * const groups = groupByDay(events);
 * // [{ dayCode: 20220115, items: [...] }, { dayCode: 20220116, items: [...] }]
 * ```
 *
 * @param config - Grouping configuration including the date reader and optional timezone
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
