import { GetterOrValue, Maybe, getValueFromGetter } from '@dereekb/util';
import { Observable, OperatorFunction, switchMap, of, isObservable } from 'rxjs';

/**
 * A value that is either the value or an observable that returns the value.
 */
export type ObservableOrValue<T> = T | Observable<T>;

/**
 * Wraps the input value as an observable, if it is not an observable.
 */
export function asObservable<T>(valueOrObs: ObservableOrValue<T>): Observable<T>;
export function asObservable<T>(valueOrObs: Maybe<ObservableOrValue<T>>): Observable<Maybe<T>>;
export function asObservable<T>(valueOrObs: Maybe<ObservableOrValue<T>>): Observable<Maybe<T>> {
  if (isObservable(valueOrObs)) {
    return valueOrObs;
  } else {
    return of(valueOrObs);
  }
}

/**
 * Switch map for an ObservableGetter that pipes through the value.
 *
 * @returns
 */
export function valueFromObservableOrValue<T>(): OperatorFunction<ObservableOrValue<T>, T> {
  return switchMap((x) => asObservable(x));
}

/**
 * A GetterOrValue of a ObservableOrValue.
 */
export type ObservableOrValueGetter<T> = GetterOrValue<ObservableOrValue<T>>;
export type MaybeObservableOrValueGetter<T> = Maybe<ObservableOrValueGetter<Maybe<T>>>;

export function asObservableFromGetter<T>(input: ObservableOrValueGetter<T>): Observable<T> {
  const obs = getValueFromGetter(input);
  return asObservable(obs);
}

/**
 * Switch map for an ObservableOrValueGetter that pipes through the value.
 *
 * @returns
 */
export function valueFromObservableOrValueGetter<T>(): OperatorFunction<ObservableOrValueGetter<T>, T> {
  return switchMap((x) => asObservableFromGetter(x));
}

export function maybeValueFromObservableOrValueGetter<T>(): OperatorFunction<MaybeObservableOrValueGetter<T>, Maybe<T>> {
  return switchMap((x) => (x != null ? asObservableFromGetter(x) : of(undefined)));
}
