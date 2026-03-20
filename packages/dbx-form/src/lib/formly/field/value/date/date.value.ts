import { type DateTimezoneUtcNormalInstance, parseISO8601DayStringToDate, toJsDate, formatToISO8601DayStringForSystem, formatToISO8601DateString, isSameDateHoursAndMinutes, type DateRangeWithDateOrStringValue, parseJsDateString } from '@dereekb/date';
import { type ISO8601DayString, type Maybe, dateFromMinuteOfDay, dateToMinuteOfDay } from '@dereekb/util';

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

/**
 * Creates a parser function that converts raw form input values (Date, string, or number)
 * into JavaScript Date objects based on the specified value mode.
 *
 * Handles timezone conversion when a timezone instance is provided and the mode requires it.
 *
 * @param mode - Determines how the input value is interpreted
 * @param timezoneInstance - Optional timezone converter for UTC-normal date handling
 * @returns A function that parses input values to Date objects
 *
 * @example
 * ```typescript
 * const parser = dbxDateTimeInputValueParseFactory(DbxDateTimeValueMode.DATE_STRING, timezoneInstance);
 * const date = parser('2024-01-15T10:00:00Z');
 * ```
 */
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
      return date ? timezoneInstance.systemDateToTargetDate(date) : date;
    };
  }

  return factory;
}

/**
 * Creates a formatter function that converts JavaScript Date objects into the appropriate
 * output format (Date, ISO string, timestamp, or minute-of-day) based on the specified value mode.
 *
 * Handles timezone conversion when a timezone instance is provided and the mode requires it.
 *
 * @param mode - Determines the output format
 * @param timezoneInstance - Optional timezone converter for UTC-normal date handling
 * @returns A function that formats Date objects to the target output type
 *
 * @example
 * ```typescript
 * const formatter = dbxDateTimeOutputValueFactory(DbxDateTimeValueMode.DAY_STRING, null);
 * const dayString = formatter(new Date()); // e.g., '2024-01-15'
 * ```
 */
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
      return originalFactory(date);
    };
  }

  return factory;
}

/**
 * Compares two date-time field values for equality, handling Date, ISO8601DayString, and number (timestamp/minute) types.
 *
 * For string and number types, performs strict equality. For Date objects, compares hours and minutes.
 *
 * @param a - First date-time value
 * @param b - Second date-time value
 * @returns Whether the two values represent the same date-time
 */
export function dbxDateTimeIsSameDateTimeFieldValue(a: Maybe<Date | ISO8601DayString | number>, b: Maybe<Date | ISO8601DayString | number>) {
  const typeofA = typeof a;
  return a && b ? (typeofA === 'string' || typeofA === 'number' ? a === b : isSameDateHoursAndMinutes(a as Date, b as Date)) : a == b;
}

/**
 * Compares two date range field values for equality by comparing both start and end values.
 *
 * @param a - First date range value
 * @param b - Second date range value
 * @returns Whether the two date ranges represent the same range
 */
export function dbxDateRangeIsSameDateRangeFieldValue(a: Maybe<DateRangeWithDateOrStringValue>, b: Maybe<DateRangeWithDateOrStringValue>) {
  return a && b ? dbxDateTimeIsSameDateTimeFieldValue(a.start, b.start) && dbxDateTimeIsSameDateTimeFieldValue(a.end, b.end) : a == b;
}
