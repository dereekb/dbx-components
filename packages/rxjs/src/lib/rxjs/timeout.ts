import { of, timeout, tap, type MonoTypeOperatorFunction, throwError, map, type Observable, startWith } from 'rxjs';
import { type Getter, type GetterOrValue, getValueFromGetter } from '@dereekb/util';
import { filterMaybe } from './value';

/**
 * RxJS operator that emits a default value if the source does not emit within the specified timeout.
 *
 * After the timeout, the default value is prepended and the source continues normally.
 *
 * @param defaultValue - value or getter to use as the default
 * @param first - timeout in ms before emitting the default (defaults to 0)
 * @returns an operator that provides a fallback on slow emissions
 */
export function timeoutStartWith<T>(defaultValue: GetterOrValue<T>, first = 0): MonoTypeOperatorFunction<T> {
  return (source: Observable<T>) => {
    return source.pipe(timeout({ first, with: () => source.pipe(startWith(getValueFromGetter(defaultValue))) }));
  };
}

/**
 * RxJS operator that executes a side-effect function if the source does not emit within the given timeout.
 *
 * @param timeoutDelay - timeout in ms before triggering the side-effect
 * @param useFn - side-effect function to call on timeout
 * @returns an operator that taps after timeout
 */
export function tapAfterTimeout<T>(timeoutDelay: number, useFn: () => void): MonoTypeOperatorFunction<T> {
  return timeout({
    first: timeoutDelay,
    with: () => of(null as unknown as T).pipe(tap(useFn), filterMaybe())
  }) as MonoTypeOperatorFunction<T>;
}

/**
 * RxJS operator that throws an error if the source does not emit within the given timeout.
 *
 * @param timeoutDelay - timeout in ms before throwing
 * @param error - getter that produces the error to throw
 * @returns an operator that throws on timeout
 */
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
