import { type Getter, type Maybe } from '@dereekb/util';
import { combineLatest, type Observable, type MonoTypeOperatorFunction, skipWhile, startWith, BehaviorSubject, shareReplay, map, finalize, of, mergeMap, from } from 'rxjs';

/**
 * Combines `startWith` and {@link tapFirst} to initialize an observable pipe with a side-effect on the first emission.
 *
 * Emits the `initial` value first, then taps on the first emitted value to run the provided callback.
 *
 * @param tap - side-effect function called with the first value
 * @param initial - optional starting value emitted before the source
 * @param skipFirst - if true, skips tapping the initial value
 * @returns an operator that initializes the pipe with a tap
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
 * Executes a side-effect on the first emission from the observable, then passes all values through.
 *
 * @param tap - the side-effect function to call once
 * @param skipFirst - if true, skips the very first emission before tapping
 * @returns an operator that taps the first value
 */
export function tapFirst<T>(tap: (value: T) => void, skipFirst = false): MonoTypeOperatorFunction<T> {
  return skipWhile((value, i = 0) => {
    tap(value);
    return i === 0 && !skipFirst;
  });
}

/**
 * Wraps an observable so that it never emits `complete` until it is unsubscribed.
 *
 * The subscription will never have `complete()` called since it only triggers after unsubscription.
 * Use `finalize()` for additional cleanup.
 *
 * @param obs - the source observable to wrap
 * @returns an observable that only completes on unsubscription
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
 * Creates a cold observable that defers execution of the getter until subscription, then shares the result.
 *
 * Unlike `from()`, the promise/observable is not created until the first subscriber connects.
 *
 * @example
 * ```ts
 * const data$ = lazyFrom(() => fetch('/api/data').then(r => r.json()));
 * // The fetch is not called until data$ is subscribed to
 * ```
 *
 * @param getter - factory that returns a Promise or Observable
 * @returns a shared observable that defers execution until subscription
 */
export function lazyFrom<T>(getter: Getter<Promise<T> | Observable<T>>): Observable<T> {
  return of(undefined).pipe(
    mergeMap(() => from(getter())),
    shareReplay(1)
  );
}
