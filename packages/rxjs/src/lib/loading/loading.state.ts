import { map, shareReplay, catchError, first, distinctUntilChanged, combineLatest, Observable, of } from 'rxjs';
import { Maybe, ReadableError, reduceBooleansWithAnd, reduceBooleansWithOr, ReadableDataError, Page, FilteredPage, PageNumber, objectHasKey, MapFunction, ErrorInput, toReadableError } from '@dereekb/util';
import { timeoutStartWith } from '../rxjs/timeout';

/**
 * A value/error pair used in loading situations.
 */
export interface LoadingErrorPair {
  /**
   * Field used to denote whether or not the value is being loaded.
   *
   * Not being specified is considered not being loaded.
   */
  loading?: Maybe<boolean>;
  /**
   * A Readable server error.
   */
  error?: Maybe<ReadableError>;
}

/**
 * A value/error pair used in loading situations.
 */
export interface LoadingState<T = unknown> extends LoadingErrorPair {
  value?: Maybe<T>;
}

/**
 * Loading state with a value key.
 */
export type LoadingStateWithValue<T = unknown> = LoadingState<T> & {
  value: Maybe<T>;
};

/**
 * Loading state with a value key and a non-maybe value.
 */
export type LoadingStateWithMaybeSoValue<T = unknown> = LoadingState<T> & {
  value: T;
};

/**
 * Convenience identifier for a LoadingState that returns a list.
 */
export type ListLoadingState<T> = LoadingState<T[]>;

/**
 * LoadingState with a Page.
 */
export interface PageLoadingState<T> extends LoadingState<T>, Page {}

/**
 * PageLoadingState with a filter.
 */
export interface FilteredPageLoadingState<T, F> extends PageLoadingState<T>, FilteredPage<F> {}

/**
 * LoadingPageState that has an array of the value
 */
export type PageListLoadingState<T> = PageLoadingState<T[]>;

/**
 * PageListLoadingState with a Filter.
 */
export type FilteredPageListLoadingState<T, F> = FilteredPageLoadingState<T[], F>;

// MARK: Utility
/**
 * Describes a LoadingState's current state type.
 */
export enum LoadingStateType {
  /**
   * The loadingState is not loading, and has no value key.
   */
  IDLE = 'idle',
  /**
   * The loading state is loading.
   */
  LOADING = 'loading',
  /**
   * The loading state is success.
   */
  SUCCESS = 'success',
  /**
   * The loading state has an error.
   */
  ERROR = 'error'
}

/**
 * Returns the LoadingStateType for the input LoadingState
 *
 * @param loadingState
 * @returns
 */
export function loadingStateType(loadingState: LoadingState): LoadingStateType {
  if (loadingState.loading) {
    return LoadingStateType.LOADING;
  } else if (objectHasKey(loadingState, 'value')) {
    return LoadingStateType.SUCCESS;
  } else if (objectHasKey(loadingState, 'error')) {
    return LoadingStateType.ERROR;
  } else {
    return LoadingStateType.IDLE;
  }
}

/**
 * Returns a LoadingState that has no result and is not loading.
 */
export function idleLoadingState<T>(): LoadingState<T> {
  return { loading: false };
}

export function beginLoading<T = unknown>(): LoadingState<T>;
export function beginLoading<T = unknown>(state?: Partial<PageLoadingState<T>>): PageLoadingState<T>;
export function beginLoading<T = unknown>(state?: Partial<LoadingState<T>>): LoadingState<T> {
  return state ? { ...state, loading: true } : { loading: true };
}

export function successResult<T>(value: T): LoadingStateWithValue<T> {
  return { value, loading: false };
}

export function successPageResult<T>(page: PageNumber, value: T): PageLoadingState<T> {
  return { ...successResult(value), page };
}

export function errorResult<T = unknown>(error?: Maybe<ErrorInput>): LoadingState<T> {
  return { error: toReadableError(error), loading: false };
}

export function errorPageResult<T>(page: PageNumber, error?: Maybe<ReadableError | ReadableDataError>): PageLoadingState<T> {
  return { ...errorResult(error), page };
}

export function unknownLoadingStatesIsLoading(states: LoadingState[]): boolean {
  return reduceBooleansWithOr(states.map(loadingStateIsLoading), false);
}

export function allLoadingStatesHaveFinishedLoading(states: LoadingState[]): boolean {
  return reduceBooleansWithAnd(states.map(loadingStateHasFinishedLoading), true);
}

export function loadingStateIsIdle(state: Maybe<LoadingState>): boolean {
  if (state) {
    return loadingStateType(state) === LoadingStateType.IDLE;
  } else {
    return true;
  }
}

export function loadingStateIsLoading(state: Maybe<LoadingState>): boolean {
  if (state) {
    const loading = state.loading;

    if (loading === true) {
      return true;
    } else {
      return loading ?? !(state.value || state.error);
    }
  } else {
    return false;
  }
}

export function isSuccessLoadingState(state: Maybe<LoadingState>): boolean {
  if (state) {
    return loadingStateType(state) === LoadingStateType.SUCCESS;
  } else {
    return false;
  }
}

export function isErrorLoadingState(state: Maybe<LoadingState>): boolean {
  if (state) {
    return loadingStateType(state) === LoadingStateType.ERROR;
  } else {
    return false;
  }
}

export function loadingStateHasFinishedLoading(state: Maybe<LoadingState>): boolean {
  if (state) {
    const loading = state.loading;

    if (loading === true) {
      return false;
    } else {
      return loading === false || Boolean(state.value || state.error);
    }
  } else {
    return false;
  }
}

/**
 * Whether or not the input loading state has a non-null value.
 *
 * @param state
 * @returns
 */
export function loadingStateHasValue(state: Maybe<LoadingState>): boolean {
  if (state) {
    return loadingStateHasFinishedLoading(state) && state.value != null;
  } else {
    return false;
  }
}

/**
 * Whether or not the input loading state has an error defined.
 *
 * @param state
 * @returns
 */
export function loadingStateHasError(state: Maybe<LoadingState>): boolean {
  if (state) {
    return loadingStateHasFinishedLoading(state) && state.error != null;
  } else {
    return false;
  }
}

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
 * Merges the input loading states.
 *
 * If one is unavailable, it is considered loading.
 * If one is loading, will return the loading state.
 * If one has an error and is not loading, will return the error with loading false.
 */
export function mergeLoadingStates<A, B>(a: LoadingState<A>, b: LoadingState<B>): LoadingState<A & B>;
export function mergeLoadingStates<A extends object, B extends object, C>(a: LoadingState<A>, b: LoadingState<B>, mergeFn: (a: A, b: B) => C): LoadingState<C>;
export function mergeLoadingStates<A extends object, B extends object, C>(a: LoadingState<A>, b: LoadingState<B>, inputMergeFn?: (a: A, b: B) => C): LoadingState<C> {
  const mergeFn = inputMergeFn ?? ((a: A, b: B) => ({ ...a, ...b }));
  const error = a?.error ?? b?.error;
  let result: LoadingState<C>;

  if (error) {
    result = {
      // Evaluate both for the loading state.
      loading: a?.error ? a.loading : false || b?.error ? b.loading : false,
      error
    };
  } else {
    const loading = !a || !b || (a?.loading ?? b?.loading);
    if (loading) {
      result = {
        loading: true
      };
    } else {
      result = {
        loading: false,
        value: mergeFn(a.value as A, b.value as B) as C
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
    value: undefined,
    loading,
    error: undefined
  };
}

/**
 * Updates the input state with the input error.
 */
export function updatedStateForSetValue<T, S extends LoadingState<T> = LoadingState<T>>(state: S, value: T | undefined): S {
  return {
    ...state,
    value: value ?? undefined,
    loading: false,
    error: undefined
  };
}

/**
 * Updates the input state with the input error.
 */
export function updatedStateForSetError<T, S extends LoadingState<T> = LoadingState<T>>(state: S, error?: ReadableDataError): S {
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

export function mapMultipleLoadingStateResults<T, X, L extends LoadingState<X>[], R extends LoadingState<T>>(input: L, config: MapMultipleLoadingStateResultsConfiguration<T, X, L, R>): Maybe<R> {
  const { mapValues, mapState } = config;
  const loading = unknownLoadingStatesIsLoading(input);
  const error = input.map((x) => x?.error).filter((x) => Boolean(x))[0];
  let result: Maybe<R>;

  if (!error && !loading) {
    if (mapValues) {
      const value: T = mapValues(input.map((x) => x.value) as X[]);
      result = {
        loading,
        value,
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

export type MapLoadingStateFn<A, B, L extends LoadingState<A> = LoadingState<A>, O extends LoadingState<B> = LoadingState<B>> = (input: L, value?: B) => O;
export type MapLoadingStateValuesFn<A, B, L extends LoadingState<A> = LoadingState<A>> = (input: A, state: L) => B;

export interface MapLoadingStateResultsConfiguration<A, B, L extends LoadingState<A> = LoadingState<A>, O extends LoadingState<B> = LoadingState<B>> {
  mapValue?: MapLoadingStateValuesFn<A, B, L>;
  mapState?: MapLoadingStateFn<A, B, L, O>;
}

export function mapLoadingStateResults<A, B, L extends LoadingState<A> = LoadingState<A>, O extends LoadingState<B> = LoadingState<B>>(input: L, config: MapLoadingStateResultsConfiguration<A, B, L, O>): O;
export function mapLoadingStateResults<A, B, L extends PageLoadingState<A> = PageLoadingState<A>, O extends PageLoadingState<B> = PageLoadingState<B>>(input: L, config: MapLoadingStateResultsConfiguration<A, B, L, O>): O;
export function mapLoadingStateResults<A, B, L extends Partial<PageLoadingState<A>> = Partial<PageLoadingState<A>>, O extends Partial<PageLoadingState<B>> = Partial<PageLoadingState<B>>>(input: L, config: MapLoadingStateResultsConfiguration<A, B, L, O>): O;
export function mapLoadingStateResults<A, B, L extends Partial<PageLoadingState<A>> = Partial<PageLoadingState<A>>, O extends Partial<PageLoadingState<B>> = Partial<PageLoadingState<B>>>(input: L, config: MapLoadingStateResultsConfiguration<A, B, L, O>): O {
  const { mapValue, mapState } = config;
  const inputValue = input?.value;
  let value: B;

  if (inputValue != null && mapValue) {
    value = mapValue(inputValue, input);
  } else {
    value = inputValue as unknown as B;
  }

  let result: O;

  if (!mapState) {
    result = {
      ...input,
      value
    } as unknown as O;
  } else {
    result = mapState(input, value);
  }

  return result;
}

export type MapLoadingStateValueFunction<O, I, L extends LoadingState<I> = LoadingState<I>> = MapFunction<L, Maybe<O>>;
export type MapLoadingStateValueMapFunction<O, I, L extends LoadingState<I> = LoadingState<I>> = (item: I, state: L) => Maybe<O>;

export function mapLoadingStateValueFunction<O, I, L extends LoadingState<I> = LoadingState<I>>(mapFn: MapLoadingStateValueMapFunction<O, I, L>): MapLoadingStateValueFunction<O, I, L> {
  return (state: L) => {
    let result: Maybe<O>;

    if (state.value != null) {
      result = mapFn(state.value, state);
    }

    return result;
  };
}
