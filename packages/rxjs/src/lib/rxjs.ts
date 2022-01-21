import { MonoTypeOperatorFunction } from 'rxjs';
import { Maybe } from '@dereekb/util';
import { combineLatest, identity, Observable, of, OperatorFunction, isObservable } from 'rxjs';
import { map, scan, startWith, shareReplay, distinctUntilChanged, filter, skipWhile, switchMap } from 'rxjs/operators';

/**
 * Returns the pipe if usePipe is true, otherwise returns the identity.
 */
export function pipeIf<A>(usePipe: boolean, pipe: OperatorFunction<A, A>): OperatorFunction<A, A> {
  return (usePipe) ? pipe : identity;
}

export function combineLatestFromMapValuesObsFn<T, O>(mapToObs: (value: T) => Observable<O>): (map: Map<any, T>) => Observable<O[]> {
  const combineArrayFn = combineLatestFromArrayObsFn(mapToObs);
  return (latestMap: Map<any, T>) => {
    const mapValues = Array.from(latestMap).map(y => y[1]);
    return combineArrayFn(mapValues);
  };
}

export function combineLatestFromArrayObsFn<T, O>(mapToObs: (value: T) => Observable<O>): (values: T[]) => Observable<O[]> {
  return (latest) => {
    const newObs = latest.map(mapToObs);
    return (newObs.length) ? combineLatest(newObs) : of([]);
  };
}

/**
 * Similar to count(), but counts emissions as they occur using scan.
 */
export function scanCount(): OperatorFunction<any, number> {
  return scan((count, _) => count + 1, 0);
}

/**
 * Observable that returns true initially, then returns false as soon as a value is recieved.
 */
export function isLoadingFromObservable(obs: Observable<any>): Observable<boolean> {
  return obs.pipe(map(_ => false), startWith(true), distinctUntilChanged(), shareReplay(1));
}

/**
 * Wraps the input value as an observable, if it is not an observable.
 */
export function asObservable<T>(valueOrObs: T | Observable<T>): Observable<T> {
  if (isObservable(valueOrObs)) {
    return valueOrObs;
  } else {
    return of(valueOrObs);
  }
}

/**
 * Observable filter that filters maybe value that are defined.
 */
export function filterMaybe<T>(): OperatorFunction<Maybe<T>, T> {
  return filter(x => Boolean(x)) as OperatorFunction<Maybe<T>, T>;
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
export function switchMapMaybeObs<T = any>(defaultValue?: Maybe<T>): OperatorFunction<Maybe<Observable<Maybe<T>>>, Maybe<T>> {
  return switchMap((x: Maybe<Observable<Maybe<T>>>) => {
    if (x != null) {
      return x;
    } else {
      return of(defaultValue);
    }
  })
}