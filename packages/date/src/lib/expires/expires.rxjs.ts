import { type Milliseconds, type DateOrUnixDateTimeNumber } from '@dereekb/util';
import { filter, map, type MonoTypeOperatorFunction, type Observable, type OperatorFunction, skipWhile, switchMap, takeWhile } from 'rxjs';
import { hasExpired, toExpires, type Expires, timeHasExpired } from './expires';

// TODO: Deprecate and move to @dereekb/rxjs

/**
 * Creates a new Expires object at the current time on emission that will expire in the set amount of time.
 *
 * @param expiresIn
 * @returns
 */
export function toExpiration<T>(expiresIn: number): OperatorFunction<T, Expires> {
  return map(() => toExpires(new Date(), expiresIn));
}

/**
 * Filters further emissions once the input is expired.
 */
export function skipExpired<T extends Expires>(): MonoTypeOperatorFunction<T> {
  return filter((expires) => !hasExpired(expires));
}

/**
 * Skips the input date or timenumber until expiration occurs.
 */
export function skipUntilExpiration(expiresIn?: number): MonoTypeOperatorFunction<DateOrUnixDateTimeNumber> {
  return filter((x) => timeHasExpired(x, expiresIn));
}

/**
 * Skips the input date or timenumber after expiration occurs.
 */
export function skipAfterExpiration(expiresIn?: number): MonoTypeOperatorFunction<DateOrUnixDateTimeNumber> {
  return filter((x) => !timeHasExpired(x, expiresIn));
}

/**
 * Skips emissions until time since the last emission from the watch observable has elapsed.
 */
export function skipUntilTimeElapsedAfterLastEmission<T>(watch: Observable<unknown>, takeFor: Milliseconds): MonoTypeOperatorFunction<T> {
  return (observable: Observable<T>) => {
    return watch.pipe(
      switchMap(() => {
        const expires = toExpires(new Date(), takeFor);
        return observable.pipe(takeWhile(() => !hasExpired(expires)));
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
        const expires = toExpires(new Date(), skipFor);
        return observable.pipe(skipWhile(() => !hasExpired(expires)));
      })
    );
  };
}
