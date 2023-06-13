import { DateTimezoneUtcNormalInstance, parseISO8601DayStringToDate, toJsDate, formatToISO8601DayString, formatToISO8601DateString, isSameDateHoursAndMinutes, DateRangeWithDateOrStringValue } from '@dereekb/date';
import { ISO8601DayString, Maybe } from '@dereekb/util';

export enum DbxDateTimeValueMode {
  /**
   * Value is returned/parsed as a Date.
   */
  DATE = 0,
  /**
   * Value is returned/parsed as an ISO8601DateString
   */
  DATE_STRING = 1,
  /**
   * Value is returned/parsed as an ISO8601DayString, relative to the current timezone.
   */
  DAY_STRING = 2
}

export function dbxDateTimeInputValueParseFactory(mode: DbxDateTimeValueMode, timezoneInstance: Maybe<DateTimezoneUtcNormalInstance>): (date: Maybe<Date | string>) => Maybe<Date> {
  let factory: (date: Maybe<Date | string>) => Maybe<Date>;
  let useTimezoneInstance = true;

  switch (mode) {
    case DbxDateTimeValueMode.DAY_STRING:
      factory = (x) => (typeof x === 'string' ? parseISO8601DayStringToDate(x) : x);
      useTimezoneInstance = false; // day strings do not use timezones
      break;
    case DbxDateTimeValueMode.DATE_STRING:
    case DbxDateTimeValueMode.DATE:
    default:
      factory = (x) => (x != null ? toJsDate(x) : x);
      break;
  }

  if (timezoneInstance && useTimezoneInstance) {
    const originalFactory = factory;

    factory = (input) => {
      const date = originalFactory(input);
      const result = date ? timezoneInstance.systemDateToTargetDate(date) : date;
      return result;
    };
  }

  return factory;
}

export function dbxDateTimeOutputValueFactory(mode: DbxDateTimeValueMode, timezoneInstance: Maybe<DateTimezoneUtcNormalInstance>): (date: Maybe<Date>) => Maybe<Date | string> {
  let factory: (date: Maybe<Date>) => Maybe<Date | string>;
  let useTimezoneInstance = true;

  switch (mode) {
    case DbxDateTimeValueMode.DAY_STRING:
      factory = (x) => (x != null ? formatToISO8601DayString(x) : x);
      useTimezoneInstance = false; // day strings do not use timezones
      break;
    case DbxDateTimeValueMode.DATE_STRING:
      factory = (x) => (x != null ? formatToISO8601DateString(x) : x);
      break;
    case DbxDateTimeValueMode.DATE:
    default:
      factory = (x) => x;
      break;
  }

  if (timezoneInstance && useTimezoneInstance) {
    const originalFactory = factory;

    factory = (input) => {
      const date = input ? timezoneInstance.targetDateToSystemDate(input) : input;
      const result = originalFactory(date);
      return result;
    };
  }

  return factory;
}

export function dbxDateTimeIsSameDateTimeFieldValue(a: Maybe<Date | ISO8601DayString>, b: Maybe<Date | ISO8601DayString>) {
  return a && b ? (typeof a === 'string' ? a === b : isSameDateHoursAndMinutes(a, b as Date)) : a == b;
}

export function dbxDateRangeIsSameDateRangeFieldValue(a: Maybe<DateRangeWithDateOrStringValue>, b: Maybe<DateRangeWithDateOrStringValue>) {
  return a && b ? dbxDateTimeIsSameDateTimeFieldValue(a.start, b.start) && dbxDateTimeIsSameDateTimeFieldValue(a.end, b.end) : a == b;
}
