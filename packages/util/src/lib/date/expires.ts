import { type Maybe } from '../value/maybe.type';
import { type DateOrUnixDateTimeNumber, type Milliseconds, addMilliseconds } from './date';
import { dateFromDateOrTimeNumber } from './date.unix';

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
 * expirationDetails() input.
 *
 * The priority that the expiration calculation uses takes the following order:
 * 1. expires
 * 2. expiresAt
 * 3. date + expiresIn
 */
export interface ExpirationDetailsInput<T extends Expires = Expires> extends Expires {
  /**
   * Existing expires instance to use.
   *
   * If provided/
   */
  expires?: Maybe<T>;
  /**
   * Default current now time to use.
   *
   * If not set, functions will use the current time when they are called.
   */
  now?: Maybe<Date>;
  /**
   * The base date or time number to calculate expirations from.
   *
   * If not defined, the expiresFromDate is considered to have never been run/set.
   */
  expiresFromDate?: Maybe<DateOrUnixDateTimeNumber>;
  /**
   * If true, the "expiresFromDate" will default to the calculated now time when calculating the expiration.
   *
   * Defaults to true.
   */
  defaultExpiresFromDateToNow?: Maybe<boolean>;
  /**
   * Time after "now" that expiration will occur.
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
 * Returns expiration details for the input.
 *
 * @param input
 * @returns
 */
export function expirationDetails<T extends Expires = Expires>(input: ExpirationDetailsInput<T>): ExpirationDetails<T> {
  const { expiresAt, expires, now: inputNow, expiresFromDate, defaultExpiresFromDateToNow, expiresIn } = input;
  const parsedExpiresFromDate = expiresFromDate != null ? dateFromDateOrTimeNumber(expiresFromDate) : null;

  function getNow(nowOverride?: Maybe<Date>) {
    const now = nowOverride ?? inputNow ?? new Date();
    return now;
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

    if (expires?.expiresAt != null) {
      expirationDate = expires.expiresAt;
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
 *
 * @param input Input used to calculate the expiration date.
 * @returns The expiration date, if applicable.
 */
export function calculateExpirationDate(input: ExpirationDetailsInput<any>): Maybe<Date> {
  return expirationDetails(input).getExpirationDate();
}

/**
 * Returns true if the threshold has not passed since the next run time, compared to now.
 *
 * Used in cases where a date that was calculated using the "threshold" value is given and we want to check if we are still within that threshold.
 *
 * Example:
 * - Should send a notification at max every 2 days. The threshold is 2 days in milliseconds, and "nextRunAt" is the previously calculated date that was originally "now" + "threshold".
 *
 * @param threshold The threshold time. Typically this is amount of time that was used to calculate the original "nextRunAt" time.
 * @param nextRunAt Time the next run will occur. If null/undefined, then this function will return false.
 * @param now Optional override for the current time. Defaults to the current time.
 * @returns True if the threshold has not passed since the next run time, compared to now.
 */
export function isUnderThreshold(threshold: Milliseconds, nextRunAt: Maybe<DateOrUnixDateTimeNumber>, now?: Maybe<Date>): boolean {
  if (nextRunAt == null) {
    return false;
  }

  return !isThrottled(-threshold, nextRunAt, now);
}

/**
 * Convenience function for quickly calculating throttling given a throttle time and last run time.
 * 
 * Returns true if the throttle time has not passed since the last run time, compared to now.
 
 * @param throttleTime Time after "now" that expiration will occur.
 * @param lastRunAt Time the last run occurred. If the run has never occured then this function will return false.
 * @param now Optional override for the current time. Defaults to the current time.
 * @returns True if the throttle time has not passed since the last run time, compared to now.
 */
export function isThrottled(throttleTime: Maybe<Milliseconds>, lastRunAt: Maybe<DateOrUnixDateTimeNumber>, now?: Maybe<Date>) {
  return !expirationDetails({ defaultExpiresFromDateToNow: false, expiresFromDate: lastRunAt ?? null, expiresIn: throttleTime }).hasExpired(now, true);
}

/**
 * Returns true if any of the input ExpirationDetails have not expired.
 *
 * If the list is empty, returns false.
 *
 * @param details List of ExpirationDetails to check.
 * @returns True if any of the input ExpirationDetails have not expired.
 */
export function checkAtleastOneNotExpired(details: ExpirationDetails<any>[]): boolean {
  const firstExpired = details.findIndex((detail) => !detail.hasExpired());
  return firstExpired !== -1;
}

/**
 * Returns true if any of the input ExpirationDetails have expired.
 *
 * If the list is empty, returns the value of the second argument.
 *
 * @param details List of ExpirationDetails to check.
 * @param defaultIfEmpty Default value to return if the list is empty. True by default.
 * @returns True if any of the input ExpirationDetails have expired.
 */
export function checkAnyHaveExpired(details: ExpirationDetails<any>[], defaultIfEmpty: boolean = true): boolean {
  if (details.length === 0) {
    return defaultIfEmpty;
  }

  const firstExpired = details.findIndex((detail) => detail.hasExpired());
  return firstExpired !== -1;
}
