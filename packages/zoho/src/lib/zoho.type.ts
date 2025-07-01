import { Maybe, MaybeNot, WebsitePath } from '@dereekb/util';

export interface ZohoModel {}

// MARK: V1
/**
 * General Zoho API GET request response sent by the v1 API.
 *
 * @deprecated
 */
export interface ZohoGetApiV1Result<T> {
  readonly response: {
    /**
     * Result value
     */
    readonly result: T;
    /**
     * Path to the resource.
     */
    readonly url: WebsitePath;
  };
}

// MARK: DateTime
/**
 * Similar to the ISO 8601 date-time format, but with milliseconds removed.
 *
 * yyyy-MM-ddTHH:mm:ss±HH:mm
 *
 * Examples:
 * 2019-05-02T11:17:33Z
 * 2019-05-02T11:17:33+00:00
 */
export type ZohoDateTimeString = string;

export function safeZohoDateTimeString(date: Date): ZohoDateTimeString;
export function safeZohoDateTimeString(date: MaybeNot): MaybeNot;
export function safeZohoDateTimeString(date: Maybe<Date>): Maybe<ZohoDateTimeString>;
export function safeZohoDateTimeString(date: Maybe<Date>): Maybe<ZohoDateTimeString> {
  return date != null ? zohoDateTimeString(date) : date;
}

/**
 * Converts the input date to a Zoho date.
 *
 * @param date
 * @returns
 */
export function zohoDateTimeString(date: Date): ZohoDateTimeString {
  const isoDate = date.toISOString();
  return isoDate.substring(0, isoDate.length - 5) + 'Z';
}
