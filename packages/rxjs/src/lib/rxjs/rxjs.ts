import { Maybe } from '@dereekb/util';
import { combineLatest, Observable, of, isObservable, MonoTypeOperatorFunction, skipWhile, startWith } from 'rxjs';

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
