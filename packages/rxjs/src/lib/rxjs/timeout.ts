import { of, timeout, tap, MonoTypeOperatorFunction, throwError, map, Observable, startWith } from 'rxjs';
import { Getter, GetterOrValue, getValueFromGetter } from '@dereekb/util';
import { filterMaybe } from './value';

/**
 * Used to pass a default value incase an observable has not yet started emititng values.
 */
export function timeoutStartWith<T>(defaultValue: GetterOrValue<T>, first = 0): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) => {
    return source.pipe(timeout({ first, with: () => source.pipe(startWith(getValueFromGetter(defaultValue))) }));
  };
}

export function tapAfterTimeout<T>(timeoutDelay: number, useFn: () => void): MonoTypeOperatorFunction<T> {
  return timeout({
    first: timeoutDelay,
    with: () => of(null as unknown as T).pipe(tap(useFn), filterMaybe())
  }) as MonoTypeOperatorFunction<T>;
}

export function throwErrorAfterTimeout<T>(timeoutDelay: number, error: Getter<unknown>): MonoTypeOperatorFunction<T> {
  return timeout({
    first: timeoutDelay,
    with: () =>
      of(null as unknown as T).pipe(
        map(() => throwError(error)),
        filterMaybe()
      )
  }) as MonoTypeOperatorFunction<T>;
}
