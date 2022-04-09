import { Maybe } from '@dereekb/util';
import { Observable, OperatorFunction, switchMap, of, isObservable } from 'rxjs';

/**
 * A value that is either the value or an observable that returns the value.
 */
export type ObservableGetter<T> = T | Observable<T>;

/**
 * Wraps the input value as an observable, if it is not an observable.
 */
export function asObservable<T>(valueOrObs: ObservableGetter<T>): Observable<T>;
export function asObservable<T>(valueOrObs: Maybe<ObservableGetter<T>>): Observable<Maybe<T>>;
export function asObservable<T>(valueOrObs: Maybe<ObservableGetter<T>>): Observable<Maybe<T>> {
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
export function getFromObservable<T>(): OperatorFunction<ObservableGetter<T>, T> {
  return switchMap(x => {
    if (isObservable(x)) {
      return x;
    } else {
      return of(x);
    }
  });
}
