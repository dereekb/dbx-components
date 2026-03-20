import { parse, differenceInMinutes, isValid as isValidDate, addHours, startOfDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { isLogicalDateStringCode, type LogicalDateStringCode, type Maybe, type ReadableTimeString, TimeAM, type TimezoneString, UTC_TIMEZONE_STRING, dateFromLogicalDate } from '@dereekb/util';
import { type LimitDateTimeConfig, LimitDateTimeInstance } from './date.time.limit';
import { type DateTimezoneConversionConfig, DateTimezoneUtcNormalInstance, isSameDateTimezoneConversionConfig, isValidDateTimezoneConversionConfig, systemNormalDateToBaseDate } from './date.timezone';
import { guessCurrentTimezone } from './date';

/**
 * Result of parsing a time string, containing both the raw UTC and timezone-adjusted dates
 * along with computed time-of-day information.
 */
export interface ParsedTimeString {
  /**
   * The parsed date normalized to UTC, preserving the wall-clock time.
   * For example, parsing "1:00PM" yields 1:00PM UTC regardless of the source timezone.
   */
  utc: Date;
  /**
   * The timezone-adjusted date representing the actual moment in time the input refers to.
   */
  date: Date;
  /**
   * Number of minutes elapsed since midnight, used for time-of-day comparisons.
   */
  minutesSinceStartOfDay: number;
  /**
   * Whether the parsed time falls in the AM or PM half of the day.
   */
  am: TimeAM;
}

/**
 * Configuration for parsing a time string relative to a specific date and timezone.
 */
export interface ParseTimeString extends DateTimezoneConversionConfig {
  /**
   * The reference date used as the base day for the parsed time.
   * Defaults to the current date/time if not provided.
   */
  readonly date?: Date;
}

/**
 * Result of converting a time string to a date, containing both the raw UTC interpretation
 * and the timezone-adjusted result.
 */
export interface DateFromTimestringResult {
  /**
   * The parsed date normalized to UTC wall-clock time. For instance, "1:00PM" in any timezone
   * yields 1:00PM UTC, useful for timezone-independent time-of-day comparisons.
   */
  raw?: Maybe<Date>;
  /**
   * The actual moment in time after applying timezone conversion from the raw value.
   */
  result?: Maybe<Date>;
  /**
   * Whether the input was successfully parsed. When false, `raw` and `result` may be undefined.
   */
  valid: boolean;
}

export interface ValidDateFromTimestringResult extends Required<DateFromTimestringResult> {
  result: Date;
  raw: Date;
  valid: true;
}

/**
 * Type guard that narrows a {@link DateFromTimestringResult} to {@link ValidDateFromTimestringResult},
 * guaranteeing that `raw` and `result` are defined.
 *
 * @param result - The parse result to check.
 * @returns `true` if the result is valid, narrowing the type to {@link ValidDateFromTimestringResult}.
 *
 * @example
 * ```ts
 * const parseResult = instance.timeStringToDateResult('1:30PM');
 * if (isValidDateFromTimestringResult(parseResult)) {
 *   console.log(parseResult.result); // Date is guaranteed
 * }
 * ```
 */
export function isValidDateFromTimestringResult(result: ValidDateFromTimestringResult | DateFromTimestringResult): result is ValidDateFromTimestringResult {
  return result.valid;
}

/**
 * Stateful utility for parsing and formatting time strings relative to a configured timezone.
 *
 * Handles the complexity of converting between wall-clock time representations and actual
 * moments in time across timezones. Supports multiple input formats including "1:30PM",
 * "13:30", "1PM", and logical date string codes.
 *
 * @example
 * ```ts
 * const instance = new DateTimeUtilityInstance('America/New_York');
 * const date = instance.timeStringToDate('1:30PM');
 * const timeStr = instance.toTimeString(new Date());
 * ```
 */
export class DateTimeUtilityInstance {
  readonly normalInstance: DateTimezoneUtcNormalInstance;

  /**
   * @param timezone - The default timezone for all operations. Defaults to UTC if not provided.
   */
  constructor(timezone?: Maybe<TimezoneString>) {
    this.normalInstance = new DateTimezoneUtcNormalInstance(timezone);
  }

  get timezone(): TimezoneString {
    return this.normalInstance.configuredTimezoneString as string;
  }

  /**
   * Determines whether the given date falls in the AM or PM period for the specified timezone.
   *
   * @param date - The date to check. Defaults to now.
   * @param timezone - Overrides the instance's configured timezone for this call.
   * @returns {@link TimeAM.AM} or {@link TimeAM.PM} depending on the time of day.
   *
   * @example
   * ```ts
   * const instance = new DateTimeUtilityInstance('America/Chicago');
   * const amPm = instance.getTimeAM(new Date()); // TimeAM.AM or TimeAM.PM
   * ```
   */
  getTimeAM(date = new Date(), timezone?: TimezoneString): TimeAM {
    const am: TimeAM = formatInTimeZone(date, timezone ?? this.timezone, 'a') as TimeAM;
    return am;
  }

  /**
   * Formats a date as a human-readable time string (e.g., "1:30PM") in the given timezone.
   *
   * @param date - The date to format.
   * @param timezone - Overrides the instance's configured timezone for this call.
   * @returns The formatted time string (e.g., "1:30PM").
   *
   * @example
   * ```ts
   * const instance = new DateTimeUtilityInstance('UTC');
   * instance.toTimeString(new Date('2024-01-15T13:30:00Z')); // '1:30PM'
   * ```
   */
  toTimeString(date: Date, timezone?: TimezoneString): ReadableTimeString {
    return formatInTimeZone(date, timezone ?? this.timezone, `h:mma`);
  }

  /**
   * Parses a readable time string into a {@link ParsedTimeString} with both UTC and
   * timezone-adjusted dates, plus time-of-day metadata.
   *
   * @param input - A time string such as "1:30PM", "13:30", or "1PM".
   * @param config - Optional parsing configuration with reference date and timezone overrides.
   * @returns The parsed result, or undefined if the input could not be parsed.
   *
   * @example
   * ```ts
   * const instance = new DateTimeUtilityInstance('America/New_York');
   * const parsed = instance.parseTimeString('2:30PM');
   * if (parsed) {
   *   console.log(parsed.minutesSinceStartOfDay); // 870
   *   console.log(parsed.am); // TimeAM.PM
   * }
   * ```
   */
  parseTimeString(input: ReadableTimeString, config?: ParseTimeString): Maybe<ParsedTimeString> {
    const timestringResult = this._timeStringToDate(input, config);
    let result: Maybe<ParsedTimeString>;

    if (isValidDateFromTimestringResult(timestringResult)) {
      const { result: dateResult, raw } = timestringResult;

      // Use minutes since start of day. Since differenceInMinutes uses system time, we convert the raw to system time first.
      const inSystemTime = systemNormalDateToBaseDate(raw);
      const minutesSinceStartOfDay = differenceInMinutes(inSystemTime, startOfDay(inSystemTime));

      result = {
        utc: raw,
        date: dateResult,
        minutesSinceStartOfDay,
        am: minutesSinceStartOfDay < 720 ? TimeAM.AM : TimeAM.PM
      };
    }

    return result;
  }

  /**
   * Converts a time string or logical date code into an actual Date, applying timezone conversion.
   *
   * Supports many input formats: "1:30PM", "1:30 PM", "1PM", "1AM", "13:30", "1330", and
   * logical date string codes.
   *
   * @param input - The time string or logical date code to parse.
   * @param config - Optional parsing configuration with reference date and timezone overrides.
   * @returns The resolved date, or undefined if the input could not be parsed.
   *
   * @example
   * ```ts
   * const instance = new DateTimeUtilityInstance('America/Denver');
   * const date = instance.timeStringToDate('3:00PM');
   * const dateWithRef = instance.timeStringToDate('3:00PM', { date: new Date('2024-06-15') });
   * ```
   */
  timeStringToDate(input: ReadableTimeString | LogicalDateStringCode, config?: ParseTimeString): Maybe<Date> {
    const { result, valid } = this._timeStringToDate(input, config);
    return valid ? result : undefined;
  }

  _timeStringToDate(input: ReadableTimeString | LogicalDateStringCode, config: ParseTimeString = {}): DateFromTimestringResult | ValidDateFromTimestringResult {
    const { date: inputDate = new Date() } = config;

    if (!input) {
      return { valid: false };
    } else {
      input = input.trim();
    }

    let systemParsedDateTime: Maybe<Date>;
    let valid = false;

    function parseTimeString() {
      const formats = [
        'h:mma', // 1:20AM
        'h:mm a', // 1:20 AM
        'h a', // 1 AM
        'ha', // 1AM
        'h:mm', // 1:20
        'HH:mm' // 01:20
      ];

      // tslint:disable-next-line: prefer-for-of
      for (const format of formats) {
        systemParsedDateTime = parse(input, format, relativeDate);

        if (isValidDate(systemParsedDateTime)) {
          valid = true;
          break; // Use time.
        }
      }

      let removedPm = false;

      function removeAmPm(inputString: string): string {
        inputString = inputString.toLowerCase();
        removedPm = inputString.includes('pm');
        inputString = inputString.replace(/am|pm/g, '');
        return inputString;
      }

      function parseDateTimeFromNumber(inputString: string): Date {
        const hour = inputString[0];
        const minute = inputString[1] + inputString[2];
        return parse(`${hour}:${minute}AM`, 'h:mma', relativeDate);
      }

      function parseDateTimeAsHmm(inputString: string): Date {
        return parse(inputString, 'Hmm', relativeDate);
      }

      if (!valid) {
        input = input.trim().replace(/\s+/g, '');

        switch (input.length) {
          case 1:
          case 2:
            // 1
            systemParsedDateTime = parse(input, 'H', relativeDate);
            break;
          case 5:
            // 120AM
            input = removeAmPm(input);
            systemParsedDateTime = parseDateTimeFromNumber(input);
            break;
          case 3:
            // 120
            systemParsedDateTime = parseDateTimeFromNumber(input);
            break;
          case 6:
            // 1212AM
            removeAmPm(input);

            if (removedPm) {
              removedPm = input[0] !== '2'; // If 2, ignore the PM part.
            }

            systemParsedDateTime = parseDateTimeAsHmm(input);
            break;
          default:
            // 2200
            systemParsedDateTime = parseDateTimeAsHmm(input);
            break;
        }

        if (removedPm) {
          systemParsedDateTime = addHours(systemParsedDateTime, 12);
        }

        valid = isValidDate(systemParsedDateTime);
      }
    }

    /*
     The input date needs to capture the right Day we want to parse on, since parse uses the system's information for hours/date information.
     We do this by adding the offset of the system with the offset of the target timezone.
     */
    const relativeDateNormal = isValidDateTimezoneConversionConfig(config) ? new DateTimezoneUtcNormalInstance({ ...config }) : this.normalInstance;
    const relativeDate = relativeDateNormal.systemDateToTargetDate(inputDate);

    // console.log('Relative Date: ', relativeDate, calculateAllConversions(inputDate, relativeDateNormal, (x) => millisecondsToHours(x)));

    if (isLogicalDateStringCode(input)) {
      systemParsedDateTime = dateFromLogicalDate(input);
      valid = isValidDate(systemParsedDateTime);
    } else {
      parseTimeString();
    }

    // console.log('Parsed: ', systemParsedDateTime, relativeDate, input, inputDate, relativeDateNormal, relativeDateNormal.configuredTimezoneString);

    // Raw parse result is always UTC for that date.
    // For example, 1AM will return 1AM UTC in a Date object.
    let raw: Maybe<Date>;
    let result: Maybe<Date>;

    if (valid) {
      // The parsed DateTime will be in the system settings for that date in as a UTC time.
      raw = relativeDateNormal.baseDateToSystemDate(systemParsedDateTime as Date);
      result = relativeDateNormal.targetDateToSystemDate(systemParsedDateTime as Date);

      // console.log('Raw: ', input, systemParsedDateTime, differenceInHours(raw, systemParsedDateTime!), raw, differenceInHours(raw, result), result, this.normalInstance.config);
    }

    const output: DateFromTimestringResult | ValidDateFromTimestringResult = {
      raw,
      result,
      valid
    };

    return output;
  }

  private _normalizeInstanceForConfig(config: DateTimezoneConversionConfig): DateTimezoneUtcNormalInstance {
    let instance: DateTimezoneUtcNormalInstance;

    if (isSameDateTimezoneConversionConfig(this.normalInstance.config, config)) {
      instance = this.normalInstance;
    } else {
      instance = new DateTimezoneUtcNormalInstance({
        ...config,
        timezone: config.timezone ?? this.normalInstance.config.timezone
      });
    }

    return instance;
  }
}

/**
 * Creates a {@link DateTimeUtilityInstance} configured for UTC.
 *
 * @returns A new {@link DateTimeUtilityInstance} using the UTC timezone.
 *
 * @example
 * ```ts
 * const utcInstance = dateTimeInstanceUtc();
 * const timeStr = utcInstance.toTimeString(new Date()); // e.g., '5:30PM'
 * ```
 */
export function dateTimeInstanceUtc(): DateTimeUtilityInstance {
  return dateTimeInstance(UTC_TIMEZONE_STRING);
}

/**
 * Factory function that creates a {@link DateTimeUtilityInstance} for the given timezone.
 * Defaults to UTC when no timezone is provided.
 *
 * @param timezone - The IANA timezone identifier (e.g., 'America/New_York').
 * @returns A new {@link DateTimeUtilityInstance} for the specified timezone.
 *
 * @example
 * ```ts
 * const nyInstance = dateTimeInstance('America/New_York');
 * const date = nyInstance.timeStringToDate('9:00AM');
 * ```
 */
export function dateTimeInstance(timezone?: Maybe<TimezoneString>): DateTimeUtilityInstance {
  return new DateTimeUtilityInstance(timezone ?? UTC_TIMEZONE_STRING);
}

/**
 * Determines whether the given date falls in the AM or PM period for the specified timezone.
 *
 * @param date - The date to check. Defaults to now.
 * @param timezone - The IANA timezone to evaluate in. Defaults to UTC.
 * @returns {@link TimeAM.AM} or {@link TimeAM.PM} depending on the time of day.
 *
 * @example
 * ```ts
 * const amPm = getTimeAM(new Date(), 'America/Chicago');
 * if (amPm === TimeAM.AM) {
 *   console.log('Morning in Chicago');
 * }
 * ```
 */
export function getTimeAM(date = new Date(), timezone?: Maybe<TimezoneString>): TimeAM {
  return dateTimeInstance(timezone).getTimeAM(date);
}

/**
 * Formats a date as a readable time string (e.g., "1:30PM") using the system's local timezone,
 * unlike {@link toReadableTimeString} which defaults to UTC.
 *
 * @param date - The date to format.
 * @returns The formatted time string in the system's local timezone.
 *
 * @example
 * ```ts
 * const localTime = toLocalReadableTimeString(new Date()); // e.g., '9:45AM' in your local tz
 * ```
 */
export function toLocalReadableTimeString(date: Date): ReadableTimeString {
  return toReadableTimeString(date, guessCurrentTimezone());
}

/**
 * Formats a date as a human-readable time string (e.g., "1:30PM") in the given timezone.
 *
 * @param date - The date to format.
 * @param timezone - The IANA timezone to format in. Defaults to UTC.
 * @returns The formatted time string (e.g., "10:30AM").
 *
 * @example
 * ```ts
 * const time = toReadableTimeString(new Date(), 'America/New_York'); // e.g., '10:30AM'
 * const utcTime = toReadableTimeString(new Date()); // UTC time
 * ```
 */
export function toReadableTimeString(date: Date, timezone?: Maybe<TimezoneString>): ReadableTimeString {
  return dateTimeInstance(timezone).toTimeString(date);
}

/**
 * Parses a readable time string into a {@link ParsedTimeString} relative to the configured timezone.
 * Falls back to UTC when no timezone is provided in the config.
 *
 * @param input - A time string such as "1:30PM", "13:30", or "1PM".
 * @param config - Optional configuration specifying the timezone and reference date.
 * @returns The parsed time string result, or `undefined` if parsing failed.
 *
 * @example
 * ```ts
 * const parsed = parseReadableTimeString('2:00PM', { timezone: 'America/Denver' });
 * if (parsed) {
 *   console.log(parsed.date); // 2:00PM Denver time as a Date
 *   console.log(parsed.am);  // TimeAM.PM
 * }
 * ```
 */
export function parseReadableTimeString(input: ReadableTimeString, config?: ParseTimeString): Maybe<ParsedTimeString> {
  return dateTimeInstance(config?.timezone).parseTimeString(input, config);
}

/**
 * Convenience function that parses a readable time string directly into a Date.
 * Combines {@link dateTimeInstance} creation and {@link DateTimeUtilityInstance.timeStringToDate} in one call.
 *
 * @param input - A time string such as "1:30PM" or "13:30".
 * @param config - Optional configuration specifying the timezone and reference date.
 * @returns The resolved date, or `undefined` if the input could not be parsed.
 *
 * @example
 * ```ts
 * const date = readableTimeStringToDate('9:00AM', { timezone: 'Europe/London' });
 * ```
 */
export function readableTimeStringToDate(input: ReadableTimeString, config?: ParseTimeString): Maybe<Date> {
  return dateTimeInstance(config?.timezone).timeStringToDate(input, config);
}

// MARK: Limits
/**
 * Creates a {@link LimitDateTimeInstance} for clamping and constraining dates to a configured range.
 *
 * @param config - The limit configuration specifying min/max bounds, future requirements, etc.
 * @returns A new {@link LimitDateTimeInstance} configured with the given bounds.
 *
 * @example
 * ```ts
 * const limiter = limitDateTime({
 *   limits: { isFuture: true, future: { hours: 1 } }
 * });
 * const clamped = limiter.clamp(someDate); // ensures date is at least 1 hour in the future
 * ```
 */
export function limitDateTime(config: LimitDateTimeConfig): LimitDateTimeInstance {
  return new LimitDateTimeInstance(config);
}
