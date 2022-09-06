import { Maybe } from '@dereekb/util';
import { MonoTypeOperatorFunction, OperatorFunction, startWith, Observable, filter, map, tap, catchError, combineLatest, distinctUntilChanged, first, of, shareReplay } from 'rxjs';
import { timeoutStartWith } from '../rxjs';
import { LoadingState, PageLoadingState, beginLoading, loadingStateHasFinishedLoading, isSuccessLoadingState, mergeLoadingStates } from './loading.state';

/**
 * Wraps an observable output and maps the value to a LoadingState.
 *
 * If firstOnly is provided, it will only take the first value the observable returns.
 */
export function loadingStateFromObs<T>(obs: Observable<T>, firstOnly?: boolean): Observable<LoadingState<T>> {
  if (firstOnly) {
    obs = obs.pipe(first());
  }

  return obs.pipe(
    map((value) => ({ loading: false, value, error: undefined })),
    catchError((error) => of({ loading: false, error })),
    timeoutStartWith({ loading: true }, 50),
    shareReplay(1)
  );
}

/**
 * Convenience function for creating a pipe that merges the two input observables.
 */
export function combineLoadingStates<A, B>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>): Observable<LoadingState<A & B>>;
export function combineLoadingStates<A extends object, B extends object, C>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, mergeFn?: (a: A, b: B) => C): Observable<LoadingState<C>>;
export function combineLoadingStates<A extends object, B extends object, C>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, inputMergeFn?: (a: A, b: B) => C): Observable<LoadingState<C>> {
  return combineLatest([obsA, obsB]).pipe(
    distinctUntilChanged((x, y) => x?.[0] === y?.[0] && x?.[1] === y?.[1]), // Prevent remerging the same values!
    map(([a, b]) => mergeLoadingStates(a, b, inputMergeFn as (a: A, b: B) => C)),
    shareReplay(1) // Share the result.
  );
}

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
