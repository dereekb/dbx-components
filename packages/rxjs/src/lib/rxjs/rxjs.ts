import { Getter, Maybe } from '@dereekb/util';
import { combineLatest, Observable, MonoTypeOperatorFunction, skipWhile, startWith, BehaviorSubject, shareReplay, map, finalize, of, mergeMap, from } from 'rxjs';

/**
 * Merges both startWith and tapFirst to initialize a pipe.
 *
 * @param initial
 * @param tap
 * @param skipFirst
 * @returns
 */
export function initialize<T>(tap: (value: Maybe<T>) => void, initial?: Maybe<T>, skipFirst?: boolean): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) => {
    const subscriber: Observable<T> = source.pipe(
      startWith(initial),
      tapFirst((x: Maybe<T>) => tap(x), initial == null || skipFirst)
    ) as Observable<T>;

    return subscriber;
  };
}

/**
 * Taps once on the first element.
 *
 * @param tap
 * @param skipFirst
 * @returns
 */
export function tapFirst<T>(tap: (value: T) => void, skipFirst = false): MonoTypeOperatorFunction<T> {
  return skipWhile((value, i = 0) => {
    tap(value);
    return i === 0 && !skipFirst;
  });
}

/**
 * Prevents an observable from emitting complete until it is unsubscribed from.
 *
 * The subscription will never have complete() called as complete only gets called after it unsubscribes,
 * so use finalize() if additional cleanup is required.
 *
 * @param obs
 * @returns
 */
export function preventComplete<T>(obs: Observable<T>): Observable<T> {
  const complete = new BehaviorSubject<number>(0);

  return combineLatest([obs, complete]).pipe(
    map(([x]) => x),
    shareReplay(1),
    finalize(() => {
      complete.complete();
    })
  );
}

/**
 * Similar to from, but uses a Getter to keeps the Observable cold until it is subscribed to, then calls the promise or observable.
 *
 * The result value of the promise or the latest value of the observable is shared.
 *
 * @param getter
 * @returns
 */
export function lazyFrom<T>(getter: Getter<Promise<T> | Observable<T>>): Observable<T> {
  return of(undefined).pipe(
    mergeMap(() => from(getter())),
    shareReplay(1)
  );
}
