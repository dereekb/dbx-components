import { DateTimezoneUtcNormalInstance, parseISO8601DayStringToDate, toJsDate, formatToISO8601DayStringForSystem, formatToISO8601DateString, isSameDateHoursAndMinutes, DateRangeWithDateOrStringValue, parseJsDateString } from '@dereekb/date';
import { ISO8601DayString, Maybe, dateFromMinuteOfDay, dateToMinuteOfDay } from '@dereekb/util';

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
  DAY_STRING = 2,
  /**
   * Value is returned/parsed as a Unix timestamp, relative to the current timezone.
   */
  UNIX_TIMESTAMP = 3,
  /**
   * Value is returned/parsed as a minute of the day, relative to the current timezone.
   */
  MINUTE_OF_DAY = 4,
  /**
   * Value is returned/parsed as a minute of the day, relative to the system timezone.
   */
  SYSTEM_MINUTE_OF_DAY = 5
}

export function dbxDateTimeInputValueParseFactory(mode: DbxDateTimeValueMode, timezoneInstance: Maybe<DateTimezoneUtcNormalInstance>): (date: Maybe<Date | string | number>) => Maybe<Date> {
  let factory: (date: Maybe<Date | string | number>) => Maybe<Date>;
  let useTimezoneInstance = true;

  switch (mode) {
    case DbxDateTimeValueMode.DAY_STRING:
      factory = (x) => {
        let result: Maybe<Date>;

        switch (typeof x) {
          case 'string':
            result = parseISO8601DayStringToDate(x);
            break;
          case 'number':
            result = new Date(x);
            break;
          default:
            result = x;
            break;
        }

        return result;
      };
      useTimezoneInstance = false; // day strings do not use timezones
      break;
    case DbxDateTimeValueMode.SYSTEM_MINUTE_OF_DAY:
    case DbxDateTimeValueMode.MINUTE_OF_DAY:
      factory = (x) => {
        let result: Maybe<Date>;

        switch (typeof x) {
          case 'number':
            result = dateFromMinuteOfDay(x);
            break;
          case 'string':
            result = parseJsDateString(x);
            break;
          default:
            result = x;
            break;
        }

        return result;
      };

      if (mode === DbxDateTimeValueMode.SYSTEM_MINUTE_OF_DAY) {
        useTimezoneInstance = false;
      }

      break;
    case DbxDateTimeValueMode.UNIX_TIMESTAMP:
    case DbxDateTimeValueMode.DATE_STRING:
    case DbxDateTimeValueMode.DATE:
    default:
      factory = (x) => (x != null ? toJsDate(x as Date | string | number) : x);
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

export function dbxDateTimeOutputValueFactory(mode: DbxDateTimeValueMode, timezoneInstance: Maybe<DateTimezoneUtcNormalInstance>): (date: Maybe<Date>) => Maybe<Date | string | number> {
  let factory: (date: Maybe<Date>) => Maybe<Date | string | number>;
  let useTimezoneInstance = true;

  switch (mode) {
    case DbxDateTimeValueMode.DAY_STRING:
      factory = (x) => (x != null ? formatToISO8601DayStringForSystem(x) : x);
      useTimezoneInstance = false; // day strings do not use timezones
      break;
    case DbxDateTimeValueMode.DATE_STRING:
      factory = (x) => (x != null ? formatToISO8601DateString(x) : x);
      break;
    case DbxDateTimeValueMode.UNIX_TIMESTAMP:
      factory = (x) => (x != null ? x.getTime() : x);
      break;
    case DbxDateTimeValueMode.SYSTEM_MINUTE_OF_DAY:
    case DbxDateTimeValueMode.MINUTE_OF_DAY:
      factory = (x) => (x != null ? dateToMinuteOfDay(x) : x);

      if (mode === DbxDateTimeValueMode.SYSTEM_MINUTE_OF_DAY) {
        useTimezoneInstance = false;
      }
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

export function dbxDateTimeIsSameDateTimeFieldValue(a: Maybe<Date | ISO8601DayString | number>, b: Maybe<Date | ISO8601DayString | number>) {
  const typeofA = typeof a;
  return a && b ? (typeofA === 'string' || typeofA === 'number' ? a === b : isSameDateHoursAndMinutes(a as Date, b as Date)) : a == b;
}

export function dbxDateRangeIsSameDateRangeFieldValue(a: Maybe<DateRangeWithDateOrStringValue>, b: Maybe<DateRangeWithDateOrStringValue>) {
  return a && b ? dbxDateTimeIsSameDateTimeFieldValue(a.start, b.start) && dbxDateTimeIsSameDateTimeFieldValue(a.end, b.end) : a == b;
}
