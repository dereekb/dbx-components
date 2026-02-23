import { type Milliseconds, type DateOrUnixDateTimeMillisecondsNumber, expirationDetails, type Expires } from '@dereekb/util';
import { filter, map, type MonoTypeOperatorFunction, type Observable, type OperatorFunction, skipWhile, switchMap, takeWhile } from 'rxjs';

/**
 * Creates a new Expires object at the current time on emission that will expire in the set amount of time.
 *
 * @param expiresIn
 * @returns
 */
export function toExpiration<T>(expiresIn: number): OperatorFunction<T, Expires> {
  return map(() => {
    const now = new Date();
    const expirationDate = expirationDetails({ expiresFromDate: now, expiresIn }).getExpirationDate();
    return { expiresAt: expirationDate };
  });
}

/**
 * Filters further emissions once the input is expired.
 */
export function skipExpired<T extends Expires>(): MonoTypeOperatorFunction<T> {
  return filter((expires) => !expirationDetails({ expires }).hasExpired());
}

/**
 * Skips the input date or timenumber until expiration occurs.
 */
export function skipUntilExpiration(expiresIn?: number): MonoTypeOperatorFunction<DateOrUnixDateTimeMillisecondsNumber> {
  return filter((x) => expirationDetails({ expiresFromDate: x, expiresIn }).hasExpired());
}

/**
 * Skips the input date or timenumber after expiration occurs.
 */
export function skipAfterExpiration(expiresIn?: number): MonoTypeOperatorFunction<DateOrUnixDateTimeMillisecondsNumber> {
  return filter((x) => !expirationDetails({ expiresFromDate: x, expiresIn }).hasExpired());
}

/**
 * Skips emissions until time since the last emission from the watch observable has elapsed.
 */
export function skipUntilTimeElapsedAfterLastEmission<T>(watch: Observable<unknown>, takeFor: Milliseconds): MonoTypeOperatorFunction<T> {
  return (observable: Observable<T>) => {
    return watch.pipe(
      switchMap(() => {
        const details = expirationDetails({ expiresFromDate: new Date(), expiresIn: takeFor });
        return observable.pipe(takeWhile(() => !details.hasExpired()));
      })
    );
  };
}

/**
 * Takes emissions until time since the last emission from the watch observable has elapsed.
 */
export function takeAfterTimeElapsedSinceLastEmission<T>(watch: Observable<unknown>, skipFor: Milliseconds): MonoTypeOperatorFunction<T> {
  return (observable: Observable<T>) => {
    return watch.pipe(
      switchMap(() => {
        const details = expirationDetails({ expiresFromDate: new Date(), expiresIn: skipFor });
        return observable.pipe(skipWhile(() => !details.hasExpired()));
      })
    );
  };
}
