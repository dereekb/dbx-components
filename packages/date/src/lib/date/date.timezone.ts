import { addMilliseconds, startOfDay, endOfDay, millisecondsToHours, millisecondsToMinutes, differenceInHours, addHours } from 'date-fns';
import { parseISO8601DayStringToUTCDate, type MapFunction, isConsideredUtcTimezoneString, isSameNonNullValue, type Maybe, type Milliseconds, type TimezoneString, UTC_TIMEZONE_STRING, type ISO8601DayString, type YearNumber, type MapSameFunction, type Building, MS_IN_HOUR, type Hours, type Minutes, MS_IN_MINUTE, MS_IN_DAY, cachedGetter, type Getter, type LogicalDate } from '@dereekb/util';
import { toZonedTime, format as formatDate } from 'date-fns-tz';
import { guessCurrentTimezone, isSameDate, isStartOfDayInUTC, roundDateDownTo } from './date';
import { type DateRange, type TransformDateRangeDatesFunction, transformDateRangeDatesFunction } from './date.range';
import { dateFromLogicalDate } from './date.logical';

/**
 * A Date whose UTC components represent "wall-clock" time in an arbitrary timezone.
 *
 * Inherited from the RRule library where RRule only deals with UTC date/times, dates going into it must always be in UTC.
 * We strip the timezone concept entirely: if it's 11 AM in Los Angeles, the BaseDateAsUTC reads 11:00 UTC.
 * This lets us perform date math (start-of-day, add-hours, etc.) without worrying about DST or offset changes,
 * then convert back to a real timezone-aware date when needed via {@link DateTimezoneUtcNormalInstance.baseDateToTargetDate}.
 *
 * Three date "spaces" exist in this module:
 * - **base** — wall-clock time encoded as UTC (`BaseDateAsUTC`). Safe for arithmetic.
 * - **target** — a real instant in the configured timezone.
 * - **system** — a real instant in the host machine's local timezone.
 */
export type BaseDateAsUTC = Date;

/**
 * Configuration for a DateTimezoneConversion instance.
 *
 * If no values are defined then no conversion occurs.
 */
export interface DateTimezoneConversionConfig {
  /**
   * Whether or not to use the system timezone/offset.
   *
   * This will convert between UTC and the current system's timezone.
   */
  useSystemTimezone?: boolean;
  /**
   * Timezone to be relative to. If not defined, values are returned in UTC.
   *
   * Ignored if useSystemTimezone is true.
   */
  timezone?: Maybe<TimezoneString>;
  /**
   * Custom timezone offset (in ms) between the "normal" and the base date.
   *
   * Ignored if useSystemTimezone is true.
   *
   * Examples:
   * - UTC-6 is negative 6 hours, in milliseconds.
   */
  timezoneOffset?: Milliseconds;
  /**
   * Does not convert anything.
   */
  noConversion?: true;
}

/**
 * Returns true if the config contains at least one meaningful conversion setting
 * (useSystemTimezone, timezone, timezoneOffset, or noConversion).
 *
 * Useful for guarding against empty/default configs before creating a converter instance.
 *
 * @example
 * ```ts
 * isValidDateTimezoneConversionConfig({ timezone: 'America/Chicago' }); // true
 * isValidDateTimezoneConversionConfig({}); // false
 * ```
 *
 * @param input - the conversion config to validate
 * @returns true if the config has at least one meaningful conversion property set
 */
export function isValidDateTimezoneConversionConfig(input: DateTimezoneConversionConfig): boolean {
  return input.useSystemTimezone === true || input.timezone != null || input.timezoneOffset != null || input.noConversion === true;
}

/**
 * DateTimezoneConversionConfig only configured to use the system timezone.
 */
export type DateTimezoneConversionConfigUseSystemTimezone = {
  readonly useSystemTimezone: true;
};

/**
 * Compares two configs for logical equivalence, accounting for the fact that
 * `undefined` timezone and `'UTC'` timezone are treated as the same value.
 *
 * @example
 * ```ts
 * isSameDateTimezoneConversionConfig({ timezone: 'UTC' }, { timezone: undefined }); // true
 * isSameDateTimezoneConversionConfig({ useSystemTimezone: true }, { timezone: 'America/Denver' }); // false
 * ```
 *
 * @param a - first conversion config to compare
 * @param b - second conversion config to compare
 * @returns true if both configs are logically equivalent
 */
export function isSameDateTimezoneConversionConfig(a: DateTimezoneConversionConfig, b: DateTimezoneConversionConfig) {
  let isSame = false;

  if (a.useSystemTimezone || b.useSystemTimezone || a.timezoneOffset || b.timezoneOffset) {
    isSame = isSameNonNullValue(a.useSystemTimezone, b.useSystemTimezone) || isSameNonNullValue(a.timezoneOffset, b.timezoneOffset);
  } else {
    isSame = (isConsideredUtcTimezoneString(a.timezone) && isConsideredUtcTimezoneString(b.timezone)) || a === b;
  }

  return isSame;
}

/**
 * Returns the system timezone's UTC offset for the given date, in milliseconds.
 *
 * Sign matches the UTC convention: UTC-6 returns a negative value (-21600000).
 * The date parameter is required because DST may change the offset throughout the year.
 *
 * Uses native `getTimezoneOffset()` to avoid a DST edge case in date-fns-tz's `toZonedTime`.
 *
 * @example
 * ```ts
 * // On a system in UTC-6 (no DST)
 * getCurrentSystemOffsetInMs(new Date('2024-06-15T12:00:00Z')); // -21600000
 * ```
 *
 * @param date - required to determine the correct offset for that instant (DST-aware)
 * @returns the system timezone UTC offset in milliseconds
 */
export function getCurrentSystemOffsetInMs(date: Date): Milliseconds {
  // Use native getTimezoneOffset() instead of calculateTimezoneOffset() to avoid
  // a DST edge case where toZonedTime() creates an epoch that lands on the system's
  // DST transition boundary, causing formatDate to return the wrong hour.
  return -date.getTimezoneOffset() * MS_IN_MINUTE;
}

/**
 * Returns the system timezone's UTC offset for the given date, truncated to whole hours.
 *
 * @example
 * ```ts
 * // On a system in UTC-6
 * getCurrentSystemOffsetInHours(new Date('2024-06-15T12:00:00Z')); // -6
 * ```
 *
 * @param date - required to determine the correct offset for that instant (DST-aware)
 * @returns the system timezone UTC offset truncated to whole hours
 */
export function getCurrentSystemOffsetInHours(date: Date): Hours {
  return millisecondsToHours(getCurrentSystemOffsetInMs(date));
}

/**
 * Returns the system timezone's UTC offset for the given date, in minutes.
 *
 * Sign matches the UTC convention: UTC-6 returns -360. Useful for timezones with
 * non-hour offsets (e.g. UTC+5:30 returns 330).
 *
 * @example
 * ```ts
 * // On a system in UTC-6
 * getCurrentSystemOffsetInMinutes(new Date('2024-06-15T12:00:00Z')); // -360
 * ```
 *
 * @param date - required to determine the correct offset for that instant (DST-aware)
 * @returns the system timezone UTC offset in minutes
 */
export function getCurrentSystemOffsetInMinutes(date: Date): Minutes {
  return millisecondsToMinutes(getCurrentSystemOffsetInMs(date));
}

/**
 * Computes the UTC offset for any IANA timezone at a given instant, in milliseconds.
 *
 * Preferred over `Date.getTimezoneOffset()` and date-fns-tz's `getTimezoneOffset()` because both
 * return incorrect values during the first two hours after a DST transition.
 * See: https://github.com/marnusw/date-fns-tz/issues/227
 *
 * Sign matches the UTC convention: GMT-5 returns -18000000.
 *
 * @example
 * ```ts
 * calculateTimezoneOffset('America/Chicago', new Date('2024-06-15T12:00:00Z')); // -18000000 (UTC-5 CDT)
 * calculateTimezoneOffset('UTC', new Date()); // 0
 * ```
 *
 * @param timezone - IANA timezone string (e.g. 'America/New_York')
 * @param date - the instant to evaluate, since DST may shift the offset
 * @returns the UTC offset for the given timezone at the given instant, in milliseconds
 */
export function calculateTimezoneOffset(timezone: TimezoneString, date: Date): Milliseconds {
  let tzOffset: Milliseconds;

  // UTC always has zero offset; skip toZonedTime which can produce wrong results
  // when the shifted epoch lands on the system's DST transition boundary.
  if (isConsideredUtcTimezoneString(timezone)) {
    tzOffset = 0;
  } else {
    /*
    // BUG: There is a bug with getTimezoneOffset where the offset is not calculated properly for the first 2 hours after the DST change.
    // https://github.com/marnusw/date-fns-tz/issues/227

    const tzOffset = getTimezoneOffset(timezone, date);
    */

    /*
     * WORKAROUND: This is the current workaround. Performance hit seems negligible for all UI use cases.
     */

    // inputTimeDate.setSeconds(0);         // NOTE: setting seconds/milliseconds during the daylight savings epoch will also remove an hour
    // inputTimeDate.setMilliseconds(0);    // do not clear seconds in this way.

    const inputTimeUnrounded = date.getTime();
    const secondsAndMs = inputTimeUnrounded % MS_IN_MINUTE; // determine the number of seconds and milliseconds (prepare to round to nearest minute)
    const inputTime = inputTimeUnrounded - secondsAndMs; // remove seconds and ms as it will throw off the final tzOffset

    const zoneDate = toZonedTime(inputTime, timezone);
    const zoneDateStr = formatDate(zoneDate, 'yyyy-MM-dd HH:mm'); // ignore seconds, etc.
    const zoneDateTime = new Date(zoneDateStr + 'Z').getTime();

    tzOffset = zoneDateTime - inputTime;
  }

  return tzOffset;
}

export type DateTimezoneConversionTarget = 'target' | 'base' | 'system';

export type DateTimezoneOffsetFunction = (date: Date, from: DateTimezoneConversionTarget, to: DateTimezoneConversionTarget) => Milliseconds;

/**
 * Provides bidirectional conversions between the three date spaces: base, target, and system.
 *
 * See {@link BaseDateAsUTC} for an explanation of these spaces.
 */
export interface DateTimezoneBaseDateConverter {
  /**
   * Returns the offset in milliseconds required to convert a date from one space to another.
   */
  getCurrentOffset: DateTimezoneOffsetFunction;
  /**
   * Strips the target timezone offset, encoding the wall-clock time as a {@link BaseDateAsUTC}.
   *
   * Useful when you need to do date math (start-of-day, add-hours, etc.) without DST interference,
   * then convert back via {@link baseDateToTargetDate}.
   *
   * For example, if it is 2PM in the target timezone, the result will be 2PM UTC:
   * - Input: 2021-08-16T14:00:00.000-06:00
   * - Output: 2021-08-16T14:00:00.000Z
   */
  targetDateToBaseDate(date: Date): Date;
  /**
   * Re-interprets a target-timezone date as an instant in the system's local timezone.
   *
   * Needed when interfacing with browser/Node APIs that implicitly use the system timezone,
   * such as `startOfDay()` from date-fns.
   *
   * For example, 2PM target becomes 2PM in the system timezone:
   * - Input: 2021-08-16T14:00:00.000-06:00
   * - Output: 2021-08-16T14:00:00.000+02:00
   */
  targetDateToSystemDate(date: Date): Date;
  /**
   * Applies the target timezone offset to a {@link BaseDateAsUTC}, producing a real instant in the target timezone.
   */
  baseDateToTargetDate(date: Date): Date;
  /**
   * Converts a {@link BaseDateAsUTC} to the system's local timezone.
   */
  baseDateToSystemDate(date: Date): Date;
  /**
   * Converts a system-local date to the target timezone.
   */
  systemDateToTargetDate(date: Date): Date;
  /**
   * Converts a system-local date to a {@link BaseDateAsUTC}.
   */
  systemDateToBaseDate(date: Date): Date;
}

export type DateTimezoneConversionMap<T = number> = {
  [key: string]: T;
};

export type DateTimezoneConversionFunction<T> = MapFunction<Milliseconds, T>;

/**
 * Calculates offset values for every pair of conversion targets (target, base, system)
 * and returns them as a keyed map (e.g. `'target-base'`, `'base-system'`).
 *
 * @param date - the reference date used to compute offsets
 * @param converter - the converter instance providing offset calculations
 * @param map - optional mapping function applied to each raw millisecond offset
 * @returns a map of conversion-pair keys to their computed offset values
 */
export function calculateAllConversions<T = number>(date: Date, converter: DateTimezoneBaseDateConverter, map: DateTimezoneConversionFunction<T> = ((x: Milliseconds) => x) as unknown as DateTimezoneConversionFunction<T>): DateTimezoneConversionMap<T> {
  const options: DateTimezoneConversionTarget[] = ['target', 'base', 'system'];
  const conversions: DateTimezoneConversionMap<T> = {};

  options.forEach((from) => {
    options.forEach((to) => {
      if (from !== to) {
        conversions[`${from}-${to}`] = map(converter.getCurrentOffset(date, from, to)) as unknown as T;
      }
    });
  });

  return conversions;
}

type GetOffsetForDateFunction = MapFunction<Date, number>;

export type DateTimezoneUtcNormalInstanceInput = Maybe<TimezoneString> | DateTimezoneConversionConfig;

export type DateTimezoneUtcNormalInstanceTransformType = 'targetDateToBaseDate' | 'targetDateToSystemDate' | 'baseDateToTargetDate' | 'baseDateToSystemDate' | 'systemDateToTargetDate' | 'systemDateToBaseDate';

/**
 * Returns the reverse transform type, so a round-trip conversion can be performed.
 *
 * @example
 * ```ts
 * inverseDateTimezoneUtcNormalInstanceTransformType('targetDateToBaseDate'); // 'baseDateToTargetDate'
 * inverseDateTimezoneUtcNormalInstanceTransformType('systemDateToTargetDate'); // 'targetDateToSystemDate'
 * ```
 *
 * @param input - the transform type to invert
 * @returns the inverse transform type for round-trip conversion
 */
export function inverseDateTimezoneUtcNormalInstanceTransformType(input: DateTimezoneUtcNormalInstanceTransformType): DateTimezoneUtcNormalInstanceTransformType {
  let result: DateTimezoneUtcNormalInstanceTransformType;

  switch (input) {
    case 'baseDateToSystemDate':
      result = 'systemDateToBaseDate';
      break;
    case 'baseDateToTargetDate':
      result = 'targetDateToBaseDate';
      break;
    case 'systemDateToBaseDate':
      result = 'baseDateToSystemDate';
      break;
    case 'systemDateToTargetDate':
      result = 'targetDateToSystemDate';
      break;
    case 'targetDateToBaseDate':
      result = 'baseDateToTargetDate';
      break;
    case 'targetDateToSystemDate':
      result = 'systemDateToTargetDate';
      break;
    default:
      throw new Error(`Unexpected transform type: ${input as string}`);
  }

  return result;
}

/**
 * Configuration for {@link DateTimezoneUtcNormalInstance.safeMirroredConvertDate}.
 */
export interface SafeMirroredConvertDateConfig {
  /**
   * The base date. Should have been derived from the originalContextDate using convertDate().
   */
  readonly baseDate: BaseDateAsUTC;
  /**
   * Original date used to derive the baseDate.
   */
  readonly originalContextDate: Date;
  /**
   * The "type" of date the originalContextDate is.
   */
  readonly contextType: DateTimezoneConversionTarget;
  /**
   * Whether to apply safe DST correction. Defaults to true.
   */
  readonly safeConvert?: boolean;
}

/**
 * Central class for converting dates between the three date spaces (base, target, system).
 *
 * Wraps a timezone configuration and provides all conversion methods. Instances are typically
 * created via the {@link dateTimezoneUtcNormal} factory or by passing a config/timezone string
 * to the constructor.
 *
 * @example
 * ```ts
 * const normal = new DateTimezoneUtcNormalInstance('America/Denver');
 *
 * // Convert a target-timezone date to a BaseDateAsUTC for safe arithmetic
 * const base = normal.targetDateToBaseDate(new Date('2024-06-15T14:00:00-06:00'));
 * // base reads 14:00 UTC — the wall-clock time is preserved
 *
 * // Convert back when done
 * const target = normal.baseDateToTargetDate(base);
 * ```
 */
export class DateTimezoneUtcNormalInstance implements DateTimezoneBaseDateConverter {
  readonly config: DateTimezoneConversionConfig;
  readonly hasConversion: boolean;

  get hasConfiguredTimezoneString() {
    return this.config.timezone != null;
  }

  get usesSystemTimezone() {
    return this.config.useSystemTimezone === true;
  }

  get configuredTimezoneString(): Maybe<TimezoneString> {
    const { timezone } = this.config;
    return timezone ?? (this.config.useSystemTimezone ? guessCurrentTimezone() : undefined);
  }

  private readonly _getOffset: DateTimezoneOffsetFunction;
  private readonly _setOnDate: Getter<SetOnDateWithTimezoneNormalFunction> = cachedGetter(() => setOnDateWithTimezoneNormalFunction(this));

  constructor(config: DateTimezoneUtcNormalInstanceInput) {
    let getOffsetInMsFn: Maybe<GetOffsetForDateFunction>;

    function useTimezone(timezone: TimezoneString) {
      getOffsetInMsFn = (date) => calculateTimezoneOffset(timezone, date);
    }

    if (config == null || typeof config === 'string') {
      const timezone = config ?? UTC_TIMEZONE_STRING;
      config = { timezone };
      useTimezone(timezone);
    } else if (config.useSystemTimezone === true) {
      getOffsetInMsFn = getCurrentSystemOffsetInMs;
    } else if (config.timezoneOffset != null) {
      getOffsetInMsFn = () => this.config.timezoneOffset as number;
    } else if (config.timezone != null) {
      useTimezone(config.timezone);
    } else {
      config = { noConversion: true };
    }

    this.config = config;
    const hasConversion = !config.noConversion;

    function calculateOffset(date: Date) {
      return (getOffsetInMsFn as GetOffsetForDateFunction)(date);
    }

    function calculateSystemNormalDifference(date: Date) {
      const normalOffset = calculateOffset(date);
      const systemOffset = getCurrentSystemOffsetInMs(date);
      return -normalOffset + systemOffset;
    }

    if (hasConversion) {
      this._getOffset = function getCurrentOffset(x: Date, from: DateTimezoneConversionTarget, to: DateTimezoneConversionTarget): number {
        if (from === to) {
          return 0;
        } else {
          const target = `${from}-${to}`;
          let offset: number;

          switch (target) {
            case 'target-base':
              offset = -calculateOffset(x);
              break;
            case 'base-target':
              offset = calculateOffset(x);
              break;
            case 'target-system':
              offset = calculateSystemNormalDifference(x);
              break;
            case 'system-target':
              offset = -calculateSystemNormalDifference(x);
              break;
            case 'base-system':
              offset = getCurrentSystemOffsetInMs(x);
              break;
            case 'system-base':
              offset = -getCurrentSystemOffsetInMs(x);
              break;
            default:
              throw new Error(`unexpected offset target "${target}"`);
          }

          return offset;
        }
      };
    } else {
      this._getOffset = () => 0;
    }

    this.hasConversion = hasConversion;
  }

  convertDate(date: Date, from: DateTimezoneConversionTarget, to: DateTimezoneConversionTarget) {
    return addMilliseconds(date, this._getOffset(date, from, to));
  }

  /**
   * A "safer" conversion that will return a "mirrored" offset. Only functional with a "to" UTC value.
   *
   * This is required in cases where "reverse" offset will be used and must be consistent so they reverse in both directions the same amount compared to the base.
   *
   * For example, when daylight savings changed on November 3, 2024 the offset returned was 5 but to get back to the original an offset of 6 was required.
   * This is where some contextual data was not being used. This function uses that contextual data to make sure the reverse will be consistent.
   *
   * @param config - configuration for the safe mirrored conversion
   * @returns the converted date and the DST offset adjustment applied
   */
  safeMirroredConvertDate(config: SafeMirroredConvertDateConfig): { date: Date; daylightSavingsOffset: number } {
    const { baseDate, originalContextDate, contextType, safeConvert = true } = config;
    if (contextType === 'base') {
      return { date: baseDate, daylightSavingsOffset: 0 };
    } else {
      const reverseConversion = this.convertDate(baseDate, contextType, 'base');

      // in some cases where daylight savings ends (november 3rd),
      // the input startsAt time will not be properly recovered due to loss of timezone information
      // (cannot determine whether or not to apply the -5 or -6 offset after daylight savings ends)
      const daylightSavingsOffset = safeConvert ? differenceInHours(originalContextDate, reverseConversion) : 0;
      const date = daylightSavingsOffset ? addHours(reverseConversion, daylightSavingsOffset) : reverseConversion;

      return {
        date,
        daylightSavingsOffset
      };
    }
  }

  // MARK: DateTimezoneBaseDateConverter
  get setOnDate() {
    return this._setOnDate();
  }

  getCurrentOffset(date: Date, from: DateTimezoneConversionTarget, to: DateTimezoneConversionTarget): number {
    return this._getOffset(date, from, to);
  }

  transform(date: Date, transform: DateTimezoneUtcNormalInstanceTransformType): Date {
    return this[transform](date);
  }

  transformFunction(transform: DateTimezoneUtcNormalInstanceTransformType): MapFunction<Date, Date> {
    return (date) => this.transform(date, transform);
  }

  transformDateRangeToTimezoneFunction(transformType?: DateTimezoneUtcNormalInstanceTransformType): TransformDateRangeToTimezoneFunction {
    return transformDateRangeToTimezoneFunction(this, transformType);
  }

  targetDateToBaseDate(date: Date): Date {
    return this.convertDate(date, 'target', 'base');
  }

  baseDateToTargetDate(date: Date): Date {
    return this.convertDate(date, 'base', 'target');
  }

  baseDateToSystemDate(date: Date): Date {
    return this.convertDate(date, 'base', 'system');
  }

  systemDateToBaseDate(date: Date): Date {
    return this.convertDate(date, 'system', 'base');
  }

  targetDateToSystemDate(date: Date): Date {
    return this.convertDate(date, 'target', 'system');
  }

  systemDateToTargetDate(date: Date): Date {
    return this.convertDate(date, 'system', 'target');
  }

  getOffset(date: Date, transform: DateTimezoneUtcNormalInstanceTransformType): Milliseconds {
    return this[`${transform}Offset`](date);
  }

  getOffsetInHours(date: Date, transform: DateTimezoneUtcNormalInstanceTransformType): Hours {
    return this.getOffset(date, transform) / MS_IN_HOUR;
  }

  offsetFunction(transform: DateTimezoneUtcNormalInstanceTransformType): MapFunction<Date, Milliseconds> {
    return (date) => this.getOffset(date, transform);
  }

  targetDateToBaseDateOffset(date: Date): Milliseconds {
    return this._getOffset(date, 'target', 'base');
  }

  baseDateToTargetDateOffset(date: Date): Milliseconds {
    return this._getOffset(date, 'base', 'target');
  }

  baseDateToSystemDateOffset(date: Date): Milliseconds {
    return this._getOffset(date, 'base', 'system');
  }

  systemDateToBaseDateOffset(date: Date): Milliseconds {
    return this._getOffset(date, 'system', 'base');
  }

  targetDateToSystemDateOffset(date: Date): Milliseconds {
    return this._getOffset(date, 'target', 'system');
  }

  systemDateToTargetDateOffset(date: Date): Milliseconds {
    return this._getOffset(date, 'system', 'target');
  }

  conversionOffset(date: Date, from: DateTimezoneConversionTarget, to: DateTimezoneConversionTarget) {
    return this._getOffset(date, from, to);
  }

  calculateAllOffsets<T = number>(date: Date, map?: DateTimezoneConversionFunction<T>) {
    return calculateAllConversions<T>(date, this, map);
  }

  /**
   * Returns true if the input is midnight in the target timezone.
   *
   * @param date - the date to check
   * @returns true if the date is at the start of the day in the target timezone
   */
  isStartOfDayInTargetTimezone(date: Date): boolean {
    const utcNormal = this.baseDateToTargetDate(date);
    return isStartOfDayInUTC(utcNormal);
  }

  /**
   * Start of the given day in the target timezone.
   *
   * @param date - the input is treated as an instant in time
   * @returns the start-of-day date in the target timezone
   */
  startOfDayInTargetTimezone(date?: Date | ISO8601DayString) {
    const baseDay = this.startOfDayInBaseDate(date);
    return this.targetDateToBaseDate(baseDay);
  }

  /**
   * Start of the given day in UTC.
   *
   * @param date - the date or ISO8601 day string to get the start of day for
   * @returns the start of the day as a BaseDateAsUTC
   */
  startOfDayInBaseDate(date?: Date | ISO8601DayString): BaseDateAsUTC {
    if (typeof date === 'string') {
      return parseISO8601DayStringToUTCDate(date);
    } else {
      const startOfDayForSystem = startOfDay(date ?? new Date());
      return this.baseDateToSystemDate(startOfDayForSystem);
    }
  }

  /**
   * End of the given day in UTC.
   *
   * @param date - the date or ISO8601 day string to get the end of day for
   * @returns the end of the day as a BaseDateAsUTC (23:59:59.999)
   */
  endOfDayInBaseDate(date?: Date | ISO8601DayString): BaseDateAsUTC {
    const result = this.startOfDayInBaseDate(date);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Start of the given day for the system.
   *
   * @param date - the date or ISO8601 day string to get the start of day for
   * @returns the start of the day in the system timezone
   */
  startOfDayInSystemDate(date?: Date | ISO8601DayString): Date {
    if (typeof date === 'string') {
      const utcDate = parseISO8601DayStringToUTCDate(date);
      return this.systemDateToBaseDate(utcDate);
    } else {
      return startOfDay(date ?? new Date());
    }
  }

  /**
   * End of the given day for the system.
   *
   * @param date - the date or ISO8601 day string to get the end of day for
   * @returns the end of the day in the system timezone
   */
  endOfDayInSystemDate(date?: Date | ISO8601DayString): Date {
    return endOfDay(this.startOfDayInSystemDate(date));
  }

  /**
   * Whether or not the target timezone experiences daylight savings for the given year.
   *
   * @param year - the year to check, as a Date or number; defaults to the current year
   * @returns true if the target timezone has different offsets in January and July
   */
  targetTimezoneExperiencesDaylightSavings(year: Date | YearNumber = new Date()): boolean {
    const yearNumber = typeof year === 'number' ? year : year.getFullYear();
    const jan = new Date(yearNumber, 0, 1); // off
    const jul = new Date(yearNumber, 6, 1); // on
    return Math.abs(this.targetDateToBaseDateOffset(jul) - this.targetDateToBaseDateOffset(jan)) !== 0;
  }

  /**
   * Creates a TransformDateInTimezoneNormalFunction using this normal instance.
   *
   * @param transformType
   * @returns
   */
  transformDateInTimezoneNormalFunction(transformType?: DateTimezoneUtcNormalInstanceTransformType): TransformDateInTimezoneNormalFunction {
    return transformDateInTimezoneNormalFunction(this, transformType);
  }

  transformDateInTimezoneNormal(date: Date, transform: MapSameFunction<Date>, transformType?: DateTimezoneUtcNormalInstanceTransformType): Date {
    return this.transformDateInTimezoneNormalFunction(transformType)(date, transform);
  }

  transformDateRangeInTimezoneNormalFunction(transform?: DateTimezoneUtcNormalInstanceTransformType): TransformDateRangeInTimezoneNormalFunction {
    return transformDateRangeInTimezoneNormalFunction(this, transform);
  }
}

export type DateTimezoneUtcNormalFunctionInput = DateTimezoneUtcNormalInstanceInput | DateTimezoneUtcNormalInstance | TimezoneString | Milliseconds;

/**
 * Factory that creates or passes through a {@link DateTimezoneUtcNormalInstance}.
 *
 * Accepts a wide range of inputs for convenience: an existing instance (returned as-is),
 * a timezone string, a raw millisecond offset, or a full config object.
 *
 * @example
 * ```ts
 * // From IANA timezone string
 * const denver = dateTimezoneUtcNormal('America/Denver');
 *
 * // From millisecond offset (UTC-6)
 * const utcMinus6 = dateTimezoneUtcNormal(-6 * 60 * 60 * 1000);
 *
 * // From config object
 * const system = dateTimezoneUtcNormal({ useSystemTimezone: true });
 *
 * // Pass-through if already an instance
 * const same = dateTimezoneUtcNormal(denver); // same reference
 * ```
 *
 * @param config - timezone input: an existing instance, timezone string, millisecond offset, or config object
 * @returns a DateTimezoneUtcNormalInstance for the given input
 * @throws Error if the input type is not recognized
 */
export function dateTimezoneUtcNormal(config: DateTimezoneUtcNormalFunctionInput): DateTimezoneUtcNormalInstance {
  let instance: DateTimezoneUtcNormalInstance;

  if (config instanceof DateTimezoneUtcNormalInstance) {
    instance = config;
  } else {
    const type = typeof config;

    switch (type) {
      case 'object':
        instance = new DateTimezoneUtcNormalInstance(config as DateTimezoneUtcNormalInstanceInput);
        break;
      case 'number':
        instance = new DateTimezoneUtcNormalInstance({ timezoneOffset: config as number });
        break;
      case 'string':
        instance = new DateTimezoneUtcNormalInstance({ timezone: config as TimezoneString });
        break;
      default:
        throw new Error(`Invalid input type "${type}" passed to dateTimezoneUtcNormal()`);
    }
  }

  return instance;
}

/**
 * Singleton instance that converts between the host system's local timezone and base/target spaces.
 *
 * Uses `useSystemTimezone: true`, so offsets adjust automatically if the system timezone changes (e.g. DST).
 */
export const SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE = new DateTimezoneUtcNormalInstance({ useSystemTimezone: true });

/**
 * Singleton instance configured for UTC. All conversions are identity (offset is always 0),
 * making it a safe no-op converter for code paths that require a {@link DateTimezoneUtcNormalInstance}.
 */
export const UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE = new DateTimezoneUtcNormalInstance({ timezone: UTC_TIMEZONE_STRING });

/**
 * Returns the shared {@link SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE} singleton.
 *
 * Prefer this over constructing a new instance when you need system-timezone conversions,
 * as the singleton avoids unnecessary allocations.
 *
 * @returns the shared system-timezone DateTimezoneUtcNormalInstance singleton
 */
export function systemDateTimezoneUtcNormal(): DateTimezoneUtcNormalInstance {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE;
}

/**
 * Convenience function that applies the timezone offset to a {@link BaseDateAsUTC},
 * producing a real instant in the specified timezone.
 *
 * Creates a temporary {@link DateTimezoneUtcNormalInstance} internally; prefer
 * reusing an instance if calling this in a loop.
 *
 * @example
 * ```ts
 * const base = new Date('2024-06-15T14:00:00.000Z'); // wall-clock 2PM
 * const target = baseDateToTargetDate(base, 'America/Denver');
 * // target is 2024-06-15T14:00:00.000-06:00 (2PM MDT)
 * ```
 *
 * @param date - the BaseDateAsUTC to convert
 * @param timezone - the target IANA timezone string
 * @returns a real instant in the specified timezone
 */
export function baseDateToTargetDate(date: Date, timezone: Maybe<TimezoneString>): Date {
  const instance = new DateTimezoneUtcNormalInstance(timezone);
  return instance.baseDateToTargetDate(date);
}

/**
 * Convenience function that strips the timezone offset from a target-timezone date,
 * producing a {@link BaseDateAsUTC} whose UTC components match the original wall-clock time.
 *
 * Creates a temporary {@link DateTimezoneUtcNormalInstance} internally; prefer
 * reusing an instance if calling this in a loop.
 *
 * @example
 * ```ts
 * const target = new Date('2024-06-15T14:00:00.000-06:00'); // 2PM MDT
 * const base = targetDateToBaseDate(target, 'America/Denver');
 * // base is 2024-06-15T14:00:00.000Z — wall-clock 2PM preserved as UTC
 * ```
 *
 * @param date - the target-timezone date to convert
 * @param timezone - the IANA timezone the date is expressed in
 * @returns a BaseDateAsUTC with wall-clock time preserved as UTC
 */
export function targetDateToBaseDate(date: Date, timezone: Maybe<TimezoneString>): Date {
  return new DateTimezoneUtcNormalInstance(timezone).targetDateToBaseDate(date);
}

/**
 * Converts a {@link BaseDateAsUTC} to a target date in the system's local timezone
 * using the shared system-timezone instance.
 *
 * @param date - the BaseDateAsUTC to convert
 * @returns the date converted to the system's local timezone
 */
export function systemBaseDateToNormalDate(date: Date): BaseDateAsUTC {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.baseDateToTargetDate(date);
}

/**
 * Converts a target date in the system's local timezone back to a {@link BaseDateAsUTC}
 * using the shared system-timezone instance.
 *
 * @param date - the system-timezone target date to convert back to base
 * @returns the corresponding BaseDateAsUTC
 */
export function systemNormalDateToBaseDate(date: BaseDateAsUTC): Date {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.targetDateToBaseDate(date);
}

/**
 * Returns the millisecond offset needed to convert a {@link BaseDateAsUTC} to a target date
 * in the system's local timezone.
 *
 * @param date - the date to compute the offset for
 * @returns the offset in milliseconds
 */
export function systemBaseDateToNormalDateOffset(date: Date): Milliseconds {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.baseDateToTargetDateOffset(date);
}

/**
 * Returns the millisecond offset needed to convert a target date in the system's
 * local timezone back to a {@link BaseDateAsUTC}.
 *
 * @param date - the date to compute the offset for
 * @returns the offset in milliseconds
 */
export function systemNormalDateToBaseDateOffset(date: Date): Milliseconds {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.targetDateToBaseDateOffset(date);
}

/**
 * Returns whether the system's local timezone observes daylight saving time in the given year.
 *
 * Compares the offset on January 1 and July 1; if they differ, DST is in effect for part of the year.
 *
 * @param year - the year to check, as a Date
 * @returns true if the system timezone observes DST in the given year
 */
export function systemExperiencesDaylightSavings(year: Date): boolean {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.targetTimezoneExperiencesDaylightSavings(year);
}

// MARK: Transform Date in Normal
/**
 * Converts a date into a target date space, applies a transformation, then converts the result back.
 *
 * This pattern lets you use date-fns functions (startOfDay, addHours, etc.) as if the date were in
 * the target timezone, without timezone/DST artifacts.
 */
export type TransformDateInTimezoneNormalFunction = ((date: Date, transform: MapSameFunction<Date>) => Date) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
  readonly _transformType: DateTimezoneUtcNormalInstanceTransformType;
};

/**
 * Creates a {@link TransformDateInTimezoneNormalFunction} that converts a date into the
 * specified date space, applies a user-provided transformation, then converts back.
 *
 * @example
 * ```ts
 * const fn = transformDateInTimezoneNormalFunction('America/Denver', 'systemDateToTargetDate');
 *
 * // Get start-of-day in Denver, even if the system is in a different timezone
 * const result = fn(someDate, (d) => startOfDay(d));
 * ```
 *
 * @param timezoneInput - timezone configuration for the conversion
 * @param transformType - defaults to `'systemDateToTargetDate'`
 * @returns a function that transforms dates within the specified timezone normalization
 */
export function transformDateInTimezoneNormalFunction(timezoneInput: DateTimezoneUtcNormalFunctionInput, transformType: DateTimezoneUtcNormalInstanceTransformType = 'systemDateToTargetDate'): TransformDateInTimezoneNormalFunction {
  const timezoneInstance = dateTimezoneUtcNormal(timezoneInput);
  const transformToNormal = timezoneInstance.transformFunction(transformType);
  const transformFromNormal = timezoneInstance.transformFunction(inverseDateTimezoneUtcNormalInstanceTransformType(transformType));

  const fn = ((inputRange: Date, transform: MapSameFunction<Date>) => {
    const inputNormal = transformToNormal(inputRange);
    const normalResult = transform(inputNormal);
    return transformFromNormal(normalResult);
  }) as Building<TransformDateInTimezoneNormalFunction>;

  fn._timezoneInstance = timezoneInstance;
  fn._transformType = transformType;
  return fn as TransformDateInTimezoneNormalFunction;
}

// MARK: Transform DateRange In Normal
/**
 * Converts the start and end dates of a {@link DateRange} to a specific timezone,
 * retaining a reference to the instance and transform type used.
 */
export type TransformDateRangeToTimezoneFunction = TransformDateRangeDatesFunction & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
  readonly _transformType: DateTimezoneUtcNormalInstanceTransformType;
};

/**
 * Creates a {@link TransformDateRangeToTimezoneFunction} that converts both dates in
 * a {@link DateRange} using the specified transform type.
 *
 * @param timezoneInput - timezone configuration for the conversion
 * @param transformType - defaults to `'systemDateToTargetDate'`
 * @returns a function that converts DateRange dates using the specified transform
 */
export function transformDateRangeToTimezoneFunction(timezoneInput: DateTimezoneUtcNormalFunctionInput, transformType: DateTimezoneUtcNormalInstanceTransformType = 'systemDateToTargetDate'): TransformDateRangeToTimezoneFunction {
  const timezoneInstance = dateTimezoneUtcNormal(timezoneInput);
  const fn = transformDateRangeDatesFunction(timezoneInstance.transformFunction(transformType)) as Building<TransformDateRangeToTimezoneFunction>;
  fn._timezoneInstance = timezoneInstance;
  fn._transformType = transformType;
  return fn as TransformDateRangeToTimezoneFunction;
}

/**
 * Like {@link TransformDateInTimezoneNormalFunction} but operates on a {@link DateRange}.
 *
 * Converts the range into the target date space, applies a range transformation, then converts back.
 */
export type TransformDateRangeInTimezoneNormalFunction = ((dateRange: DateRange, transform: TransformDateRangeDatesFunction) => DateRange) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
  readonly _transformType: DateTimezoneUtcNormalInstanceTransformType;
};

/**
 * Creates a {@link TransformDateRangeInTimezoneNormalFunction} that converts a date range
 * into the specified date space, applies a user-provided range transformation, then converts back.
 *
 * @param timezoneInput - timezone configuration for the conversion
 * @param transformType - defaults to `'systemDateToTargetDate'`
 * @returns a function that transforms date ranges within the specified timezone normalization
 */
export function transformDateRangeInTimezoneNormalFunction(timezoneInput: DateTimezoneUtcNormalFunctionInput, transformType: DateTimezoneUtcNormalInstanceTransformType = 'systemDateToTargetDate'): TransformDateRangeInTimezoneNormalFunction {
  const timezoneInstance = dateTimezoneUtcNormal(timezoneInput);
  const transformToNormal = transformDateRangeDatesFunction(timezoneInstance.transformFunction(transformType));
  const transformFromNormal = transformDateRangeDatesFunction(timezoneInstance.transformFunction(inverseDateTimezoneUtcNormalInstanceTransformType(transformType)));

  const fn = ((inputRange: DateRange, transform: TransformDateRangeDatesFunction) => {
    const inputNormal = transformToNormal(inputRange);
    const normalResult = transform(inputNormal);
    return transformFromNormal(normalResult);
  }) as Building<TransformDateRangeToTimezoneFunction>;

  fn._timezoneInstance = timezoneInstance;
  fn._transformType = transformType;
  return fn as TransformDateRangeToTimezoneFunction;
}

// MARK: StartOfDayInTimezoneDayStringFactory
/**
 * Parses an {@link ISO8601DayString} (e.g. `'2024-06-15'`) and returns the start-of-day
 * instant in the configured timezone.
 */
export type StartOfDayInTimezoneDayStringFactory = (day: ISO8601DayString) => Date;

/**
 * Creates a {@link StartOfDayInTimezoneDayStringFactory} bound to the given timezone.
 *
 * @example
 * ```ts
 * const startOfDayInDenver = startOfDayInTimezoneDayStringFactory('America/Denver');
 * const midnight = startOfDayInDenver('2024-06-15');
 * // midnight is 2024-06-15T06:00:00.000Z (midnight MDT = 6AM UTC)
 * ```
 *
 * @param timezone - timezone configuration to bind the factory to
 * @returns a factory that converts ISO8601 day strings to start-of-day dates
 */
export function startOfDayInTimezoneDayStringFactory(timezone?: DateTimezoneUtcNormalFunctionInput): StartOfDayInTimezoneDayStringFactory {
  const timezoneInstance = dateTimezoneUtcNormal(timezone);
  return (day) => timezoneInstance.startOfDayInTargetTimezone(day);
}

/**
 * One-shot convenience that parses an {@link ISO8601DayString} and returns the start-of-day
 * instant in the given timezone. Creates a temporary instance internally; prefer
 * {@link startOfDayInTimezoneDayStringFactory} when processing multiple days.
 *
 * @example
 * ```ts
 * const midnight = startOfDayInTimezoneFromISO8601DayString('2024-06-15', 'America/Denver');
 * ```
 *
 * @param day - the ISO8601 day string to parse
 * @param timezone - timezone configuration for the start-of-day calculation
 * @returns the start-of-day instant in the given timezone
 */
export function startOfDayInTimezoneFromISO8601DayString(day: ISO8601DayString, timezone?: DateTimezoneUtcNormalFunctionInput): Date {
  return startOfDayInTimezoneDayStringFactory(timezone)(day);
}

// MARK: Set
export interface SetOnDateWithTimezoneNormalFunctionInput {
  /**
   * Date to update
   *
   * If not defined, will use "now".
   */
  readonly date?: Maybe<Date>;
  /**
   * The input date target type of the date and copyFrom values.
   *
   * Defaults to "target"
   */
  readonly inputType?: DateTimezoneConversionTarget;
  /**
   * The return date target type.
   *
   * Defaults to to the inputType, or to "target" if neither are defined.
   */
  readonly outputType?: DateTimezoneConversionTarget;
  /**
   * Hours to set
   */
  readonly hours?: Maybe<number>;
  /**
   * Minutes to set
   */
  readonly minutes?: Maybe<number>;
  /**
   * (Optional) date value to copy from.
   *
   * If hours or minutes are set, those values take priority over the value read from this.
   */
  readonly copyFrom?: Maybe<LogicalDate>;
  /**
   * If true, will copy the hours from the input date.
   *
   * Defaults to true.
   */
  readonly copyHours?: Maybe<boolean>;
  /**
   * If true, will copy the minutes from the input date.
   *
   * Defaults to true.
   */
  readonly copyMinutes?: Maybe<boolean>;
  /**
   * Whether or not to round down to the nearest minute.
   *
   * Defaults to false.
   */
  readonly roundDownToMinute?: Maybe<boolean>;
}

/**
 * Sets the input values on the input date.
 */
export type SetOnDateWithTimezoneNormalFunction = ((input: SetOnDateWithTimezoneNormalFunctionInput) => Date) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
};

/**
 * Creates a {@link SetOnDateWithTimezoneNormalFunction} bound to the given timezone.
 *
 * The returned function sets hours/minutes on a date while correctly handling
 * timezone conversions and DST boundaries. It converts the input to base date space,
 * applies the hour/minute changes, then converts back to the requested output space.
 *
 * @example
 * ```ts
 * const setOnDate = setOnDateWithTimezoneNormalFunction('America/Denver');
 * const result = setOnDate({ date: someDate, hours: 14, minutes: 30, inputType: 'target' });
 * // result is someDate with hours set to 14:30 in Denver time
 * ```
 *
 * @param timezone - the timezone configuration to bind to
 * @returns a function that sets hours/minutes on dates in the given timezone
 */
export function setOnDateWithTimezoneNormalFunction(timezone: DateTimezoneUtcNormalFunctionInput): SetOnDateWithTimezoneNormalFunction {
  const timezoneInstance = dateTimezoneUtcNormal(timezone);

  const fn = (input: SetOnDateWithTimezoneNormalFunctionInput) => {
    const { date: inputDate, copyFrom: copyFromInput, copyHours, copyMinutes, inputType: inputInputType, outputType, hours: inputHours, minutes: inputMinutes, roundDownToMinute } = input;
    const DEFAULT_TYPE = 'target';
    const inputType = inputInputType ?? DEFAULT_TYPE;

    let baseDate: Date;
    let copyFrom: Maybe<Date>;

    // set copyFrom
    if (copyFromInput != null) {
      copyFrom = dateFromLogicalDate(copyFromInput); // read the logical date and set initial value

      // if the input matches the copyFrom values, then skip conversion
      // this step is also crucial for returning the correct value for daylight savings ending changes
      if (inputDate != null && isSameDate(copyFrom, inputDate) && copyHours !== false && copyMinutes !== false) {
        return roundDownToMinute ? roundDateDownTo(inputDate, 'minute') : inputDate;
      }

      if (inputType !== 'base') {
        copyFrom = timezoneInstance.convertDate(copyFrom, 'base', inputType);
      }
    }

    // set baseDate
    if (inputDate != null) {
      if (inputType === 'base') {
        // use dates directly as UTC
        baseDate = inputDate;
      } else {
        baseDate = timezoneInstance.convertDate(inputDate, 'base', inputType);
      }
    } else {
      baseDate = new Date();
    }

    const hours: Maybe<number> = inputHours ?? (copyHours !== false ? copyFrom?.getUTCHours() : undefined);
    const minutes: Maybe<number> = inputMinutes ?? (copyMinutes !== false ? copyFrom?.getUTCMinutes() : undefined);

    // NOTE: We do the math this way to avoid issues surrounding daylight savings
    const time = baseDate.getTime();

    const currentDayMillseconds = time % MS_IN_DAY;
    const minutesSecondsAndMillseconds = currentDayMillseconds % MS_IN_HOUR;
    const hoursInTimeInMs = currentDayMillseconds - minutesSecondsAndMillseconds;

    const secondsAndMilliseconds = minutesSecondsAndMillseconds % MS_IN_MINUTE;
    const minutesInTime = minutesSecondsAndMillseconds - secondsAndMilliseconds;

    const nextDay = time - currentDayMillseconds;
    const nextMinutes = minutes != null ? minutes * MS_IN_MINUTE : minutesInTime;
    const nextHours = hours != null ? hours * MS_IN_HOUR : hoursInTimeInMs;

    const nextTime = nextDay + nextHours + nextMinutes + (roundDownToMinute ? 0 : secondsAndMilliseconds);
    const nextBaseDate = new Date(nextTime);
    let result: Date = timezoneInstance.convertDate(nextBaseDate, outputType ?? inputType, 'base');

    // one more test to limit the "range" of the change
    // if it is over 1 day, then we can infer there is a timezone mismatch issue. It only occurs in one direction here, so we can safely
    // infer that the real valid result can be derived by subtracting one day
    const inputToResultDifferenceInHours = inputDate != null ? differenceInHours(result, inputDate) : 0;

    if (inputToResultDifferenceInHours >= 24) {
      result = addHours(result, -24);
    }

    return result;
  };
  fn._timezoneInstance = timezoneInstance;
  return fn;
}

// MARK: Timezone Utilities
/**
 * Copies the current wall-clock hours and minutes (from "now") onto the input date,
 * respecting the given timezone. Shorthand for calling
 * {@link copyHoursAndMinutesFromDateWithTimezoneNormal} with `'now'`.
 *
 * @param input - the date whose day is preserved
 * @param timezone - the timezone context for the hour/minute interpretation
 * @returns the input date with hours and minutes set to the current time in the given timezone
 */
export function copyHoursAndMinutesFromNowWithTimezoneNormal(input: Date, timezone: DateTimezoneUtcNormalFunctionInput): Date {
  return copyHoursAndMinutesFromDateWithTimezoneNormal(input, 'now', timezone);
}

/**
 * Copies hours and minutes from `copyFrom` onto `input`, where both dates are interpreted
 * in the target timezone. Internally converts to base date space, applies the copy, and converts back.
 *
 * @example
 * ```ts
 * // Set the time on a Denver date to match another Denver date's time
 * const result = copyHoursAndMinutesFromDateWithTimezoneNormal(
 *   targetDate,
 *   sourceDate,
 *   'America/Denver'
 * );
 * ```
 *
 * @param input - the date whose day is preserved
 * @param copyFrom - the date (or `'now'`) whose hours/minutes are copied
 * @param timezone - the timezone context for interpreting both dates
 * @returns the input date with hours and minutes copied from the source
 */
export function copyHoursAndMinutesFromDateWithTimezoneNormal(input: Date, copyFrom: LogicalDate, timezone: DateTimezoneUtcNormalFunctionInput): Date {
  const timezoneInstance = dateTimezoneUtcNormal(timezone);

  return timezoneInstance.setOnDate({
    date: input,
    copyFrom,
    inputType: 'target',
    copyHours: true,
    copyMinutes: true
  });
}
