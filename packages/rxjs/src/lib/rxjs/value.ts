import { filter, skipWhile, startWith, switchMap, timeout, MonoTypeOperatorFunction, Observable, of, OperatorFunction, map } from 'rxjs';
import { ObjectOrGetter, getValueFromObjectOrGetter, Maybe } from '@dereekb/util';

// MARK: Types
export type IsCheckFunction<T = any> = (value: T) => Observable<boolean>;

/**
 * Function that validates the input value and returns an observable.
 */
export type IsValidFunction<T = any> = IsCheckFunction<T>;

/**
 * Function that checks modification status of the input value and returns a value.
 */
export type IsModifiedFunction<T = any> = IsCheckFunction<T>;

// MARK: IsCheck
export function makeReturnIfIsFunction<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, defaultValueOnMaybe?: boolean): (value: Maybe<T>) => Observable<Maybe<T>> {
  return (value) => returnIfIs(isCheckFunction, value, defaultValueOnMaybe);
}

export function returnIfIs<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, value: Maybe<T>, defaultValueOnMaybe?: boolean): Observable<Maybe<T>> {
  return checkIs<T>(isCheckFunction, value, defaultValueOnMaybe).pipe(map(x => (x) ? value : undefined));
}

export function makeCheckIsFunction<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, defaultValueOnMaybe?: boolean): (value: Maybe<T>) => Observable<boolean> {
  return (value) => checkIs(isCheckFunction, value, defaultValueOnMaybe);
}

export function checkIs<T>(isCheckFunction: Maybe<IsModifiedFunction<T>>, value: Maybe<T>, defaultValueOnMaybe = false): Observable<boolean> {
  const is: Observable<boolean> = (isCheckFunction) ?
    ((value != null) ? isCheckFunction(value) : of(defaultValueOnMaybe)) :
    of(true);
  return is;
}

// MARK: Filter
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

/**
 * Used to pass a default value incase an observable has not yet started emititng values.
 */
export function timeoutStartWith<T>(defaultValue: ObjectOrGetter<T>): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) => {
    return source.pipe(
      timeout({ first: 0, with: () => source.pipe(startWith(getValueFromObjectOrGetter(defaultValue))) })
    );
  };
}
