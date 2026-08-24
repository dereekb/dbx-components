import { type EmailAddress, type EscapeStringCharactersFunction, escapeStringCharactersFunction, type LatLngPoint, type Maybe, type Minutes, type ISO8601DayString, MINUTES_IN_DAY, MINUTES_IN_HOUR, padStartFunction, type TimezoneString, UTC_TIMEZONE_STRING } from '@dereekb/util';
import { formatInTimeZone } from 'date-fns-tz';
import { type RFC5545DateString, type RFC5545DateTimeString } from '../rrule/date.rrule.parse';
import { type ICalendarCalAddress, type ICalendarParameterValue, type ICalendarTextValue, type ICalendarValue, ICALENDAR_VALUE_LIST_SEPARATOR } from './icalendar';

/**
 * Format used for an RFC 5545 DATE-TIME value rendered as a UTC instant.
 */
export const ICALENDAR_UTC_DATE_TIME_FORMAT = `yyyyMMdd'T'HHmmss'Z'`;

/**
 * Format used for an RFC 5545 DATE-TIME value rendered as a wall clock in a named zone.
 */
export const ICALENDAR_LOCAL_DATE_TIME_FORMAT = `yyyyMMdd'T'HHmmss`;

/**
 * Format used for an RFC 5545 DATE value.
 */
export const ICALENDAR_DATE_FORMAT = `yyyyMMdd`;

/**
 * Escapes the characters RFC 5545 3.3.11 requires escaping within a TEXT value.
 *
 * NOTE: the colon is deliberately NOT escaped. Colon escaping is a vCard 2.1 rule, not an iCalendar one, and
 * over-escaping it visibly corrupts DESCRIPTION/SUMMARY text in every client.
 *
 * Input must have its line breaks normalized to a bare "\n" first, since escaping is per-character.
 * Prefer {@link iCalendarTextValue}, which does that normalization.
 */
export const escapeICalendarText: EscapeStringCharactersFunction = escapeStringCharactersFunction({
  escapeTargets: ['\\', ';', ',', '\n'],
  escapeCharacter: (char: string) => (char === '\n' ? String.raw`\n` : `\\${char}`)
});

/**
 * Matches CRLF and bare CR line breaks so they can be normalized to LF before escaping.
 */
const ICALENDAR_LINE_BREAK_NORMALIZATION_REGEX = /\r\n|\r/g;

/**
 * Encodes the input as an RFC 5545 TEXT value.
 *
 * Line breaks are normalized to LF before escaping, since {@link escapeICalendarText} operates one character
 * at a time and would otherwise turn a single CRLF into two escaped newlines.
 *
 * @param input - Raw, unescaped text.
 * @returns The escaped TEXT value.
 *
 * @example
 * ```ts
 * iCalendarTextValue('Hello, World; this is\r\na test'); // 'Hello\\, World\\; this is\\na test'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarTextValue(input: string): ICalendarTextValue {
  return escapeICalendarText(input.replaceAll(ICALENDAR_LINE_BREAK_NORMALIZATION_REGEX, '\n'));
}

/**
 * Encodes an array of strings as a comma-separated RFC 5545 TEXT list. I.E. the value of CATEGORIES.
 *
 * Each element is escaped individually, so a comma inside an element does not become a list separator.
 *
 * @param input - Raw, unescaped text values.
 * @returns The comma-joined list of escaped TEXT values.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarTextListValue(input: readonly string[]): ICalendarTextValue {
  return input.map(iCalendarTextValue).join(ICALENDAR_VALUE_LIST_SEPARATOR);
}

/**
 * Formats a moment as an RFC 5545 DATE-TIME value in UTC. I.E. "20260315T140000Z".
 *
 * Always renders the UTC wall clock, regardless of the system timezone.
 *
 * @param date - Moment to render.
 * @returns The UTC DATE-TIME value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarUtcDateTimeString(date: Date): RFC5545DateTimeString {
  return formatInTimeZone(date, UTC_TIMEZONE_STRING, ICALENDAR_UTC_DATE_TIME_FORMAT);
}

/**
 * Formats a moment as an RFC 5545 DATE-TIME value rendered as the wall clock in the given timezone. I.E. "20260315T090000".
 *
 * The result carries no "Z" suffix: the caller is responsible for emitting the accompanying TZID parameter.
 *
 * @param date - Moment to render.
 * @param timezone - The zone whose wall clock is rendered.
 * @returns The local (zoned) DATE-TIME value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarZonedDateTimeString(date: Date, timezone: TimezoneString): RFC5545DateTimeString {
  return formatInTimeZone(date, timezone, ICALENDAR_LOCAL_DATE_TIME_FORMAT);
}

/**
 * Formats a moment as a floating RFC 5545 DATE-TIME value with no zone and no "Z" suffix.
 *
 * Only used within a VTIMEZONE sub-component, where DTSTART is defined to be the local time of the transition.
 *
 * @param date - Moment whose UTC wall clock is rendered as if it were floating local time.
 * @returns The floating DATE-TIME value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarFloatingDateTimeString(date: Date): RFC5545DateTimeString {
  return formatInTimeZone(date, UTC_TIMEZONE_STRING, ICALENDAR_LOCAL_DATE_TIME_FORMAT);
}

/**
 * Matches the dashes in an ISO 8601 day string so they can be stripped.
 */
const ICALENDAR_DAY_STRING_DASH_REGEX = /-/g;

/**
 * Renders a calendar day as an RFC 5545 DATE value. I.E. "2026-03-15" becomes "20260315".
 *
 * @param day - Calendar day to render.
 * @returns The RFC 5545 DATE value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarDateString(day: ISO8601DayString): RFC5545DateString {
  return day.replaceAll(ICALENDAR_DAY_STRING_DASH_REGEX, '');
}

/**
 * Formats a number of minutes as an RFC 5545 DURATION value. I.E. "PT1H30M", "P2D", "-PT15M".
 *
 * Days are only emitted for whole-day durations, matching how clients render them. A zero duration is "PT0S".
 *
 * @param minutes - The duration in minutes. A negative value produces a negative duration.
 * @returns The DURATION value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarDurationString(minutes: Minutes): ICalendarValue {
  const totalMinutes = Math.trunc(Math.abs(minutes));
  const sign = minutes < 0 ? '-' : '';

  let result: ICalendarValue;

  if (totalMinutes === 0) {
    result = 'PT0S';
  } else if (totalMinutes % MINUTES_IN_DAY === 0) {
    result = `P${totalMinutes / MINUTES_IN_DAY}D`;
  } else {
    const hours = Math.floor(totalMinutes / MINUTES_IN_HOUR);
    const remainderMinutes = totalMinutes % MINUTES_IN_HOUR;
    const hoursPart = hours > 0 ? `${hours}H` : '';
    const minutesPart = remainderMinutes > 0 ? `${remainderMinutes}M` : '';
    result = `PT${hoursPart}${minutesPart}`;
  }

  return `${sign}${result}`;
}

/**
 * Pads an hour or minute component of a UTC-OFFSET value to the two digits RFC 5545 3.3.14 requires.
 */
const padUtcOffsetPart = padStartFunction(2, '0');

/**
 * Formats a UTC offset in minutes as an RFC 5545 UTC-OFFSET value. I.E. "-0600", "+0530".
 *
 * Only used within a VTIMEZONE sub-component.
 *
 * @param minutes - The offset from UTC in minutes. Negative is west of UTC.
 * @returns The UTC-OFFSET value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarUtcOffsetString(minutes: Minutes): ICalendarValue {
  const totalMinutes = Math.trunc(Math.abs(minutes));
  const sign = minutes < 0 ? '-' : '+';
  const hours = padUtcOffsetPart(String(Math.floor(totalMinutes / MINUTES_IN_HOUR)));
  const remainderMinutes = padUtcOffsetPart(String(totalMinutes % MINUTES_IN_HOUR));

  return `${sign}${hours}${remainderMinutes}`;
}

/**
 * Matches the double-quote character, which cannot be represented inside a quoted parameter value.
 */
const ICALENDAR_PARAMETER_QUOTE_REGEX = /"/g;

/**
 * Characters that force a parameter value to be quoted, per RFC 5545 3.1.
 */
const ICALENDAR_PARAMETER_QUOTE_REQUIRED_CHARACTERS = [':', ';', ','];

/**
 * Encodes a value for use as an iCalendar property parameter value.
 *
 * Parameter values have no escape mechanism: a value containing a colon, semicolon or comma must instead be
 * wrapped in double quotes, and a double quote within the value cannot be represented at all, so it is stripped.
 *
 * @param value - The raw parameter value.
 * @returns The encoded parameter value.
 *
 * @example
 * ```ts
 * iCalendarParameterValue('America/Denver');    // 'America/Denver'
 * iCalendarParameterValue('Smith, John');       // '"Smith, John"'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarParameterValue(value: string): ICalendarParameterValue {
  const stripped = value.replaceAll(ICALENDAR_PARAMETER_QUOTE_REGEX, '');
  const requiresQuoting = ICALENDAR_PARAMETER_QUOTE_REQUIRED_CHARACTERS.some((x) => stripped.includes(x));

  return requiresQuoting ? `"${stripped}"` : stripped;
}

/**
 * Matches any URI scheme prefix. I.E. "mailto:", "https:".
 */
const ICALENDAR_URI_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Encodes an email address or existing URI as an RFC 5545 CAL-ADDRESS value.
 *
 * A bare email address is given the "mailto:" scheme; an input that already carries a URI scheme passes through.
 *
 * @param input - An email address or an already-schemed URI.
 * @returns The CAL-ADDRESS value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarCalAddressValue(input: EmailAddress | ICalendarCalAddress): ICalendarCalAddress {
  return ICALENDAR_URI_SCHEME_REGEX.test(input) ? input : `mailto:${input}`;
}

/**
 * Encodes a point as an RFC 5545 GEO value. I.E. "39.7392;-104.9903".
 *
 * The semicolon is a structural separator here, not escaped content.
 *
 * @param point - The point to render.
 * @returns The GEO value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarGeoValue(point: LatLngPoint): ICalendarValue {
  return `${point.lat};${point.lng}`;
}

/**
 * Renders a flag as an RFC 5545 BOOLEAN value. I.E. "TRUE", "FALSE".
 *
 * @param value - Flag to render.
 * @returns The RFC 5545 BOOLEAN value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarBooleanValue(value: boolean): ICalendarValue {
  return value ? 'TRUE' : 'FALSE';
}

/**
 * Encodes an integer as an RFC 5545 INTEGER value.
 *
 * @param value - The number to render. Truncated toward zero.
 * @returns The INTEGER value.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function iCalendarIntegerValue(value: number): ICalendarValue {
  return `${Math.trunc(value)}`;
}

/**
 * Returns whether the input is a non-empty string, used to decide whether an optional property is emitted.
 *
 * @param input - The value to test.
 * @returns True when the value is a string with at least one non-whitespace character.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function hasICalendarValue(input: Maybe<string>): input is string {
  return typeof input === 'string' && input.trim().length > 0;
}
