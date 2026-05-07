import { type Maybe } from '../value/maybe.type';
import { type DateOrUnixDateTimeMillisecondsNumber, type Milliseconds, addMilliseconds, dateFromDateOrTimeMillisecondsNumber } from './date';

// MARK: Expires
/**
 * An object that can expire.
 */
export interface Expires {
  /**
   * Date this object expires at. If not defined, it has expired.
   */
  expiresAt?: Maybe<Date>;
}

// MARK: Expiration Details
/**
 * Input configuration for the {@link expirationDetails}() function.
 *
 * The expiration date is resolved from the first matching field in this order:
 * 1. `expires.expiresAt` — pull from an existing Expires object
 * 2. `expiresAt` — direct expiration date
 * 3. `expiresFromDate + expiresIn` — base date plus a duration (negative `expiresIn` shifts the date earlier, useful for buffers/clock skew)
 *
 * @example
 * // Direct expiration date.
 * expirationDetails({ expiresAt: tokenExpiry });
 *
 * // From an existing Expires object.
 * expirationDetails({ expires: token });
 *
 * // Throttle / TTL: "next allowed run" is `lastRunAt + throttleMs`.
 * expirationDetails({ expiresFromDate: lastRunAt, expiresIn: throttleMs });
 *
 * // Pre-emptive refresh: treat the token as expired `bufferMs` before its real expiration.
 * expirationDetails({ expiresFromDate: token.expiresAt, expiresIn: -bufferMs, now: new Date(nowMs) });
 */
export interface ExpirationDetailsInput<T extends Expires = Expires> extends Expires {
  /**
   * Existing expires instance to use. Highest priority — wins over `expiresAt` and `expiresFromDate`/`expiresIn`.
   */
  expires?: Maybe<T>;
  /**
   * Default current "now" time to use.
   *
   * If not set, functions will use the current time (`new Date()`) when they are called. Always overridable per-call via the `nowOverride` argument on `hasExpired()`/`getExpirationDate()`.
   */
  now?: Maybe<Date>;
  /**
   * The base date or epoch milliseconds to calculate expirations from. Combined with `expiresIn` to produce the expiration date.
   *
   * If null/undefined and `expiresIn` is set, falls back to "now" unless `defaultExpiresFromDateToNow` is false.
   */
  expiresFromDate?: Maybe<DateOrUnixDateTimeMillisecondsNumber>;
  /**
   * If true (default), a missing `expiresFromDate` is treated as "now" when computing `expiresFromDate + expiresIn`.
   *
   * Set to false when a missing base date should mean "never run" (e.g. throttle predicates that should not consider a never-run action throttled).
   *
   * Defaults to true.
   */
  defaultExpiresFromDateToNow?: Maybe<boolean>;
  /**
   * Offset added to `expiresFromDate` (or "now") to produce the expiration date. Negative values shift the expiration earlier, which is the canonical way to express a clock-skew/refresh buffer.
   */
  expiresIn?: Maybe<Milliseconds>;
}

export interface ExpirationDetails<T extends Expires = Expires> {
  /**
   * Input used to create this instance.
   */
  readonly input: ExpirationDetailsInput<T>;
  /**
   * Returns true if the expiration time has passed.
   *
   * @param nowOverride Optional override for the current time. Defaults to the current time.
   * @param defaultIfNoExpirationDate If true, returns true if no expiration date is defined. Defaults to false.
   */
  hasExpired(nowOverride?: Maybe<Date>, defaultIfNoExpirationDate?: boolean): boolean;
  /**
   * Returns the expiration date.
   *
   * Returns null if no expiration is defined.
   *
   * @param nowOverride Optional override for the current time. Defaults to the current time.
   */
  getExpirationDate(nowOverride?: Maybe<Date>): Maybe<Date>;
}

/**
 * Returns an {@link ExpirationDetails} for the given input configuration.
 *
 * Use this when you need to ask whether something has expired or what its expiration date is. See {@link ExpirationDetailsInput} for how the expiration date is resolved (`expires` → `expiresAt` → `expiresFromDate + expiresIn`).
 *
 * Common patterns:
 * - **Direct expiration**: `expirationDetails({ expiresAt }).hasExpired()`
 * - **Wrap an existing object**: `expirationDetails({ expires: token }).hasExpired()`
 * - **TTL / throttle**: `expirationDetails({ expiresFromDate: lastRunAt, expiresIn: throttleMs })` — see {@link isThrottled}
 * - **Pre-emptive refresh**: `expirationDetails({ expiresFromDate: expiresAt, expiresIn: -bufferMs })` — treat as expired `bufferMs` before the real expiration, e.g. to refresh a token before it actually dies
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags expiration, expires, expiry, ttl, throttle, refresh, time-to-live
 * @dbxUtilRelated is-expired, is-throttled, calculate-expiration-date, is-under-threshold, check-atleast-one-not-expired, check-any-have-expired
 *
 * @template T - The type of Expires object
 * @param input - Configuration for calculating expiration
 * @returns An ExpirationDetails object that can determine expiration state
 */
export function expirationDetails<T extends Expires = Expires>(input: ExpirationDetailsInput<T>): ExpirationDetails<T> {
  const { expiresAt, expires, now: inputNow, expiresFromDate, defaultExpiresFromDateToNow, expiresIn } = input;
  const parsedExpiresFromDate = expiresFromDate == null ? null : dateFromDateOrTimeMillisecondsNumber(expiresFromDate);

  function getNow(nowOverride?: Maybe<Date>) {
    return nowOverride ?? inputNow ?? new Date();
  }

  function hasExpired(nowOverride?: Maybe<Date>, defaultIfNoExpirationDate: boolean = false) {
    const now = getNow(nowOverride);
    const expirationDate = getExpirationDateForNow(now);

    let result: boolean;

    if (expirationDate == null) {
      result = defaultIfNoExpirationDate;
    } else {
      result = expirationDate <= now;
    }

    return result;
  }

  function getExpirationDate(nowOverride?: Maybe<Date>) {
    const now = getNow(nowOverride);
    return getExpirationDateForNow(now);
  }

  function getExpirationDateForNow(now: Date): Maybe<Date> {
    let expirationDate: Maybe<Date> = null;

    // `expires` (when supplied) wins exclusively over the top-level fields per the documented
    // contract. If the supplied object has no `expiresAt`, the result is "no expiration" — we do
    // NOT fall through to top-level expiresAt/expiresIn, otherwise an Expires-typed value with a
    // null expiresAt would silently inherit unrelated top-level overrides.
    if (expires != null) {
      expirationDate = expires.expiresAt ?? null;
    } else if (expiresAt != null) {
      expirationDate = expiresAt;
    } else if (expiresIn != null) {
      const date = parsedExpiresFromDate ?? (defaultExpiresFromDateToNow !== false ? now : null);
      expirationDate = addMilliseconds(date, expiresIn);
    }

    return expirationDate;
  }

  return {
    input,
    hasExpired,
    getExpirationDate
  };
}

// MARK: Utility
/**
 * Convenience function for calculating and returning the expiration date given the input.
 * This is a shorthand for expirationDetails(input).getExpirationDate().
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags expiration, expires, expiry, ttl, calculate, date
 * @dbxUtilRelated expiration-details, is-expired
 *
 * @param input - Input configuration used to calculate the expiration date
 * @returns The calculated expiration date, or null if no expiration is defined
 */
export function calculateExpirationDate(input: ExpirationDetailsInput<Expires>): Maybe<Date> {
  return expirationDetails(input).getExpirationDate();
}

// MARK: isExpired
/**
 * Convenience wrapper around {@link expirationDetails}().hasExpired() that treats null/undefined input or no expiration date as expired.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags expiration, expires, expiry, expired, has-expired, is-expired, ttl
 * @dbxUtilRelated expiration-details, is-throttled, calculate-expiration-date
 *
 * @param input - Expiration configuration. Null/undefined is treated as expired.
 * @param now - Optional override for the current time. Defaults to the current time. Apply any buffer (e.g. for clock skew or pre-emptive refresh) by shifting this value forward.
 * @returns True when the input is null/undefined or its expiration date has passed; otherwise false.
 *
 * @example
 * isExpired(null); // true
 * isExpired({ expiresAt: pastDate }); // true
 * isExpired({ expiresAt: futureDate }); // false
 * isExpired({ expiresAt: futureDate }, addMilliseconds(new Date(), 60_000)); // true (when within buffer)
 */
export function isExpired<T extends Expires = Expires>(input: Maybe<ExpirationDetailsInput<T>>, now?: Maybe<Date>): boolean {
  let result = true;

  if (input != null) {
    result = expirationDetails(input).hasExpired(now, true);
  }

  return result;
}

/**
 * Returns true if the threshold has not passed since the next run time, compared to now.
 *
 * Used in cases where a date that was calculated using the "threshold" value is given and we want to check if we are still within that threshold.
 *
 * Example:
 * - Should send a notification at max every 2 days. The threshold is 2 days in milliseconds, and "nextRunAt" is the previously calculated date that was originally "now" + "threshold".
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags threshold, throttle, ttl, time-window, rate-limit
 * @dbxUtilRelated is-throttled, expiration-details
 *
 * @param threshold The threshold time. Typically this is amount of time that was used to calculate the original "nextRunAt" time.
 * @param nextRunAt Time the next run will occur. If null/undefined, then this function will return false.
 * @param now Optional override for the current time. Defaults to the current time.
 * @returns True if the threshold has not passed since the next run time, compared to now.
 */
export function isUnderThreshold(threshold: Milliseconds, nextRunAt: Maybe<DateOrUnixDateTimeMillisecondsNumber>, now?: Maybe<Date>): boolean {
  if (nextRunAt == null) {
    return false;
  }

  return !isThrottled(-threshold, nextRunAt, now);
}

/**
 * Convenience function for quickly calculating throttling given a throttle time and last run time.
 *
 * Returns true if the throttle time has not passed since the last run time, compared to now.
 * This is useful for rate limiting operations (e.g., "only allow this action once every X milliseconds").
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags throttle, throttled, rate-limit, debounce, ttl, expiration
 * @dbxUtilRelated expiration-details, is-under-threshold, is-expired
 *
 * @param throttleTime - Minimum time in milliseconds that must pass between operations
 * @param lastRunAt - Timestamp when the operation was last performed
 * @param now - Optional override for the current time (defaults to the current time)
 * @returns True if the operation should be throttled (not enough time has passed), false otherwise
 */
export function isThrottled(throttleTime: Maybe<Milliseconds>, lastRunAt: Maybe<DateOrUnixDateTimeMillisecondsNumber>, now?: Maybe<Date>) {
  return !expirationDetails({ defaultExpiresFromDateToNow: false, expiresFromDate: lastRunAt ?? null, expiresIn: throttleTime }).hasExpired(now, true);
}

/**
 * Returns true if at least one of the input ExpirationDetails has not expired.
 * Useful for checking if any items in a collection are still valid.
 *
 * If the list is empty, returns false.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags expiration, valid, collection, any
 * @dbxUtilRelated expiration-details, check-any-have-expired
 *
 * @param details - Collection of ExpirationDetails to check
 * @returns True if at least one item has not expired, false otherwise
 */
export function checkAtleastOneNotExpired(details: ExpirationDetails<Expires>[]): boolean {
  const firstExpired = details.findIndex((detail) => !detail.hasExpired());
  return firstExpired !== -1;
}

/**
 * Returns true if any of the input ExpirationDetails have expired.
 * Useful for checking if any items in a collection need to be refreshed or removed.
 *
 * If the list is empty, returns the value specified by defaultIfEmpty.
 *
 * @dbxUtil
 * @dbxUtilCategory date
 * @dbxUtilTags expiration, refresh, collection, any
 * @dbxUtilRelated expiration-details, check-atleast-one-not-expired
 *
 * @param details - Collection of ExpirationDetails to check
 * @param defaultIfEmpty - Default value to return if the list is empty (defaults to true)
 * @returns True if any item has expired, or the defaultIfEmpty value for an empty list
 */
export function checkAnyHaveExpired(details: ExpirationDetails<Expires>[], defaultIfEmpty: boolean = true): boolean {
  if (details.length === 0) {
    return defaultIfEmpty;
  }

  const firstExpired = details.findIndex((detail) => detail.hasExpired());
  return firstExpired !== -1;
}
