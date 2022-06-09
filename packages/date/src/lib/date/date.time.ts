import { parse, differenceInMinutes, isValid, addHours, startOfDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { isLogicalDateStringCode, LogicalDateStringCode, Maybe, ReadableTimeString, TimeAM, TimezoneString, UTC_TIMEZONE_STRING, dateFromLogicalDate } from '@dereekb/util';
import { LimitDateTimeConfig, LimitDateTimeInstance } from './date.time.limit';
import { DateTimezoneConversionConfig, DateTimezoneUtcNormalInstance, isSameDateTimezoneConversionConfig, systemNormalDateToBaseDate } from './date.timezone';
import { guessCurrentTimezone } from './date';

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
   * The minute in the day.
   */
  minutesSinceStartOfDay: number;
  /**
   * AM or PM
   */
  am: TimeAM;
}

export interface ParseTimeString extends DateTimezoneConversionConfig {
  /**
   * Reference date to parse from.
   */
  date?: Date;
}

export interface DateFromTimestringResult {
  /**
   * The "raw" date. This occurs at the UTC time of the parsed result. For instance, 1PM for any timezone will return 1PM in UTC for the same date.
   */
  raw?: Maybe<Date>;
  /**
   * The real, post-timezone-converted value.
   */
  result?: Maybe<Date>;
  /**
   * Whether or not the value was parsed.
   *
   * If not value, raw and result may be undefined.
   */
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

/**
 * A utility instance.
 */
export class DateTimeUtilityInstance {
  readonly normalInstance: DateTimezoneUtcNormalInstance;

  /**
   * The default timezone all inputs should be handled with.
   *
   * If the timezone is not defined, it defaults to UTC.
   */
  constructor(timezone?: Maybe<TimezoneString>) {
    this.normalInstance = new DateTimezoneUtcNormalInstance(timezone);
  }

  get timezone(): TimezoneString {
    return this.normalInstance.config.timezone as string;
  }

  getTimeAM(date = new Date(), timezone?: TimezoneString): TimeAM {
    const am: TimeAM = formatInTimeZone(date, timezone ?? this.timezone, 'a') as TimeAM;
    return am;
  }

  toTimeString(date: Date, timezone?: TimezoneString): ReadableTimeString {
    return formatInTimeZone(date, timezone ?? this.timezone, `h:mma`);
  }

  parseTimeString(input: ReadableTimeString, config?: ParseTimeString): Maybe<ParsedTimeString> {
    const timestringResult = this._timeStringToDate(input, config);

    if (isValidDateFromTimestringResult(timestringResult)) {
      const { result, raw } = timestringResult;

      // Use minutes since start of day. Since differenceInMinutes uses system time, we convert the raw to system time first.
      const inSystemTime = systemNormalDateToBaseDate(raw);
      const minutesSinceStartOfDay = differenceInMinutes(inSystemTime, startOfDay(inSystemTime));

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

  /**
   * Returns a timestring parsed relative to the input config.
   *
   * @param input
   * @param config
   * @returns
   */
  timeStringToDate(input: ReadableTimeString | LogicalDateStringCode, config?: ParseTimeString): Maybe<Date> {
    const { result, valid } = this._timeStringToDate(input, config);

    if (valid) {
      return result;
    } else {
      return undefined;
    }
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
        'h:mm' // 1:20
      ];

      // tslint:disable-next-line: prefer-for-of
      for (let i = 0; i < formats.length; i += 1) {
        systemParsedDateTime = parse(input, formats[i], relativeDate);

        if (isValid(systemParsedDateTime)) {
          valid = true;
          break; // Use time.
        }
      }

      let removedPm = false;

      function removeAmPm(inputString: string): string {
        inputString = inputString.toLowerCase();
        removedPm = inputString.indexOf('pm') !== -1;
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

        valid = isValid(systemParsedDateTime);
      }
    }

    /*
     The input date needs to capture the right Day we want to parse on, since parse uses the system's information for hours/date information.
     We do this by adding the offset of the system with the offset of the target timezone.
     */
    const relativeDateNormal = new DateTimezoneUtcNormalInstance(config);
    const relativeDate = relativeDateNormal.systemDateToTargetDate(inputDate);

    // console.log('Relative Date: ', relativeDate, calculateAllConversions(inputDate, relativeDateNormal, (x) => millisecondsToHours(x)));

    if (isLogicalDateStringCode(input)) {
      systemParsedDateTime = dateFromLogicalDate(input);
      valid = isValid(systemParsedDateTime);
    } else {
      parseTimeString();
    }

    // console.log('Parsed: ', systemParsedDateTime, relativeDate, input, inputDate, relativeDateNormal);

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

    return {
      raw,
      result,
      valid
    };
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

export function dateTimeInstanceUtc(): DateTimeUtilityInstance {
  return dateTimeInstance(UTC_TIMEZONE_STRING);
}

export function dateTimeInstance(timezone?: Maybe<TimezoneString>): DateTimeUtilityInstance {
  return new DateTimeUtilityInstance(timezone ?? UTC_TIMEZONE_STRING);
}

export function getTimeAM(date = new Date(), timezone?: Maybe<TimezoneString>): TimeAM {
  return dateTimeInstance(timezone).getTimeAM(date);
}

export function toLocalReadableTimeString(date: Date): ReadableTimeString {
  return toReadableTimeString(date, guessCurrentTimezone());
}

export function toReadableTimeString(date: Date, timezone?: Maybe<TimezoneString>): ReadableTimeString {
  return dateTimeInstance(timezone).toTimeString(date);
}

/**
 * Parses the input string relative to the timezone in the configuration.
 *
 * If no conversion timezone is provided, then it is parsed relative to UTC.
 *
 * @param input
 * @param config
 * @returns
 */
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
