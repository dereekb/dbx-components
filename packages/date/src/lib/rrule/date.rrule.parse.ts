import { TimezoneString, CommaSeparatedString, flattenArray, Maybe } from '@dereekb/util';
import { format } from 'date-fns-tz';
import { DateSet } from '../date';
import { baseDateToNormalDate } from '../date/date.timezone';

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

export const RRuleStringSplitter = ':';

export class DateRRuleParseUtility {

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
      exdates = new DateSet(flattenArray(exdateRules.map((date) => {
        return DateRRuleParseUtility.parseExdateAttributeFromLine(date).dates;
      })));
    }

    return {
      basic,
      exdates,
      input
    };
  }

  // MARK: Rules Parsing
  static parseExdateAttributeFromLine(line: RRuleLineString): RRuleExdateAttribute {
    const property = this.parseProperty(line);
    DateRRuleParseUtility.assertPropertyType('EXDATE', property);
    return DateRRuleParseUtility.parseExdateAttributeFromProperty(property);
  }

  static parseExdateAttributeFromProperty(property: RRuleProperty): RRuleExdateAttribute {
    const timezone: Maybe<TimezoneString> = property.params.find(x => x.key === 'TZID')?.value;
    const rawDates: (RFC5545DateString | RFC5545DateTimeString)[] = property.values.split(',');
    const dates = rawDates.map(x => DateRRuleParseUtility.parseDateTimeString(x, timezone));
    return {
      timezone,
      dates
    };
  }

  /**
   * Parses the input Date-Time string.
   *
   * Timezone used to convert date to UTC if date is not specified in UTC (ends in Z).
   */
  static parseDateTimeString(rfcDateString: RFC5545DateString | RFC5545DateTimeString, timezone?: Maybe<TimezoneString>): Date {
    const RFC5545_DATE_TIME_FORMAT = /^((\d{4})(\d{2})(\d{2}))(T(\d{2})(\d{2})(\d{2})Z?)?$/;
    const isDateString = (rfcDateString.length === 6);
    const isUTCDate = isDateString || rfcDateString.endsWith('Z');

    const parsed = RFC5545_DATE_TIME_FORMAT.exec(rfcDateString);

    if (parsed == null) {
      throw new Error(`Failed parsing input rfcDateString "${rfcDateString}"`);
    }

    const [full, yearDate, yearS, monthS, dayS, time, hourS, minuteS, secondS] = parsed!;
    const [year, month, day, hour, minute, second] = [yearS, monthS, dayS, hourS, minuteS, secondS].map(x => (x) ? Number.parseInt(x, 10) : 0);

    const utcDate = new Date(Date.UTC(year, (month - 1), day, hour, minute, second));
    let date: Date = utcDate;

    if (!isUTCDate) {

      // Date was provided in a local timezone value. Convert to UTC.
      if (timezone) {
        date = baseDateToNormalDate(utcDate, timezone);
      } else {
        throw new Error('No timezone was provided when parsing DateTime string.');
      }
    }

    return date;
  }

  static formatDateTimeString(date: Date): RFC5545DateTimeString {
    return format(date, `yyyyMMdd'T'HHmmss'Z'`);
  }

  static parseProperty(line: RRuleLineString): RRuleProperty {
    const rawLine: RRuleRawLine = DateRRuleParseUtility.parseRawLine(line);
    return DateRRuleParseUtility.propertyFromRawLine(rawLine);
  }

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

  static parseRawParam(param: RRuleRawParamString): RRuleParam {
    const [key, value] = param.split('=', 2);
    return {
      key,
      value
    };
  }

  static parseRawLine(line: RRuleLineString): RRuleRawLine {
    const [params, values] = line.split(RRuleStringSplitter, 2);

    if (line.length === 1) {
      return {
        params: 'RRULE',
        values: params
      };
    } else {
      return {
        params,
        values
      };
    }
  }

  // MARK: String
  static toRRuleStringSet(lines: RRuleLines): RRuleStringLineSet {
    return lines.split('\n');
  }

  static toRRuleLines(rruleStringSet: RRuleStringLineSet): RRuleLines {
    return rruleStringSet.join('\n');
  }

  // MARK: Assert
  static assertPropertyType(type: RRulePropertyType, property: RRuleProperty): void {
    if (property.type !== type) {
      throw new Error(`Expected type ${type} but got ${property.type}`);
    }
  }

}
