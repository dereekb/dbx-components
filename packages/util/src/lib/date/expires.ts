import { Maybe } from '../value/maybe.type';
import { DateOrUnixDateTimeNumber, Milliseconds, addMilliseconds } from './date';
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
   * Current time override to use.
   */
  now?: Maybe<Date>;
  /**
   * The base date or time number to calculate expirations from.
   *
   * If not provided, defaults to now.
   */
  expiresFromDate?: Maybe<DateOrUnixDateTimeNumber>;
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
   * @param nowOverride
   */
  hasExpired(nowOverride?: Maybe<Date>): boolean;
  /**
   * Returns the expiration date.
   *
   * Returns null if no expiration is defined.
   *
   * @param nowOverride
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
  const { expiresAt, expires, now: inputNow, expiresFromDate, expiresIn } = input;
  const parsedExpiresFromDate = expiresFromDate != null ? dateFromDateOrTimeNumber(expiresFromDate) : null;

  function getNow(nowOverride?: Maybe<Date>) {
    const now = nowOverride ?? inputNow ?? new Date();
    return now;
  }

  function hasExpired(nowOverride?: Maybe<Date>) {
    const now = getNow(nowOverride);
    const expirationDate = getExpirationDateForNow(now);
    return expirationDate != null && expirationDate <= now;
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
      const date = parsedExpiresFromDate ?? now;
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
 * Convenience function for quickly calculating throttling given a throttle time and last run time.
 * 
 * Returns true if the throttle time has not passed since the last run time, compared to now.
 
 * @param throttleTime Time after "now" that expiration will occur.
 * @param lastRunAt Time the last run occurred.
 * @param now Optional override for the current time. Defaults to the current time.
 * @returns 
 */
export function isThrottled(throttleTime: Maybe<Milliseconds>, lastRunAt: Maybe<DateOrUnixDateTimeNumber>, now?: Maybe<Date>) {
  return !expirationDetails({ expiresFromDate: lastRunAt, expiresIn: throttleTime }).hasExpired(now);
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
