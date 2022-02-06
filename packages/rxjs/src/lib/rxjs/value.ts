import { MonoTypeOperatorFunction } from 'rxjs';
import { Maybe } from '@dereekb/util';
import { Observable, of, OperatorFunction } from 'rxjs';
import { filter, skipWhile, switchMap } from 'rxjs/operators';

/**
 * Observable filter that filters maybe value that are defined.
 */
export function filterMaybe<T>(): OperatorFunction<Maybe<T>, T> {
  return filter(x => x != null) as OperatorFunction<Maybe<T>, T>;
}

/**
 * Skips all initial maybe values, and then returns all values after the first non-null/undefined value is returned.
 */
export function skipFirstMaybe<T>(): MonoTypeOperatorFunction<Maybe<T>> {
  return skipWhile((x: Maybe<T>) => (x == null));
}

/**
 * Provides a switchMap that will emit the observable if the observable is defined, otherwise will return the default value.
 * 
 * @param defaultValue 
 * @returns 
 */
export function switchMapMaybeDefault<T = any>(defaultValue: Maybe<T> = undefined): OperatorFunction<Maybe<Observable<Maybe<T>>>, Maybe<T>> {
  return switchMap((x: Maybe<Observable<Maybe<T>>>) => {
    if (x != null) {
      return x;
    } else {
      return of(defaultValue);
    }
  })
}

/**
 * Combines both filterMaybe and switchMap to build a subscriber that emits only concrete values.
 * 
 * @returns 
 */
export function switchMapMaybeObs<T = any>(): OperatorFunction<Maybe<Observable<Maybe<T>>>, T> {
  return (source: Observable<Maybe<Observable<Maybe<T>>>>) => {
    const subscriber: Observable<T> = source.pipe(
      filterMaybe(),
      switchMap(x => x)
    ) as Observable<T>;

    return subscriber;
  };
}
