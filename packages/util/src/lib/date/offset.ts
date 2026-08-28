import { padStartFunction } from '../string/transform';
import { MINUTES_IN_HOUR, type Minutes } from './date';

/**
 * A UTC offset rendered in the ISO 8601 basic format, as a sign followed by two-digit hours and minutes.
 *
 * Examples:
 * - -0600
 * - +0530
 * - +0000
 *
 * @semanticType
 * @semanticTopic timezone
 * @semanticTopic string
 */
export type UtcOffsetString = string;

/**
 * Pads an hour or minute component of a {@link UtcOffsetString} to two digits.
 */
const padUtcOffsetPart = padStartFunction(2, '0');

/**
 * Formats a UTC offset in minutes as a {@link UtcOffsetString}. I.E. "-0600", "+0530".
 *
 * This is the ISO 8601 basic-format offset, which is also the format RFC 5545 3.3.14 defines for a UTC-OFFSET
 * value. A zero offset renders as "+0000".
 *
 * @param minutes - The offset from UTC in minutes. Negative is west of UTC.
 * @returns The UTC offset string.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags date, timezone, utc, offset, string, format
 * @dbxUtilRelated utc-timezone-string, has-same-timezone
 *
 * @__NO_SIDE_EFFECTS__
 */
export function utcOffsetString(minutes: Minutes): UtcOffsetString {
  const totalMinutes = Math.trunc(Math.abs(minutes));
  const sign = minutes < 0 ? '-' : '+';
  const hours = padUtcOffsetPart(String(Math.floor(totalMinutes / MINUTES_IN_HOUR)));
  const remainderMinutes = padUtcOffsetPart(String(totalMinutes % MINUTES_IN_HOUR));

  return `${sign}${hours}${remainderMinutes}`;
}
