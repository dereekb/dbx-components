import { Maybe } from '@dereekb/util';
import { addMinutes, isPast } from 'date-fns';

/**
 * An object that can expire.
 */
export interface Expires {
  /**
   * Date this object expires at. If not defined, it has expired.
   */
  expiresAt?: Maybe<Date>;
}

/**
 * Returns true if any of the input items have expired.
 * 
 * If the list is empty, returns false.
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
 * Checks whether or not the item has expired. If no expiration date is set, it is considered expired.
 */
export function hasExpired(expires: Maybe<Expires>): boolean {
  const expiresAt = getExpiration(expires);
  return isPast(expiresAt);
}

/**
 * Returns the expiration date, or a date 1 minute in the past if not defined.
 */
export function getExpiration(expires: Maybe<Expires>): Date {
  return expires?.expiresAt ?? addMinutes(new Date(), -1);
}

