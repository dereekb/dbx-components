import { Maybe } from '@dereekb/util';
import { combineLatest, Observable, of, MonoTypeOperatorFunction, skipWhile, startWith, BehaviorSubject, shareReplay, map, finalize } from 'rxjs';

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
    return (i === 0 && !skipFirst);
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
