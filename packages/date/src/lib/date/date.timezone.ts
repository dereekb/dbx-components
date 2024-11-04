import { addMilliseconds, addMinutes, minutesToHours, startOfDay, set as setDate, endOfDay, millisecondsToHours, millisecondsToMinutes, roundToNearestMinutes, differenceInHours, addHours } from 'date-fns';
import { parseISO8601DayStringToUTCDate, type MapFunction, isConsideredUtcTimezoneString, isSameNonNullValue, type Maybe, type Milliseconds, type TimezoneString, UTC_TIMEZONE_STRING, type ISO8601DayString, type YearNumber, type MapSameFunction, type Building, MS_IN_HOUR, type Hours, Minutes, MS_IN_MINUTE, Configurable, MS_IN_DAY, cachedGetter, Getter, LogicalDate } from '@dereekb/util';
import { utcToZonedTime, format as formatDate } from 'date-fns-tz';
import { copyHoursAndMinutesFromDate, guessCurrentTimezone, isSameDate, isStartOfDayInUTC, minutesToMs, requireCurrentTimezone, roundDateDownTo } from './date';
import { type DateRange, type TransformDateRangeDatesFunction, transformDateRangeDatesFunction } from './date.range';
import { dateFromLogicalDate } from './date.logical';

/**
 * Inherited from the RRule library where RRule only deals with UTC date/times, dates going into it must always be in UTC.
 *
 * We use this "weird" date when transforming an instance (11AM in Los Angeles) into a UTC date that says the same thing,
 * 11AM UTC.
 *
 * BaseDateAsUTC lets us simplify time changes and printing time strings by removing the concept of timezones, as we can now assume 2AM is always "2AM".
 *
 * When using base dates, we can target any timezone after performing date conversions without worrying about things such as daylight savings, etc.
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
 * Returns true if any DateTimezoneConversionConfig configuration value is provided.
 *
 * @param input
 * @returns
 */
export function isValidDateTimezoneConversionConfig(input: DateTimezoneConversionConfig): boolean {
  return input.useSystemTimezone || input.timezone != null || input.timezoneOffset != null || input.noConversion || false;
}

/**
 * DateTimezoneConversionConfig only configured to use the system timezone.
 */
export type DateTimezoneConversionConfigUseSystemTimezone = {
  readonly useSystemTimezone: true;
};

/**
 * Returns true if both inputs are considered equivalent.
 *
 * @param a
 * @param b
 * @returns
 */
export function isSameDateTimezoneConversionConfig(a: DateTimezoneConversionConfig, b: DateTimezoneConversionConfig) {
  let isSame = false;

  if (a.useSystemTimezone || b.useSystemTimezone || a.timezoneOffset || b.timezoneOffset) {
    isSame = isSameNonNullValue(a.useSystemTimezone, b.useSystemTimezone) || isSameNonNullValue(a.timezoneOffset, b.timezoneOffset);
  } else {
    isSame = (isConsideredUtcTimezoneString(a.timezone) && isConsideredUtcTimezoneString(b.timezone)) || (a != null && a === b);
  }

  return isSame;
}

/**
 * Returns the current offset in milliseconds.
 *
 * The offset corresponds positively with the UTC offset, so UTC-6 is negative 6 hours, in milliseconds.
 *
 * @param date Date is required to get the correct offset for the given date.
 * @returns
 */
export function getCurrentSystemOffsetInMs(date: Date): Milliseconds {
  const systemTimezone = requireCurrentTimezone();
  return calculateTimezoneOffset(systemTimezone, date);
}

/**
 * Returns the current system time offset in hours.
 *
 * @param date
 * @returns
 */
export function getCurrentSystemOffsetInHours(date: Date): Hours {
  return millisecondsToHours(getCurrentSystemOffsetInMs(date));
}

/**
 * Returns the system offset for the input date, in minutes.
 *
 * The offset corresponds positively with the UTC offset, so UTC-6 is negative 6 hours, in milliseconds.
 *
 * @param date
 * @returns
 */
export function getCurrentSystemOffsetInMinutes(date: Date): Minutes {
  return millisecondsToMinutes(getCurrentSystemOffsetInMs(date));
}

/**
 * Returns the timezone offset in milliseconds.
 *
 * This is preferential to Date.getTimezoneOffset() or date-fns's getTimezoneOffset() as those are currently wrong for the first
 * two hours when daylight savings changes.
 *
 * I.E. GMT-5 = -5 hours (in milliseconds)
 *
 * @param timezone
 * @param date
 * @returns
 */
export function calculateTimezoneOffset(timezone: TimezoneString, date: Date): Milliseconds {
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

  const zoneDate = utcToZonedTime(inputTime, timezone);
  const zoneDateStr = formatDate(zoneDate, 'yyyy-MM-dd HH:mm'); // ignore seconds, etc.
  const zoneDateTime = new Date(zoneDateStr + 'Z').getTime();

  const tzOffset = zoneDateTime - inputTime;
  return tzOffset;
}

export type DateTimezoneConversionTarget = 'target' | 'base' | 'system';

export type DateTimezoneOffsetFunction = (date: Date, from: DateTimezoneConversionTarget, to: DateTimezoneConversionTarget) => Milliseconds;

export interface DateTimezoneBaseDateConverter {
  getCurrentOffset: DateTimezoneOffsetFunction;
  /**
   * Converts the given date into a date relative to the UTC's date by
   * adding the timezone offset for the current timezone.
   *
   * This is generally used for cases where you are dealing with conversational strings, such as "2AM today". By using the base UTC date,
   * as 2PM we can get "2PM" in UTC, then convert back using baseDateToTargetDate avoid timezone conversion issues and other headaches.
   *
   * For example, if it is 2PM in the input time, the resulting time will be 2PM UTC.
   * - Input: 2021-08-16T14:00:00.000-06:00
   * - Output: 2021-08-16T14:00:00.000Z
   *
   * @param date
   * @param addOffset
   */
  targetDateToBaseDate(date: Date): Date;
  /**
   * Converts the given date into a date relative to the system's date.
   *
   * This is available for cases where the system uses Date's internal functionality (and therefore the system's timezone),
   * and conversions need to be done to/from the system time to the target timezone.
   *
   * For example, if it is 2PM in the input time, the resulting time will be 2PM in the current system time.
   * - Input: 2021-08-16T14:00:00.000-06:00
   * - Output: 2021-08-16T14:00:00.000+02:00
   *
   * @param date
   * @param addOffset
   */
  targetDateToSystemDate(date: Date): Date;
  baseDateToTargetDate(date: Date): Date;
  baseDateToSystemDate(date: Date): Date;
  systemDateToTargetDate(date: Date): Date;
  systemDateToBaseDate(date: Date): Date;
}

export type DateTimezoneConversionMap<T = number> = {
  [key: string]: T;
};

export type DateTimezoneConversionFunction<T> = MapFunction<Milliseconds, T>;

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
  }

  return result;
}

/**
 * Used for converting Dates to/from a UTC "base date" to a "normal date".
 *
 * This can generally be used for converting from/to the target offset as well.
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
      const offset = (getOffsetInMsFn as GetOffsetForDateFunction)(date);
      return offset;
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
   * @param baseDate The base date. Should have been derived from the originalContextDate using the convertDate() function
   * @param originalContextDate Original date used to derive the baseDate.
   * @param fromOrTo the "type" of date the originalContextDate is
   */
  safeMirroredConvertDate(baseDate: BaseDateAsUTC, originalContextDate: Date, contextType: DateTimezoneConversionTarget, safeConvert = true): { date: Date; daylightSavingsOffset: number } {
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
   * @param date
   */
  isStartOfDayInTargetTimezone(date: Date): boolean {
    const utcNormal = this.baseDateToTargetDate(date);
    return isStartOfDayInUTC(utcNormal);
  }

  /**
   * Start of the given day in the target timezone.
   *
   * @param date The input is treated as an instant in time.
   */
  startOfDayInTargetTimezone(date?: Date | ISO8601DayString) {
    const baseDay = this.startOfDayInBaseDate(date);
    return this.targetDateToBaseDate(baseDay);
  }

  /**
   * Start of the given day in UTC.
   *
   * @param date
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
   * @param date
   * @returns
   */
  endOfDayInBaseDate(date?: Date | ISO8601DayString): BaseDateAsUTC {
    const result = this.startOfDayInBaseDate(date);
    result.setUTCHours(23, 59, 59, 999);
    return result;
  }

  /**
   * Start of the given day for the system.
   *
   * @param date
   * @returns
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
   * @param date
   * @returns
   */
  endOfDayInSystemDate(date?: Date | ISO8601DayString): Date {
    return endOfDay(this.startOfDayInSystemDate(date));
  }

  /**
   * Whether or not the system experiences daylight savings for the given year.
   *
   * @param year
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
        throw new Error('Invalid input passed to dateTimezoneUtcNormal()');
    }
  }

  return instance;
}

/**
 * Default DateTimezoneUtcNormalInstance configured with useSystemTimezone=true
 */
export const SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE = new DateTimezoneUtcNormalInstance({ useSystemTimezone: true });

/**
 * Default DateTimezoneUtcNormalInstance configured with useSystemTimezone=true
 */
export const UTC_DATE_TIMEZONE_UTC_NORMAL_INSTANCE = new DateTimezoneUtcNormalInstance({ timezone: UTC_TIMEZONE_STRING });

/**
 * Returns a DateTimezoneUtcNormalInstance configured with useSystemTimezone=true.
 *
 * @returns
 */
export function systemDateTimezoneUtcNormal(): DateTimezoneUtcNormalInstance {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE;
}

export function baseDateToTargetDate(date: Date, timezone: Maybe<TimezoneString>): Date {
  const instance = new DateTimezoneUtcNormalInstance(timezone);
  const result = instance.baseDateToTargetDate(date);
  return result;
}

export function targetDateToBaseDate(date: Date, timezone: Maybe<TimezoneString>): Date {
  return new DateTimezoneUtcNormalInstance(timezone).targetDateToBaseDate(date);
}

export function systemBaseDateToNormalDate(date: Date): BaseDateAsUTC {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.baseDateToTargetDate(date);
}

export function systemNormalDateToBaseDate(date: BaseDateAsUTC): Date {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.targetDateToBaseDate(date);
}

export function systemBaseDateToNormalDateOffset(date: Date): Milliseconds {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.baseDateToTargetDateOffset(date);
}

export function systemNormalDateToBaseDateOffset(date: Date): Milliseconds {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.targetDateToBaseDateOffset(date);
}

export function systemExperiencesDaylightSavings(year: Date): boolean {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.targetTimezoneExperiencesDaylightSavings(year);
}

// MARK: Transform Date in Normal
/**
 * Transforms the date using a specific DateTimezoneUtcNormalInstanceTransformType type, processes a transformation in that normal, then reverses the result back to the original timezone.
 */
export type TransformDateInTimezoneNormalFunction = ((date: Date, transform: MapSameFunction<Date>) => Date) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
  readonly _transformType: DateTimezoneUtcNormalInstanceTransformType;
};

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
 * Transforms the start and end dates in a date range to a specific timezone
 */
export type TransformDateRangeToTimezoneFunction = TransformDateRangeDatesFunction & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
  readonly _transformType: DateTimezoneUtcNormalInstanceTransformType;
};

export function transformDateRangeToTimezoneFunction(timezoneInput: DateTimezoneUtcNormalFunctionInput, transformType: DateTimezoneUtcNormalInstanceTransformType = 'systemDateToTargetDate'): TransformDateRangeToTimezoneFunction {
  const timezoneInstance = dateTimezoneUtcNormal(timezoneInput);
  const fn = transformDateRangeDatesFunction(timezoneInstance.transformFunction(transformType)) as Building<TransformDateRangeToTimezoneFunction>;
  fn._timezoneInstance = timezoneInstance;
  fn._transformType = transformType;
  return fn as TransformDateRangeToTimezoneFunction;
}

/**
 * Transforms the start and end dates in a date range using a specific DateTimezoneUtcNormalInstanceTransformType type, processes a transformation in that normal, then reverses the result back to the original timezone.
 */
export type TransformDateRangeInTimezoneNormalFunction = ((dateRange: DateRange, transform: TransformDateRangeDatesFunction) => DateRange) & {
  readonly _timezoneInstance: DateTimezoneUtcNormalInstance;
  readonly _transformType: DateTimezoneUtcNormalInstanceTransformType;
};

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
 * Parses the input day to the start of the day in the given timezone.
 */
export type StartOfDayInTimezoneDayStringFactory = (day: ISO8601DayString) => Date;

export function startOfDayInTimezoneDayStringFactory(timezone?: DateTimezoneUtcNormalFunctionInput): StartOfDayInTimezoneDayStringFactory {
  const timezoneInstance = dateTimezoneUtcNormal(timezone);
  return (day) => timezoneInstance.startOfDayInTargetTimezone(day);
}

/**
 * Loads the start of the day in the given timezone.
 *
 * @param day
 * @param timezone
 * @returns
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
  readonly copyHours?: Maybe<Boolean>;
  /**
   * If true, will copy the minutes from the input date.
   *
   * Defaults to true.
   */
  readonly copyMinutes?: Maybe<Boolean>;
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
 * Creates a new SetONDateFunction using the input
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
        copyFrom = copyFrom != null ? timezoneInstance.convertDate(copyFrom, 'base', inputType) : undefined;
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
 * Convenience function for calling copyHoursAndMinutesFromDatesWithTimezoneNormal() with now.
 *
 * @param input
 * @param timezone
 * @returns
 */
export function copyHoursAndMinutesFromNowWithTimezoneNormal(input: Date, timezone: DateTimezoneUtcNormalFunctionInput): Date {
  return copyHoursAndMinutesFromDateWithTimezoneNormal(input, 'now', timezone);
}

/**
 * Converts the two input dates, which are dates in the same timezone/normal instead of the current system, using the input DateTimezoneUtcNormalFunctionInput.
 *
 * This converts the dates to the system timezone normal, copies the values, then back to the original timezone normal.
 *
 * @param input
 * @param copyFrom
 * @param timezone
 */
export function copyHoursAndMinutesFromDateWithTimezoneNormal(input: Date, copyFrom: LogicalDate, timezone: DateTimezoneUtcNormalFunctionInput): Date {
  const timezoneInstance = dateTimezoneUtcNormal(timezone);

  const result = timezoneInstance.setOnDate({
    date: input,
    copyFrom,
    inputType: 'target',
    copyHours: true,
    copyMinutes: true
  });

  return result;
}
