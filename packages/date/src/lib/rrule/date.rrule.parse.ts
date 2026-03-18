import { type TimezoneString, type CommaSeparatedString, flattenArray, type Maybe, splitJoinRemainder } from '@dereekb/util';
import { format } from 'date-fns-tz';
import { DateSet } from '../date';
import { type DateTimezoneBaseDateConverter, DateTimezoneUtcNormalInstance } from '../date/date.timezone';

/**
 * Denotes a single RRule rules string.
 */
export type RRuleLineString = string;

/**
 * RRule property name. i.e. DTSTART, RRULE, etc.
 */
export type RRulePropertyType = string;

/**
 * Set of RRuleParams, separated by a ";".
 *
 * The first value in this set is the Type of RRule.
 */
export type RRuleRawParamSetString = string;

/**
 * Single Param string. Formatted as <ParamName>=<ParamValue>
 */
export type RRuleRawParamString = string;

/**
 * Set of values.
 */
export type RRuleRawValueSetString = CommaSeparatedString;

/**
 * A single raw value from an RRule value set.
 */
export type RRuleRawValueString = string;

/**
 * RRule line broken into a name and value.
 */
export interface RRuleRawLine {
  params: RRuleRawParamSetString;
  values: RRuleRawValueSetString;
}

/**
 * Single RRuleRawParamString parsed to key-value param.
 */
export interface RRuleParam {
  key: string;
  value: string;
}

/**
 * RRule raw param that is broken into name and raw value.
 */
export interface RRuleProperty {
  type: RRulePropertyType;
  params: RRuleParam[];
  values: RRuleRawValueSetString;
}

/**
 * Denotes a set of RRule strings.
 */
export type RRuleStringLineSet = RRuleLineString[];

/**
 * RFC string for an RRuleStringLineSet.
 */
export type RRuleLines = string;

/**
 * Date formatted like "20210611".
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.4
 */
export type RFC5545DateString = string;

/**
 * Date formatted like "20210611T110000" or "20210611T110000Z".
 *
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.3.5
 */
export type RFC5545DateTimeString = string;

/**
 * Result of separating an RRule string set into basic rules and parsed EXDATE exclusions.
 */
export interface RRuleStringSetSeparation {
  /**
   * All of the original input.
   */
  input: RRuleStringLineSet;

  /**
   * Non-exdate rules that are separated out.
   */
  basic: RRuleStringLineSet;

  /**
   * Exdate values. Relative to UTC.
   */
  exdates: DateSet;
}

/**
 * https://datatracker.ietf.org/doc/html/rfc5545#section-3.8.5.1
 */
export interface RRuleExdateAttribute {
  /**
   * Parsed timezone, if applicable.
   */
  timezone?: string;
  /**
   * Dates relative to UTC.
   */
  dates: Date[];
}

/**
 * Delimiter separating the property name/params from values in an RRule line.
 */
export const RRULE_STRING_SPLITTER = ':';

/** @deprecated use RRULE_STRING_SPLITTER instead. */
export const RRuleStringSplitter = RRULE_STRING_SPLITTER;

/**
 * Utility class for parsing and manipulating RFC 5545 RRule strings.
 *
 * Provides static methods for separating EXDATE rules, parsing RFC 5545 date-time strings,
 * and converting between raw line formats and structured property representations.
 *
 * @example
 * ```ts
 * const lines = DateRRuleParseUtility.toRRuleStringSet(rruleString);
 * const { basic, exdates } = DateRRuleParseUtility.separateRRuleStringSetValues(lines);
 * ```
 */
export class DateRRuleParseUtility {
  /**
   * Splits an RRule line set into basic rules and parsed EXDATE exclusion dates.
   *
   * @example
   * ```ts
   * const result = DateRRuleParseUtility.separateRRuleStringSetValues([
   *   'RRULE:FREQ=DAILY',
   *   'EXDATE:20210611T110000Z'
   * ]);
   * // result.basic = ['RRULE:FREQ=DAILY']
   * // result.exdates contains the parsed exclusion dates
   * ```
   */
  static separateRRuleStringSetValues(input: RRuleStringLineSet): RRuleStringSetSeparation {
    const basic: RRuleStringLineSet = [];
    const exdateRules: RRuleStringLineSet = [];

    input.forEach((rule) => {
      if (rule.startsWith('EXDATE')) {
        exdateRules.push(rule);
      } else {
        basic.push(rule);
      }
    });

    let exdates = new DateSet();

    if (exdateRules.length) {
      exdates = new DateSet(
        flattenArray(
          exdateRules.map((date) => {
            return DateRRuleParseUtility.parseExdateAttributeFromLine(date).dates;
          })
        )
      );
    }

    return {
      basic,
      exdates,
      input
    };
  }

  // MARK: Rules Parsing
  /**
   * Parses an EXDATE line into its timezone and date components.
   *
   * @throws Error if the line is not an EXDATE property.
   */
  static parseExdateAttributeFromLine(line: RRuleLineString): RRuleExdateAttribute {
    const property = this.parseProperty(line);
    DateRRuleParseUtility.assertPropertyType('EXDATE', property);
    return DateRRuleParseUtility.parseExdateAttributeFromProperty(property);
  }

  /**
   * Extracts timezone and UTC-normalized dates from an already-parsed EXDATE property.
   */
  static parseExdateAttributeFromProperty(property: RRuleProperty): RRuleExdateAttribute {
    const timezone: Maybe<TimezoneString> = property.params.find((x) => x.key === 'TZID')?.value;
    const rawDates: (RFC5545DateString | RFC5545DateTimeString)[] = property.values.split(',');

    const conversion = new DateTimezoneUtcNormalInstance({ timezone });
    const dates = rawDates.map((x) => DateRRuleParseUtility.parseDateTimeString(x, conversion));
    return {
      timezone,
      dates
    };
  }

  /**
   * Convenience wrapper that creates a timezone converter and delegates to {@link parseDateTimeString}.
   *
   * @throws Error if the date string is not UTC and no timezone is provided.
   */
  static parseDateTimeStringWithTimezone(rfcDateString: RFC5545DateString | RFC5545DateTimeString, timezone: Maybe<string>): Date {
    return DateRRuleParseUtility.parseDateTimeString(rfcDateString, timezone ? new DateTimezoneUtcNormalInstance({ timezone }) : undefined);
  }

  /**
   * Parses an RFC 5545 date or date-time string into a JavaScript Date.
   *
   * If the string does not end in `Z` (indicating UTC), the converter is used to normalize
   * the local date representation to its true UTC equivalent.
   *
   * @throws Error if the string cannot be parsed or a non-UTC string lacks a converter.
   */
  static parseDateTimeString(rfcDateString: RFC5545DateString | RFC5545DateTimeString, converter: Maybe<DateTimezoneBaseDateConverter>): Date {
    const RFC5545_DATE_TIME_FORMAT = /^((\d{4})(\d{2})(\d{2}))(T(\d{2})(\d{2})(\d{2})Z?)?$/;
    const isDateString = rfcDateString.length === 6;
    const isUTCDate = isDateString || rfcDateString.endsWith('Z');

    const parsed = RFC5545_DATE_TIME_FORMAT.exec(rfcDateString);

    if (parsed == null) {
      throw new Error(`Failed parsing input rfcDateString "${rfcDateString}"`);
    }

    const [, , /*full*/ /*yearDate*/ yearS, monthS, dayS /*time*/, , hourS, minuteS, secondS] = parsed;
    const [year, month, day, hour, minute, second] = [yearS, monthS, dayS, hourS, minuteS, secondS].map((x) => (x ? Number.parseInt(x, 10) : 0));

    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    let date: Date = utcDate;

    if (!isUTCDate) {
      // Date was parsed as a base/UTC value by rrule, so convert it to the real date.
      if (converter) {
        date = converter.baseDateToTargetDate(date);
      } else {
        throw new Error('No timezone was provided when parsing DateTime string.');
      }
    }

    return date;
  }

  /**
   * Formats a Date as an RFC 5545 UTC date-time string (e.g., `"20210611T110000Z"`).
   *
   * @example
   * ```ts
   * DateRRuleParseUtility.formatDateTimeString(new Date('2021-06-11T11:00:00Z'));
   * // => '20210611T110000Z'
   * ```
   */
  static formatDateTimeString(date: Date): RFC5545DateTimeString {
    return format(date, `yyyyMMdd'T'HHmmss'Z'`);
  }

  /**
   * Parses a full RRule line string into a structured {@link RRuleProperty}.
   */
  static parseProperty(line: RRuleLineString): RRuleProperty {
    const rawLine: RRuleRawLine = DateRRuleParseUtility.parseRawLine(line);
    return DateRRuleParseUtility.propertyFromRawLine(rawLine);
  }

  /**
   * Converts an {@link RRuleRawLine} into a structured {@link RRuleProperty} by splitting the type and params.
   */
  static propertyFromRawLine(rawLine: RRuleRawLine): RRuleProperty {
    const typeAndParams = rawLine.params.split(';');
    const type = typeAndParams[0].toUpperCase();
    const params = typeAndParams.slice(1).map(DateRRuleParseUtility.parseRawParam);

    return {
      type,
      params,
      values: rawLine.values
    };
  }

  /**
   * Splits a raw param string (e.g., `"TZID=America/New_York"`) into key-value form.
   */
  static parseRawParam(param: RRuleRawParamString): RRuleParam {
    const [key, value] = splitJoinRemainder(param, '=', 2);
    return {
      key,
      value
    };
  }

  /**
   * Splits a raw line at the colon delimiter into params and values portions.
   * Falls back to treating a single-segment line as an RRULE value.
   */
  static parseRawLine(line: RRuleLineString): RRuleRawLine {
    const [params, values] = splitJoinRemainder(line, RRULE_STRING_SPLITTER, 2);
    let result: RRuleRawLine;

    if (line.length === 1) {
      result = {
        params: 'RRULE',
        values: params
      };
    } else {
      result = {
        params,
        values
      };
    }

    return result;
  }

  // MARK: String
  /**
   * Splits a newline-delimited RRule string into individual line strings.
   */
  static toRRuleStringSet(lines: RRuleLines): RRuleStringLineSet {
    return lines.split('\n');
  }

  /**
   * Joins an array of RRule line strings into a single newline-delimited string.
   */
  static toRRuleLines(rruleStringSet: RRuleStringLineSet): RRuleLines {
    return rruleStringSet.join('\n');
  }

  // MARK: Assert
  /**
   * Asserts that the property has the expected type, throwing if it does not match.
   *
   * @throws Error if the property type does not match the expected type.
   */
  static assertPropertyType(type: RRulePropertyType, property: RRuleProperty): void {
    if (property.type !== type) {
      throw new Error(`Expected type ${type} but got ${property.type}`);
    }
  }
}
