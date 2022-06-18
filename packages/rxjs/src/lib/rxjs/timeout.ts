import { filterMaybe } from '@dereekb/rxjs';
import { of, timeout, tap, MonoTypeOperatorFunction, throwError } from 'rxjs';
import { Getter } from '@dereekb/util';

export function tapAfterTimeout<T>(timeoutDelay: number, useFn: () => void): MonoTypeOperatorFunction<T> {
  return timeout({
    first: timeoutDelay,
    with: () => of(null as unknown as T).pipe(tap(useFn), filterMaybe())
  }) as MonoTypeOperatorFunction<T>;
}

export function throwErrorAfterTimeout<T>(timeoutDelay: number, error: Getter<unknown>): MonoTypeOperatorFunction<T> {
  return timeout({
    first: timeoutDelay,
    with: () => of(null as unknown as T).pipe(throwError(() => error()) as any, filterMaybe())
  }) as MonoTypeOperatorFunction<T>;
}
