import { combineLatest, Observable, of } from 'rxjs';
import { map, startWith, shareReplay, catchError, delay, first, distinctUntilChanged } from 'rxjs/operators';
import { Maybe, reduceBooleansWithAnd, reduceBooleansWithOr, ServerError } from '@dereekb/util';

/**
 * A model/error pair used in loading situations.
 */
export interface LoadingErrorPair {
  /**
   * Field used to denote whether or not the model is being loaded.
   *
   * Not being specified is considered not being loaded.
   */
  loading?: boolean;
  error?: ServerError;
}

/**
 * A model/error pair used in loading situations.
 */
export interface LoadingState<T = any> extends LoadingErrorPair {
  model?: Maybe<T>;
}

// MARK: Utility
export function beginLoading(): LoadingState<any>;
export function beginLoading<T>(): LoadingState<T>;
export function beginLoading<T>(pair?: LoadingState<T>): LoadingState<T> {
  return { ...pair, loading: true };
}

export function successResult<T>(model: T): LoadingState<T> {
  return { model };
}

export function errorResult(error?: ServerError): LoadingState<any> {
  return { error };
}

export function anyLoadingStatesIsLoading(states: LoadingState[]): boolean {
  return reduceBooleansWithOr(states.map(loadingStateIsLoading), false);
}

export function allLoadingStatesHaveFinishedLoading(states: LoadingState[]): boolean {
  return reduceBooleansWithAnd(states.map(loadingStateHasFinishedLoading), true);
}

export function loadingStateIsLoading(state?: LoadingState): boolean {
  return state?.loading ?? !Boolean(state?.model || state?.error);
}

export function loadingStateHasFinishedLoading(state: LoadingState): boolean {
  return !state?.loading && Boolean(state?.model || state?.error);
}

/**
 * Wraps an observable output and maps the value to a LoadingState.
 */
export function loadingStateFromObs<T>(obs: Observable<T>, firstOnly?: boolean): Observable<LoadingState<T>> {

  if (firstOnly) {
    obs = obs.pipe(first());
  }

  return obs.pipe(
    map((model) => ({ loading: false, model, error: undefined })),
    catchError((error) => of({ loading: false, error })),
    delay(50),
    startWith(({ loading: true })),
  );
}

export function combineLoadingStates<A, B>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>): Observable<LoadingState<A & B>>;
export function combineLoadingStates<A, B, C>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, mergeFn?: (a: A, b: B) => C): Observable<LoadingState<C>>;

/**
 * Convenience function for creating a pipe that merges the two input observables.
 */
export function combineLoadingStates(obsA: Observable<LoadingState<any>>, obsB: Observable<LoadingState<any>>, mergeFn?: any): Observable<LoadingState<any>> {
  return combineLatest([obsA, obsB])
    .pipe(
      distinctUntilChanged((x, y) => x?.[0] === y?.[0] && x?.[1] === y?.[1]), // Prevent remerging the same values!
      map(([a, b]) => mergeLoadingStates(a, b, mergeFn)),
      shareReplay(1)  // Share the result.
    );
}

export function mergeLoadingStates<A, B>(a: LoadingState<A>, b: LoadingState<B>): LoadingState<A & B>;
export function mergeLoadingStates<A, B, C>(a: LoadingState<A>, b: LoadingState<B>, mergeFn: (a: A, b: B) => C): LoadingState<C>;

/**
 * Merges the input loading states.
 *
 * If one is unavailable, it is considered loading.
 * If one is loading, will return the loading state.
 * If one has an error and is not loading, will return the error with loading false.
 */
export function mergeLoadingStates(a: LoadingState<any>, b: LoadingState<any>, mergeFn = (aa: object, bb: object) => ({ ...aa, ...bb } as any)): LoadingState<any> {
  const error = a?.error ?? b?.error;
  let result: LoadingState<any>;

  if (error) {
    result = {
      // Evaluate both for the loading state.
      loading: (a?.error) ? a.loading : false || (b?.error) ? b.loading : false,
      error
    };
  } else {
    const loading = (!a || !b) || (a?.loading ?? b?.loading);
    if (loading) {
      result = {
        loading: true
      };
    } else {
      result = {
        loading: false,
        model: mergeFn(a.model, b.model)
      };
    }
  }

  return result;
}

/**
 * Updates the input state to start loading.
 */
export function updatedStateForSetLoading<T, S extends LoadingState<T> = LoadingState<T>>(state: S, loading = true): S {
  return {
    ...state,
    model: undefined,
    loading,
    error: undefined
  };
}

/**
 * Updates the input state with the input error.
 */
export function updatedStateForSetModel<T, S extends LoadingState<T> = LoadingState<T>>(state: S, model: T | undefined): S {
  return {
    ...state,
    model: model ?? undefined,
    loading: false,
    error: undefined
  };
}

/**
 * Updates the input state with the input error.
 */
export function updatedStateForSetError<T, S extends LoadingState<T> = LoadingState<T>>(state: S, error?: ServerError): S {
  return {
    ...state,
    loading: false,
    error
  };
}

export type MapMultipleLoadingStateValuesFn<T, X> = (input: X[]) => T;

export interface MapMultipleLoadingStateResultsConfiguration<T, X, L extends LoadingState<X>[], R extends LoadingState<T>> {
  mapValues?: MapMultipleLoadingStateValuesFn<T, X>;
  mapState?: (input: L) => R;
}

export function mapMultipleLoadingStateResults<T, X, L extends LoadingState<X>[], R extends LoadingState<T>>(
  input: L, config: MapMultipleLoadingStateResultsConfiguration<T, X, L, R>
): Maybe<R> {
  const { mapValues, mapState } = config;
  const loading = anyLoadingStatesIsLoading(input);
  const error = input.map(x => x?.error).filter(x => Boolean(x))[0];
  let result: Maybe<R>;

  if (!error && !loading) {
    if (mapValues) {
      const model: T = mapValues(input.map(x => x.model) as X[]);
      result = {
        loading,
        model,
        error
      } as R;
    } else if (mapState) {
      result = mapState(input);
    } else {
      throw new Error('Incomplete mapMultipleLoadingStateResults configuration');
    }
  }

  return result;
}

export type MapLoadingStateFn<A, L extends LoadingState<A>, B, O extends LoadingState<B>> = (input: L) => O;
export type MapLoadingStateValuesFn<A, B> = (input: A) => B;

export interface MapLoadingStateResultsConfiguration<A, L extends LoadingState<A>, B, O extends LoadingState<B>> {
  mapValue?: MapLoadingStateValuesFn<A, B>;
  mapState?: MapLoadingStateFn<A, L, B, O>;
}

export function mapLoadingStateResults<L extends LoadingState<A>, A, B, O extends LoadingState<B>>(
  input: L, config: MapLoadingStateResultsConfiguration<A, L, B, O>
): O {
  const { mapValue, mapState } = config;
  let model: B = input?.model as any;

  if (model && mapValue) {
    model = mapValue(model as any);
  }

  let result: O;

  if (!mapState) {
    result = {
      ...input,
      model
    } as any;
  } else {
    result = mapState(input);
  }

  return result;
}
