import { Observable, OperatorFunction, switchMap, of, isObservable } from 'rxjs';

/**
 * A value that is either the value or an observable that returns the value.
 */
export type ObservableGetter<T> = T | Observable<T>;

/**
 * Switch map for an ObservableGetter that pipes through the value.
 * 
 * @returns 
 */
export function getter<T>(): OperatorFunction<ObservableGetter<T>, T> {
  return switchMap(x => {
    if (isObservable(x)) {
      return x;
    } else {
      return of(x);
    }
  });
}
