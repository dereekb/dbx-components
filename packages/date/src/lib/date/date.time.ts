import { parse, differenceInMinutes, isValid, addHours, addMinutes, addMilliseconds, startOfDay } from 'date-fns';
import { getTimezoneOffset, format } from 'date-fns-tz';
import { Maybe, ReadableTimeString, TimeAM, TimezoneString, UTC_TIMEZONE_STRING } from '@dereekb/util';
import { minutesToMs } from './date';
import { LimitDateTimeConfig, LimitDateTimeInstance } from './date.time.limit';

export interface ParsedTimeString {
  /**
   * Parsed "raw" date in UTC.
   */
  utc: Date;
  /**
   * Understood date, given the input.
   */
  date: Date;
  /**
   * Minute in the day.
   */
  minutesSinceStartOfDay: number;
  /**
   * AM or PM
   */
  am: TimeAM;
}

export interface ParseTimeString {
  /**
   * Reference date to parse from.
   */
  date?: Date;
  /**
   * Timezone to be relative to. If not defined, values are returned in UTC.
   */
  timezone?: TimezoneString;
  /**
   * Whether or not to use the system timezone/offset.
   */
  useSystemTimezone?: boolean;
  /**
   * Custom timezone offset to specify for the result.
   */
  timezoneOffset?: number;
}

export interface DateFromTimestringResult {
  result?: Maybe<Date>;
  raw?: Maybe<Date>;
  valid: boolean;
}

export interface ValidDateFromTimestringResult extends Required<DateFromTimestringResult> {
  result: Date;
  raw: Date;
  valid: true;
}

export function isValidDateFromTimestringResult(result: ValidDateFromTimestringResult | DateFromTimestringResult): result is ValidDateFromTimestringResult {
  return result.valid;
}

export class DateTimeUtilityInstance {

  readonly timezone: TimezoneString;

  constructor(timezone?: Maybe<TimezoneString>) {
    this.timezone = (typeof timezone === 'string') ? timezone : UTC_TIMEZONE_STRING;
  }

  getTimeAM(date = new Date(), timezone?: TimezoneString): TimeAM {
    const am: TimeAM = format(date, 'a', { timeZone: timezone ?? this.timezone }) as TimeAM;
    return am;
  }

  toTimeString(date: Date, timezone?: TimezoneString): ReadableTimeString {
    return format(date, `h:mma`, { timeZone: timezone ?? this.timezone });
  }

  parseTimeString(input: ReadableTimeString, config?: ParseTimeString): Maybe<ParsedTimeString> {
    const timestringResult = this._timeStringToDate(input, config);

    if (isValidDateFromTimestringResult(timestringResult)) {
      const { result, raw, valid } = timestringResult;

      // Use minites since start of day since raw
      const minutesSinceStartOfDay = differenceInMinutes(raw!, startOfDay(raw!));

      return {
        utc: raw,
        date: result,
        minutesSinceStartOfDay,
        am: minutesSinceStartOfDay < 720 ? TimeAM.AM : TimeAM.PM
      };
    } else {
      return undefined;
    }
  }

  timeStringToDate(input: ReadableTimeString, config?: ParseTimeString): Maybe<Date> {
    const { result, valid } = this._timeStringToDate(input, config);

    if (valid) {
      return result;
    } else {
      return undefined;
    }
  }

  _timeStringToDate(input: ReadableTimeString, { date = new Date(), timezone = this.timezone, useSystemTimezone, timezoneOffset }: ParseTimeString = {}): DateFromTimestringResult | ValidDateFromTimestringResult {

    if (!input) {
      return { valid: false };
    } else {
      input = input.trim();
    }

    const formats = [
      'h:mma',  // 1:20AM
      'h:mm a', // 1:20 AM
      'h a',    // 1 AM
      'ha',     // 1AM
      'h:mm'    // 1:20
    ];

    let dateTime: Maybe<Date>;
    let valid = false;

    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < formats.length; i += 1) {
      dateTime = parse(input, formats[i], date);

      if (isValid(dateTime)) {
        valid = true;
        break;  // Use time.
      }
    }

    if (!valid) {
      input = input.trim().replace(/\s+/g, '');

      let removedPm = false;

      function removeAmPm(inputString: string): string {
        inputString = inputString.toLowerCase();
        removedPm = inputString.indexOf('pm') !== -1;
        inputString = inputString.replace(/\am|pm/g, '');
        return inputString;
      }

      function parseDateTimeFromNumber(inputString: string): Date {
        const hour = inputString[0];
        const minute = inputString[1] + inputString[2];
        return parse(`${hour}:${minute}AM`, 'h:mma', date);
      }

      function parseDateTimeAsHmm(inputString: string): Date {
        return parse(inputString, 'Hmm', date);
      }

      switch (input.length) {
        case 1:
        case 2:
          // 1
          dateTime = parse(input, 'H', date);
          break;
        case 5:
          // 120AM
          input = removeAmPm(input);
          dateTime = parseDateTimeFromNumber(input);
          break;
        case 3:
          // 120
          dateTime = parseDateTimeFromNumber(input);
          break;
        case 6:
          // 1212AM
          removeAmPm(input);

          if (removedPm) {
            removedPm = input[0] !== '2'; // If 2, ignore the PM part.
          }

          dateTime = parseDateTimeAsHmm(input);
          break;
        default:
          // 2200
          dateTime = parseDateTimeAsHmm(input);
          break;
      }

      if (removedPm) {
        dateTime = addHours(dateTime, 12);
      }

      valid = isValid(dateTime);
    }

    // Raw parse result is always UTC for that date.
    // For example, 1AM will return 1AM UTC in a Date object.
    let raw: Maybe<Date>;

    if (valid) {
      raw = dateTime!;
      const rawTimezoneOffset = raw.getTimezoneOffset();   // 360 for GMT-0600
      raw = addMinutes(raw, rawTimezoneOffset);            // raw is now in GMT-0

      let offset: Maybe<number>;

      if (useSystemTimezone) {
        const currentTzOffset = minutesToMs(new Date().getTimezoneOffset());
        offset = currentTzOffset;
      } else if (timezoneOffset != null) {
        offset = timezoneOffset;
      } else if (timezone) {
        offset = getTimezoneOffset(timezone, date);   // -360 * 60 * 1000 for GMT-0600
      }

      if (offset) {
        dateTime = addMilliseconds(raw, -offset);            // dateTime is now in GMT-0600
      } else {
        dateTime = raw;
      }

      // console.log('Raw: ', input, raw, dateTime, timezone, timezoneOffset, offset);
    }

    return {
      raw: raw,
      result: dateTime,
      valid
    };
  }

}

export function dateTimeInstanceUtc(): DateTimeUtilityInstance {
  return dateTimeInstance(UTC_TIMEZONE_STRING);
}

export function dateTimeInstance(timezone?: Maybe<TimezoneString>): DateTimeUtilityInstance {
  return new DateTimeUtilityInstance(timezone ?? UTC_TIMEZONE_STRING);
}

export function getTimeAM(date = new Date(), timezone?: Maybe<TimezoneString>): TimeAM {
  return dateTimeInstance(timezone).getTimeAM(date);
}

export function toReadableTimeString(date: Date, timezone?: Maybe<TimezoneString>): ReadableTimeString {
  return dateTimeInstance(timezone).toTimeString(date);
}

export function parseReadableTimeString(input: ReadableTimeString, config?: ParseTimeString): Maybe<ParsedTimeString> {
  return dateTimeInstance(config?.timezone).parseTimeString(input, config);
}

export function readableTimeStringToDate(input: ReadableTimeString, config?: ParseTimeString): Maybe<Date> {
  return dateTimeInstance(config?.timezone).timeStringToDate(input, config);
}

// MARK: Limits
export function limitDateTime(config: LimitDateTimeConfig): LimitDateTimeInstance {
  return new LimitDateTimeInstance(config);
}
