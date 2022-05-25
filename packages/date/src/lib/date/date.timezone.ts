import { addMilliseconds } from 'date-fns';
import { MapFunction, isConsideredUtcTimezoneString, isSameNonNullValue, Maybe, Milliseconds, TimezoneString, UTC_TIMEZONE_STRING } from '@dereekb/util';
import { getTimezoneOffset } from 'date-fns-tz';
import { minutesToMs } from './date';

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

export interface DateTimezoneConversionConfig {
  /**
   * Timezone to be relative to. If not defined, values are returned in UTC.
   */
  timezone?: TimezoneString;

  /**
   * Whether or not to use the system timezone/offset. 
   * 
   * This will convert between UTC and the current system's timezone.
   */
  useSystemTimezone?: boolean;

  /**
   * Custom timezone offset (in ms) between the "normal" and the base date.
   * 
   * Examples:
   * - UTC-6 is negative 6 hours, in milliseconds.
   */
  timezoneOffset?: Milliseconds;

}

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
  return -minutesToMs(date.getTimezoneOffset());
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

export type DateTimezoneConversionMap = {
  [key: string]: number;
}

export function calculateAllConversions(date: Date, converter: DateTimezoneBaseDateConverter, map: (time: Milliseconds) => number = (x) => x): DateTimezoneConversionMap {
  const options: DateTimezoneConversionTarget[] = ['target', 'base', 'system'];
  const conversions: DateTimezoneConversionMap = {};

  options.forEach((from) => {
    options.forEach((to) => {
      if (from !== to) {
        conversions[`${from}-${to}`] = map(converter.getCurrentOffset(date, from, to));
      }
    })
  })

  return conversions;
}

type GetOffsetForDateFunction = MapFunction<Date, number>;

/**
 * Used for converting Dates to/from a UTC "base date" to a "normal date".
 * 
 * This can generally be used for converting from/to the target offset as well.
 */
export class DateTimezoneUtcNormalInstance implements DateTimezoneBaseDateConverter {

  readonly config: DateTimezoneConversionConfig;

  readonly hasConversion: boolean;
  private readonly _getOffset: DateTimezoneOffsetFunction;

  constructor(config: Maybe<TimezoneString> | DateTimezoneConversionConfig) {
    if (config == null) {
      config = UTC_TIMEZONE_STRING;
    }

    if (typeof config === 'string') {
      config = { timezone: config };
    }

    if (config.useSystemTimezone === true || config.timezoneOffset == null) {
      config.timezone = config.timezone ?? UTC_TIMEZONE_STRING;
    }

    this.config = config;

    let getOffsetInMsFn: Maybe<GetOffsetForDateFunction>;

    if (config.useSystemTimezone === true) {
      // Configure below
      getOffsetInMsFn = getCurrentSystemOffsetInMs;
    } else if (config.timezoneOffset != null) {
      getOffsetInMsFn = () => this.config.timezoneOffset as number;
    } else if (config.timezone) {
      getOffsetInMsFn = (date) => getTimezoneOffset(this.config.timezone as string, date);
    }

    const hasConversion = Boolean(getOffsetInMsFn);

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
              throw new Error(`unexpected offset target "${ target }"`);
          }

          return offset;
        }
      };
    } else {
      this._getOffset = () => 0
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
  return new DateTimezoneUtcNormalInstance({ useSystemTimezone: true }).baseDateToTargetDate(date);
}

export function systemNormalDateToBaseDate(date: Date): Date {
  return new DateTimezoneUtcNormalInstance({ useSystemTimezone: true }).targetDateToBaseDate(date);
}
