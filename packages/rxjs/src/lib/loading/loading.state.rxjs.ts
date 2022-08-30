import { Maybe } from '@dereekb/util';
import { MonoTypeOperatorFunction, OperatorFunction, startWith, Observable, filter, map, tap } from 'rxjs';
import { LoadingState, PageLoadingState, beginLoading, loadingStateHasFinishedLoading, isSuccessLoadingState } from './loading.state';

/**
 * Merges startWith() with beginLoading().
 *
 * Preferred over using both individually, as typing information can get lost.
 *
 * @returns
 */
export function startWithBeginLoading<L extends LoadingState<T>, T = unknown>(): MonoTypeOperatorFunction<L>;
export function startWithBeginLoading<L extends LoadingState<T>, T = unknown>(state?: Partial<LoadingState<T>>): MonoTypeOperatorFunction<L>;
export function startWithBeginLoading<L extends PageLoadingState<T>, T = unknown>(state?: Partial<PageLoadingState<T>>): MonoTypeOperatorFunction<L>;
export function startWithBeginLoading<L extends LoadingState<T>, T = unknown>(state?: Partial<L>): MonoTypeOperatorFunction<L> {
  return startWith<L>(beginLoading(state) as unknown as L);
}

/**
 * Returns the value once the LoadingState has finished loading.
 */
export function valueFromLoadingState<L extends LoadingState<T>, T = unknown>(): OperatorFunction<L, Maybe<T>> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      filter((x) => loadingStateHasFinishedLoading(x)),
      map((x) => x.value)
    );
  };
}

/**
 * Executes a function when the input state has a successful value.
 *
 * @param fn
 */
export function tapOnLoadingStateSuccess<L extends LoadingState<T>, T = unknown>(fn: (state: L) => void): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateSuccess<L extends LoadingState<T>, T = unknown>(fn: (state: L) => void): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateSuccess<L extends PageLoadingState<T>, T = unknown>(fn: (state: L) => void): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateSuccess<L extends LoadingState<T>, T = unknown>(fn: (state: L) => void): MonoTypeOperatorFunction<L> {
  return tap((state: L) => {
    if (isSuccessLoadingState(state)) {
      fn(state);
    }
  });
}
