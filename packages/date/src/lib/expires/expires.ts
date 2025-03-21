import { dateFromDateOrTimeNumber } from '../date/date.unix';
import { type Expires, type DateOrUnixDateTimeNumber, type Maybe, type Milliseconds } from '@dereekb/util';
import { addMilliseconds, addMinutes, isPast } from 'date-fns';
export type { Expires } from '@dereekb/util';

// MARK: Compat
/**
 * Returns true if any of the input items have expired.
 *
 * If the list is empty, returns false.
 *
 * @deprecated Use ExpirationDetails and checkAtleastOneNotExpired() instead.
 */
export function atleastOneNotExpired(expires: Maybe<Expires>[]): boolean {
  for (const expire of expires) {
    if (!hasExpired(expire)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true if any of the input items has expired.
 *
 * If the list is empty, returns the second argument, or true by default.
 *
 * @deprecated Use ExpirationDetails and checkAnyHaveExpired() instead.
 */
export function anyHaveExpired(expires: Maybe<Expires>[], expireIfEmpty = true): boolean {
  if (expires.length === 0) {
    return expireIfEmpty;
  }

  for (const expire of expires) {
    if (hasExpired(expire)) {
      return true;
    }
  }

  return false;
}

/**
 * Convenience function for checking if the input time has expired.
 *
 * @param timeNumber
 * @param expiresIn
 * @returns
 *
 * @deprecated Use isThrottled() or expirationDetails({ expiresFromDate: time, expiresIn }).hasExpired() instead.
 */
export function timeHasExpired(time: Maybe<DateOrUnixDateTimeNumber>, expiresIn?: Milliseconds): boolean {
  return hasExpired(toExpires(time, expiresIn));
}

/**
 * Creates an Expires object from the input date or time number.
 *
 * @deprecated Use ExpirationDetails instead.
 *
 * @param timeNumber Number to convert to a date.
 * @param expiresIn If the input number is the initial date, and not the expiration date, this is used to find the expiresAt time.
 */
export function toExpires(time: Maybe<DateOrUnixDateTimeNumber>, expiresIn?: Milliseconds): Expires {
  let expiresAt = dateFromDateOrTimeNumber(time);

  if (expiresAt && expiresIn != null) {
    expiresAt = addMilliseconds(expiresAt, expiresIn);
  }

  return {
    expiresAt
  };
}

/**
 * Checks whether or not the item has expired. If no expiration date is set, it is considered expired.
 *
 * @deprecated Use ExpirationDetails instead.
 */
export function hasExpired(expires: Maybe<Expires>): boolean {
  const expiresAt = getExpiration(expires);
  return isPast(expiresAt);
}

/**
 * Returns the expiration date, or a date 1 minute in the past if not defined.
 *
 * @deprecated Use ExpirationDetails instead.
 */
export function getExpiration(expires: Maybe<Expires>): Date {
  return expires?.expiresAt ?? addMinutes(new Date(), -1);
}
