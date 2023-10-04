import { addMilliseconds, addMinutes, minutesToHours, startOfDay } from 'date-fns';
import { MapFunction, isConsideredUtcTimezoneString, isSameNonNullValue, Maybe, Milliseconds, TimezoneString, UTC_TIMEZONE_STRING, ISO8601DayString, YearNumber, MapSameFunction, Building } from '@dereekb/util';
import { getTimezoneOffset } from 'date-fns-tz';
import { copyHoursAndMinutesFromDate, guessCurrentTimezone, minutesToMs } from './date';
import { DateRange, dateRange, DateRangeInput, DateRangeType, TransformDateRangeDatesFunction, transformDateRangeDatesFunction } from './date.range';
import { parseISO8601DayStringToUTCDate } from './date.format';

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
export function getCurrentSystemOffsetInMs(date: Date): number {
  return minutesToMs(getCurrentSystemOffsetInMinutes(date));
}

/**
 * Returns the current system time offset in hours.
 *
 * @param date
 * @returns
 */
export function getCurrentSystemOffsetInHours(date: Date): number {
  return minutesToHours(getCurrentSystemOffsetInMinutes(date));
}

/**
 * Equivalent to -date.getTimezoneOffset().
 *
 * @param date
 * @returns
 */
export function getCurrentSystemOffsetInMinutes(date: Date): number {
  return -date.getTimezoneOffset();
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

  constructor(config: DateTimezoneUtcNormalInstanceInput) {
    let getOffsetInMsFn: Maybe<GetOffsetForDateFunction>;

    function useTimezone(timezone: TimezoneString) {
      getOffsetInMsFn = (date) => {
        const tzOffset = getTimezoneOffset(timezone, date);
        return tzOffset;
      };
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

    function calculateOffset(date: Date, fn = getOffsetInMsFn as GetOffsetForDateFunction) {
      const offset = fn(date);
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

          // console.log('Offset: ', { date: x, target, offset, offsetInHours: millisecondsToHours(offset) });

          return offset;
        }
      };
    } else {
      this._getOffset = () => 0;
    }

    this.hasConversion = hasConversion;
  }

  private _computeOffsetDate(date: Date, from: DateTimezoneConversionTarget, to: DateTimezoneConversionTarget) {
    return addMilliseconds(date, this._getOffset(date, from, to));
  }

  // MARK: DateTimezoneBaseDateConverter
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
    return this._computeOffsetDate(date, 'target', 'base');
  }

  baseDateToTargetDate(date: Date): Date {
    return this._computeOffsetDate(date, 'base', 'target');
  }

  baseDateToSystemDate(date: Date): Date {
    return this._computeOffsetDate(date, 'base', 'system');
  }

  systemDateToBaseDate(date: Date): Date {
    return this._computeOffsetDate(date, 'system', 'base');
  }

  targetDateToSystemDate(date: Date): Date {
    return this._computeOffsetDate(date, 'target', 'system');
  }

  systemDateToTargetDate(date: Date): Date {
    return this._computeOffsetDate(date, 'system', 'target');
  }

  getOffset(date: Date, transform: DateTimezoneUtcNormalInstanceTransformType): Milliseconds {
    return this[`${transform}Offset`](date);
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

  calculateAllOffsets<T = number>(date: Date, map?: DateTimezoneConversionFunction<T>) {
    return calculateAllConversions<T>(date, this, map);
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
  startOfDayInBaseDate(date?: Date | ISO8601DayString) {
    if (typeof date === 'string') {
      return parseISO8601DayStringToUTCDate(date);
    } else {
      const startOfDayForSystem = startOfDay(date ?? new Date());
      return this.baseDateToSystemDate(startOfDayForSystem);
    }
  }

  /**
   * Start of the given day for the system.
   *
   * @param date
   * @returns
   */
  startOfDayInSystemDate(date?: Date | ISO8601DayString) {
    if (typeof date === 'string') {
      const utcDate = parseISO8601DayStringToUTCDate(date);
      return this.systemDateToBaseDate(utcDate);
    } else {
      return startOfDay(date ?? new Date());
    }
  }

  /**
   * Whether or not the system experiences daylight savings for the given year.
   *
   * @param year
   */
  targetTimezoneExperiencesDaylightSavings(year: Date | YearNumber = new Date()): boolean {
    const yearNumber = typeof year === 'number' ? year : year.getFullYear();
    let jan = new Date(yearNumber, 0, 1); // off
    let jul = new Date(yearNumber, 6, 1); // on
    return Math.abs(this.targetDateToBaseDateOffset(jul) - this.targetDateToBaseDateOffset(jan)) !== 0;
  }

  /**
   * Creates a TransformDateInTimezoneNormalFunction using this normal instance.
   *
   * @param transform
   * @returns
   */
  transformDateInTimezoneNormalFunction(transform?: DateTimezoneUtcNormalInstanceTransformType): TransformDateInTimezoneNormalFunction {
    return transformDateInTimezoneNormalFunction(this, transform);
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

export function systemBaseDateToNormalDate(date: Date): Date {
  return SYSTEM_DATE_TIMEZONE_UTC_NORMAL_INSTANCE.baseDateToTargetDate(date);
}

export function systemNormalDateToBaseDate(date: Date): Date {
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

// MARK: Timezone Utilities
/**
 * Convenience function for calling copyHoursAndMinutesFromDatesWithTimezoneNormal() with now.
 *
 * @param input
 * @param timezone
 * @returns
 */
export function copyHoursAndMinutesFromNowWithTimezoneNormal(input: Date, timezone: DateTimezoneUtcNormalFunctionInput): Date {
  return copyHoursAndMinutesFromDateWithTimezoneNormal(input, new Date(), timezone);
}

/**
 * Converts the two input dates, which are dates in the same timezone/normal but than the current system, using the input DateTimezoneUtcNormalFunctionInput.
 *
 * This converts the dates to the system timezone normal, copies the values, then back to the original timezone normal.
 *
 * @param input
 * @param copyFrom
 * @param timezone
 */
export function copyHoursAndMinutesFromDateWithTimezoneNormal(input: Date, copyFrom: Date, timezone: DateTimezoneUtcNormalFunctionInput): Date {
  const timezoneInstance = dateTimezoneUtcNormal(timezone);

  const inputInSystemTimezone = timezoneInstance.systemDateToTargetDate(input);
  const copyFromInSystemTimezone = timezoneInstance.systemDateToTargetDate(copyFrom);

  // handle the potential system date time offset when the system's timezone offset changes between dates...
  const inputInSystemTimezoneOffset = inputInSystemTimezone.getTimezoneOffset();
  const copyFromInSystemTimezoneOffset = copyFromInSystemTimezone.getTimezoneOffset();
  const offsetDifference = inputInSystemTimezoneOffset - copyFromInSystemTimezoneOffset;

  // copy the minutes then add the offset difference to get the appropriate time.
  const copiedInSystemTimezone = addMinutes(copyHoursAndMinutesFromDate(inputInSystemTimezone, copyFromInSystemTimezone), offsetDifference);
  const result = timezoneInstance.targetDateToSystemDate(copiedInSystemTimezone);
  return result;
}

// MARK: compat
/**
 * @deprecated use copyHoursAndMinutesFromDateWithTimezoneNormal() instead.
 */
export const copyHoursAndMinutesFromDatesWithTimezoneNormal = copyHoursAndMinutesFromDateWithTimezoneNormal;
