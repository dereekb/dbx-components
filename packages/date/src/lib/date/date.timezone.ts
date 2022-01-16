import { addMinutes } from 'date-fns';
import { isConsideredUtcTimezoneString, isSameNonNullValue, Maybe, TimezoneString, UTC_TIMEZONE_STRING } from '@dereekb/util';
import { addMilliseconds } from 'date-fns';
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

export interface DateTimezoneConversionFnConfig {

  /**
   * Uses the computed offset between the system and the timezone specified here.
   */
  betweenSystemAndOffset?: boolean;

}

export interface DateTimezoneConversionConfig {
  /**
   * Timezone to be relative to. If not defined, values are returned in UTC.
   */
  timezone?: TimezoneString;

  /**
   * Whether or not to use the system timezone/offset. 
   * 
   * This will convert between UTC and the system timezone.
   */
  useSystemTimezone?: boolean;

  /**
   * Custom timezone offset to specify for the result.
   */
  timezoneOffset?: number;

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

export function getCurrentSystemOffsetInMs(date: Date): number {
  return minutesToMs(date.getTimezoneOffset());
}

interface InternalDateTimezoneBaseDateConverter {
  getCurrentOffset(date: Date): number;
  normalDateToBaseDate(date: Date, addOffset?: number): Date;
  baseDateToNormalDate(date: Date, addOffset?: number): Date;
}

export interface DateTimezoneBaseDateConverter extends InternalDateTimezoneBaseDateConverter {
  normalDateToBaseDate(date: Date): Date;
  baseDateToNormalDate(date: Date): Date;
}

/**
 * Used for converting Dates to/from a UTC "base date" to a "normal date".
 * 
 * This can generally be used for converting from/to the target offset as well.
 */
export class DateTimezoneUtcNormalInstance implements DateTimezoneBaseDateConverter {

  readonly config: DateTimezoneConversionConfig;

  readonly hasConversion: boolean;
  private readonly _converter: InternalDateTimezoneBaseDateConverter;

  constructor(config: Maybe<TimezoneString> | DateTimezoneConversionConfig) {
    if (config == null) {
      config = UTC_TIMEZONE_STRING;
    }

    if (typeof config === 'string') {
      config = { timezone: config };
    }

    this.config = config;

    let getOffsetInMsFn: Maybe<(date: Date) => number>;

    if (config.useSystemTimezone === true) {
      // Configure below
      getOffsetInMsFn = getCurrentSystemOffsetInMs;
    } else if (config.timezoneOffset != null) {
      getOffsetInMsFn = () => this.config.timezoneOffset!;
    } else if (config.timezone) {
      getOffsetInMsFn = (date) => getTimezoneOffset(this.config.timezone!, date);
    }

    const hasConversion = Boolean(getOffsetInMsFn);

    /*
    if (hasConversion && config.betweenSystemAndOffset) {
      const baseGetOffsetInMsFn = getOffsetInMsFn!;
      getOffsetInMsFn = (date) => getCurrentSystemOffset(date) - baseGetOffsetInMsFn(date);
    }
    */

    if (hasConversion) {
      function calculateOffset(date: Date, addOffset = 0) {
        return getOffsetInMsFn!(date) + addOffset;
      }

      this._converter = {
        getCurrentOffset: getOffsetInMsFn!,
        baseDateToNormalDate: (x, addOffset) => {
          return addMilliseconds(x, -calculateOffset(x, addOffset));
        },
        normalDateToBaseDate: (x, addOffset) => {
          return addMilliseconds(x, calculateOffset(x, addOffset));
        }
      };
    } else {
      this._converter = {
        getCurrentOffset: () => 0,
        baseDateToNormalDate: (x: Date) => x,
        normalDateToBaseDate: (x: Date) => x
      };
    }

    console.log('Config: ', config);

    this.hasConversion = hasConversion;
  }

  // MARK: DateTimezoneBaseDateConverter
  getCurrentOffset(date: Date): number {
    return this._converter.getCurrentOffset(date);
  }

  baseDateToNormalDate(date: Date): Date {
    return this._converter.baseDateToNormalDate(date);
  }

  normalDateToBaseDate(date: Date): Date {
    return this._converter.normalDateToBaseDate(date);
  }

  _baseDateToNormalDate(date: Date, config: DateTimezoneConversionFnConfig): Date {
    return this._converter.baseDateToNormalDate(date, this._calculateAddFromConfig(date, config));
  }

  _normalDateToBaseDate(date: Date, config: DateTimezoneConversionFnConfig): Date {
    return this._converter.normalDateToBaseDate(date, this._calculateAddFromConfig(date, config));
  }

  _calculateAddFromConfig(date: Date, config: DateTimezoneConversionFnConfig): number {
    let add: number = 0;

    if (config.betweenSystemAndOffset) {
      add = getCurrentSystemOffsetInMs(date);
    }

    return add;
  }

}

export function baseDateToNormalDate(date: Date, timezone: Maybe<TimezoneString>): Date {
  return new DateTimezoneUtcNormalInstance(timezone).baseDateToNormalDate(date);
}

export function normalDateToBaseDate(date: Date, timezone: Maybe<TimezoneString>): Date {
  return new DateTimezoneUtcNormalInstance(timezone).normalDateToBaseDate(date);
}

export function systemBaseDateToNormalDate(date: Date): Date {
  return new DateTimezoneUtcNormalInstance({ useSystemTimezone: true }).baseDateToNormalDate(date);
}

export function systemNormalDateToBaseDate(date: Date): Date {
  return new DateTimezoneUtcNormalInstance({ useSystemTimezone: true }).normalDateToBaseDate(date);
}
