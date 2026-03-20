import { type Maybe, type MaybeNot } from '@dereekb/util';

/**
 * Base marker interface for Zoho data models.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ZohoModel {}

// MARK: DateTime
/**
 * Zoho's date-time string format, similar to ISO 8601 but with milliseconds removed.
 *
 * Format: `yyyy-MM-ddTHH:mm:ss±HH:mm`
 *
 * @example `'2019-05-02T11:17:33Z'`
 * @example `'2019-05-02T11:17:33+00:00'`
 */
export type ZohoDateTimeString = string;

/**
 * Null-safe version of {@link zohoDateTimeString}. Returns the converted string
 * when a {@link Date} is provided, or passes through `null`/`undefined` as-is.
 *
 * @param date - Date to convert, or nullish value
 * @returns Zoho-formatted date-time string, or the original nullish value
 */
export function safeZohoDateTimeString(date: Date): ZohoDateTimeString;
export function safeZohoDateTimeString(date: MaybeNot): MaybeNot;
export function safeZohoDateTimeString(date: Maybe<Date>): Maybe<ZohoDateTimeString>;
export function safeZohoDateTimeString(date: Maybe<Date>): Maybe<ZohoDateTimeString> {
  return date != null ? zohoDateTimeString(date) : date;
}

/**
 * Converts a {@link Date} to a {@link ZohoDateTimeString} by stripping milliseconds
 * from the ISO 8601 representation.
 *
 * @param date - Date to convert
 * @returns Zoho-formatted date-time string (e.g. `'2019-05-02T11:17:33Z'`)
 *
 * @example
 * ```typescript
 * zohoDateTimeString(new Date('2019-05-02T11:17:33.000Z'));
 * // => '2019-05-02T11:17:33Z'
 * ```
 */
export function zohoDateTimeString(date: Date): ZohoDateTimeString {
  const isoDate = date.toISOString();
  return isoDate.substring(0, isoDate.length - 5) + 'Z';
}
