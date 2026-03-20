import { type Milliseconds, type DateOrUnixDateTimeMillisecondsNumber, expirationDetails, type Expires } from '@dereekb/util';
import { filter, map, type MonoTypeOperatorFunction, type Observable, type OperatorFunction, skipWhile, switchMap, takeWhile } from 'rxjs';

/**
 * RxJS operator that maps each emission to a new {@link Expires} object with an expiration
 * time relative to the current moment.
 *
 * @param expiresIn - duration in milliseconds until expiration
 * @returns an `OperatorFunction` that maps each emission to an {@link Expires} object
 */
export function toExpiration<T>(expiresIn: number): OperatorFunction<T, Expires> {
  return map(() => {
    const now = new Date();
    const expirationDate = expirationDetails({ expiresFromDate: now, expiresIn }).getExpirationDate();
    return { expiresAt: expirationDate };
  });
}

/**
 * RxJS operator that filters out emissions whose {@link Expires} value has already expired.
 *
 * @returns operator that only passes through non-expired emissions
 */
export function skipExpired<T extends Expires>(): MonoTypeOperatorFunction<T> {
  return filter((expires) => !expirationDetails({ expires }).hasExpired());
}

/**
 * RxJS operator that skips emissions until the elapsed time since the emitted date/timestamp has exceeded `expiresIn`.
 *
 * @param expiresIn - duration in milliseconds
 * @returns operator that skips emissions until the time window has elapsed
 */
export function skipUntilExpiration(expiresIn?: number): MonoTypeOperatorFunction<DateOrUnixDateTimeMillisecondsNumber> {
  return filter((x) => expirationDetails({ expiresFromDate: x, expiresIn }).hasExpired());
}

/**
 * RxJS operator that skips emissions after the elapsed time since the emitted date/timestamp has exceeded `expiresIn`.
 *
 * @param expiresIn - duration in milliseconds
 * @returns operator that passes through emissions only within the time window
 */
export function skipAfterExpiration(expiresIn?: number): MonoTypeOperatorFunction<DateOrUnixDateTimeMillisecondsNumber> {
  return filter((x) => !expirationDetails({ expiresFromDate: x, expiresIn }).hasExpired());
}

/**
 * RxJS operator that only takes emissions from the source within a time window after each emission from a watch observable.
 *
 * @param watch - observable whose emissions reset the time window
 * @param takeFor - duration in milliseconds of each time window
 * @returns operator that limits source emissions to the active time window after each watch emission
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
 * RxJS operator that skips emissions from the source for a duration after each emission from a watch observable,
 * then passes values through once the time has elapsed.
 *
 * @param watch - observable whose emissions reset the skip window
 * @param skipFor - duration in milliseconds to skip after each watch emission
 * @returns an operator that delays passing values through until time has elapsed since the last watch emission
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
