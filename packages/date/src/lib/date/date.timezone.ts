import { Maybe, TimezoneString, UTC_TIMEZONE_STRING } from '@dereekb/util';
import { addMilliseconds } from 'date-fns';
import { getTimezoneOffset } from 'date-fns-tz';

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

export interface DateTimezoneBaseDateConverter {
  normalDateToBaseDate(date: Date): Date;
  baseDateToNormalDate(date: Date): Date;
}

/**
 * Used for converting Dates to/from a UTC "base date" to a "normal date".
 */
export class DateTimezoneUtcNormalInstance implements DateTimezoneBaseDateConverter {

  readonly timezone: TimezoneString;
  readonly hasConversion: boolean;
  readonly converter: DateTimezoneBaseDateConverter;

  constructor(timezone: Maybe<TimezoneString>) {
    if (timezone && timezone !== UTC_TIMEZONE_STRING) {
      this.timezone = timezone;
      this.hasConversion = true;
      this.converter = {
        baseDateToNormalDate: (x) => {
          const offset = getTimezoneOffset(timezone, x);
          return addMilliseconds(x, -offset);
        },
        normalDateToBaseDate: (x) => {
          const offset = getTimezoneOffset(timezone, x);
          return addMilliseconds(x, offset);
        }
      };
    } else {
      this.timezone = UTC_TIMEZONE_STRING;
      this.hasConversion = false;
      this.converter = {
        baseDateToNormalDate: (x) => x,
        normalDateToBaseDate: (x) => x
      };
    }
  }

  baseDateToNormalDate(date: Date): Date {
    return this.converter.baseDateToNormalDate(date);
  }

  normalDateToBaseDate(date: Date): Date {
    return this.converter.normalDateToBaseDate(date);
  }

}

export function baseDateToNormalDate(date: Date, timezone: Maybe<TimezoneString>): Date {
  return new DateTimezoneUtcNormalInstance(timezone).baseDateToNormalDate(date);
}

export function normalDateToBaseDate(date: Date, timezone: Maybe<TimezoneString>): Date {
  return new DateTimezoneUtcNormalInstance(timezone).normalDateToBaseDate(date);
}
