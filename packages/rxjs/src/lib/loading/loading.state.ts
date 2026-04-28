import { type Maybe, type ReadableError, reduceBooleansWithAnd, reduceBooleansWithOr, type ReadableDataError, type Page, type FilteredPage, type PageNumber, objectHasKey, type MapFunction, type ErrorInput, toReadableError, mergeObjects, filterMaybeArrayValues, valuesAreBothNullishOrEquivalent } from '@dereekb/util';
import { type LoadingProgress } from './loading';

/**
 * A value/error pair used in loading situations.
 */
export interface LoadingErrorPair {
  /**
   * Field used to denote whether or not the value is being loaded.
   *
   * Not being specified is considered not being loaded.
   */
  readonly loading?: Maybe<boolean>;
  /**
   * Optional loading progress value.
   */
  readonly loadingProgress?: Maybe<LoadingProgress>;
  /**
   * A Readable server error.
   */
  readonly error?: Maybe<ReadableError>;
}

/**
 * Compares two {@link LoadingState} instances for shallow equality across all key properties.
 *
 * @example
 * ```ts
 * const a = successResult('hello');
 * const b = successResult('hello');
 * isLoadingStateEqual(a, b); // true (same value reference is not required, but same primitive is)
 *
 * const c = beginLoading();
 * isLoadingStateEqual(a, c); // false
 * ```
 *
 * @param a - first loading state
 * @param b - second loading state
 * @returns true if loading, loadingProgress, error, and value are all strictly equal
 */
export function isLoadingStateEqual<T extends LoadingState>(a: T, b: T): boolean {
  return a.loading === b.loading && a.loadingProgress === b.loadingProgress && a.error === b.error && a.value === b.value;
}

/**
 * Compares the metadata (loading flag, loading progress, and error) of two {@link LoadingErrorPair} instances,
 * using loose equality for loading and nullish-aware comparison for progress and error.
 *
 * Does not compare the `value` property — only structural metadata.
 *
 * @param a - first loading error pair
 * @param b - second loading error pair
 * @returns true if both pairs have equivalent metadata
 */
export function isLoadingStateMetadataEqual(a: Partial<LoadingErrorPair>, b: Partial<LoadingErrorPair>): boolean {
  return a.loading == b.loading && valuesAreBothNullishOrEquivalent(a.loadingProgress, b.loadingProgress) && valuesAreBothNullishOrEquivalent(a.error, b.error);
}

/**
 * A value/error pair used in loading situations.
 */
export interface LoadingState<T = unknown> extends LoadingErrorPair {
  readonly value?: Maybe<T>;
}

/**
 * Returns the value type inferred from the LoadingState type.
 */
export type LoadingStateValue<L extends LoadingState> = L extends LoadingState<infer T> ? T : never;

/**
 * Replaces the value type of the input LoadingState.
 */
export type LoadingStateWithValueType<L extends LoadingState, T> = L extends LoadingState ? Omit<L, 'value'> & LoadingState<T> : never;

/**
 * Loading state with a value key.
 */
export type LoadingStateWithValue<T = unknown> = LoadingState<T> & {
  readonly value: Maybe<T>;
};

/**
 * Loading state with a value key and a non-maybe value.
 */
export type LoadingStateWithDefinedValue<T = unknown> = LoadingState<T> & {
  readonly value: T;
};

/**
 * Loading state with an error
 */
export type LoadingStateWithError<T = unknown> = LoadingState<T> & {
  readonly error: ReadableError;
};

/**
 * Convenience identifier for a LoadingState that returns a list.
 */
export type ListLoadingState<T = unknown> = LoadingState<T[]>;

/**
 * LoadingState with a Page.
 */
export interface PageLoadingState<T = unknown> extends LoadingState<T>, Page {
  /**
   * Whether or not there is a next page. Null/undefined if unknown.
   */
  readonly hasNextPage?: Maybe<boolean>;
}

/**
 * PageLoadingState with a filter.
 */
export interface FilteredPageLoadingState<T, F> extends PageLoadingState<T>, FilteredPage<F> {}

/**
 * LoadingPageState that has an array of the values and
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
 * Determines the current {@link LoadingStateType} of a {@link LoadingState}.
 *
 * Returns `LOADING` if still loading, `SUCCESS` if finished with a value key,
 * `ERROR` if finished with an error key, or `IDLE` if finished with neither.
 *
 * @example
 * ```ts
 * loadingStateType(beginLoading()); // LoadingStateType.LOADING
 * loadingStateType(successResult(42)); // LoadingStateType.SUCCESS
 * loadingStateType(errorResult(new Error())); // LoadingStateType.ERROR
 * loadingStateType({ loading: false }); // LoadingStateType.IDLE
 * ```
 *
 * @param loadingState - the loading state to classify
 * @returns the corresponding {@link LoadingStateType}
 */
export function loadingStateType(loadingState: LoadingState): LoadingStateType {
  const isLoading = !isLoadingStateFinishedLoading(loadingState);
  let type: LoadingStateType;

  if (isLoading) {
    type = LoadingStateType.LOADING;
  } else {
    if (objectHasKey(loadingState, 'value')) {
      type = LoadingStateType.SUCCESS;
    } else if (objectHasKey(loadingState, 'error')) {
      type = LoadingStateType.ERROR;
    } else {
      type = LoadingStateType.IDLE;
    }
  }

  return type;
}

/**
 * Whether the given {@link LoadingState} has finished loading.
 *
 * Returns `true` when `loading` is explicitly `false`, or when `loading` is not `true`
 * and either a value, error, or `null` value is present.
 *
 * @example
 * ```ts
 * isLoadingStateFinishedLoading(successResult('done')); // true
 * isLoadingStateFinishedLoading(beginLoading()); // false
 * isLoadingStateFinishedLoading({ loading: false }); // true
 * isLoadingStateFinishedLoading(null); // false
 * ```
 *
 * @param state - the loading state to check (may be null/undefined)
 * @returns true if loading is complete
 */
export function isLoadingStateFinishedLoading<L extends LoadingState>(state: Maybe<L>): boolean {
  let result = false;

  if (state) {
    const loading = state.loading;

    if (loading === true) {
      result = false;
    } else {
      result = loading === false || Boolean(state.value ?? state.error) || state.value === null;
    }
  }

  return result;
}
/**
 * Creates an idle {@link LoadingState} with `loading: false` and no value or error.
 *
 * Represents a state where no loading has been initiated yet.
 *
 * @example
 * ```ts
 * const state = idleLoadingState();
 * // { loading: false }
 * loadingStateType(state); // LoadingStateType.IDLE
 * ```
 *
 * @returns a loading state with `loading: false` and no value or error
 */
export function idleLoadingState<T>(): LoadingState<T> {
  return { loading: false };
}

/**
 * Creates a {@link LoadingState} with `loading: true`, optionally merged with additional state properties.
 *
 * @example
 * ```ts
 * const state = beginLoading();
 * // { loading: true }
 *
 * const pageState = beginLoading({ page: 2 });
 * // { page: 2, loading: true }
 * ```
 *
 * @param state - optional partial state to merge with the loading flag
 * @returns a loading state with `loading: true`
 */
export function beginLoading<T>(): LoadingState<T>;
export function beginLoading<T>(state?: Partial<PageLoadingState<T>>): PageLoadingState<T>;
export function beginLoading<T>(state?: Partial<LoadingState<T>>): LoadingState<T>;
export function beginLoading<T>(state?: Partial<LoadingState<T>>): LoadingState<T> {
  return state ? { ...state, loading: true } : { loading: true };
}

/**
 * Creates a {@link PageLoadingState} that is loading for the given page number.
 *
 * @param page - the page number being loaded
 * @param state - optional partial state to merge
 * @returns a page loading state with `loading: true`
 */
export function beginLoadingPage<T>(page: PageNumber, state?: Partial<PageLoadingState<T>>): PageLoadingState<T> {
  return state ? { page, ...state, loading: true } : { page, loading: true };
}

/**
 * Creates a successful {@link LoadingState} with the given value and `loading: false`.
 *
 * @example
 * ```ts
 * const state = successResult({ name: 'Alice' });
 * // { value: { name: 'Alice' }, loading: false }
 * ```
 *
 * @param value - the loaded value
 * @returns a loading state representing a successful result
 */
export function successResult<T>(value: T): LoadingStateWithValue<T> {
  return { value, loading: false };
}

/**
 * Creates a successful {@link PageLoadingState} for a specific page.
 *
 * @param page - the page number
 * @param value - the loaded value
 * @returns a page loading state representing success
 */
export function successPageResult<T>(page: PageNumber, value: T): PageLoadingState<T> {
  return { ...successResult(value), page };
}

/**
 * Creates a {@link LoadingState} representing an error with `loading: false`.
 *
 * Converts the input error to a {@link ReadableError} via {@link toReadableError}.
 *
 * @example
 * ```ts
 * const state = errorResult(new Error('Not found'));
 * // { error: { message: 'Not found', ... }, loading: false }
 * ```
 *
 * @param error - the error to wrap (string, Error, or ReadableError)
 * @returns a loading state representing an error
 */
export function errorResult<T>(error?: Maybe<ErrorInput>): LoadingState<T> {
  return { error: toReadableError(error), loading: false };
}

/**
 * Creates a {@link PageLoadingState} representing an error for a specific page.
 *
 * @param page - the page number
 * @param error - the error to include
 * @returns a page loading state representing an error
 */
export function errorPageResult<T>(page: PageNumber, error?: Maybe<ReadableError | ReadableDataError>): PageLoadingState<T> {
  return { ...errorResult(error), page };
}

/**
 * Whether any of the given {@link LoadingState} instances are currently loading.
 *
 * @example
 * ```ts
 * isAnyLoadingStateInLoadingState([successResult(1), beginLoading()]); // true
 * isAnyLoadingStateInLoadingState([successResult(1), successResult(2)]); // false
 * ```
 *
 * @param states - array of loading states to check
 * @returns true if at least one state is loading
 */
export function isAnyLoadingStateInLoadingState(states: LoadingState[]): boolean {
  return reduceBooleansWithOr(states.map(isLoadingStateLoading), false);
}

/**
 * Whether all given {@link LoadingState} instances have finished loading.
 *
 * @example
 * ```ts
 * areAllLoadingStatesFinishedLoading([successResult(1), successResult(2)]); // true
 * areAllLoadingStatesFinishedLoading([successResult(1), beginLoading()]); // false
 * ```
 *
 * @param states - array of loading states to check
 * @returns true if every state has finished loading
 */
export function areAllLoadingStatesFinishedLoading(states: LoadingState[]): boolean {
  return reduceBooleansWithAnd(states.map(isLoadingStateFinishedLoading), true);
}

/**
 * Creates a predicate function that checks whether a {@link LoadingState} matches the given {@link LoadingStateType}.
 *
 * When the target type is `IDLE`, returns `true` for null/undefined states.
 *
 * @param type - the loading state type to match against
 * @returns a predicate function for the given type
 */
export function isLoadingStateWithStateType(type: LoadingStateType) {
  const defaultResult = type === LoadingStateType.IDLE;
  return <L extends LoadingState>(state: Maybe<L>) => {
    return state ? loadingStateType(state) === type : defaultResult;
  };
}

/**
 * Returns true if the input LoadingState passed to loadingStateType() returns IDLE.
 *
 * @param state
 * @returns
 */
export const isLoadingStateInIdleState = isLoadingStateWithStateType(LoadingStateType.IDLE);

/**
 * Returns true if the input LoadingState passed to loadingStateType() returns LOADING.
 *
 * @param state
 * @returns
 */
export const isLoadingStateLoading = isLoadingStateWithStateType(LoadingStateType.LOADING);

/**
 * Alias of isLoadingStateLoading.
 */
export const isLoadingStateInLoadingState = isLoadingStateLoading;

/**
 * Returns true if the input LoadingState passed to loadingStateType() returns SUCCESS.
 *
 * @param state
 * @returns
 */
export const isLoadingStateInSuccessState = isLoadingStateWithStateType(LoadingStateType.SUCCESS);

/**
 * Returns true if the input LoadingState passed to loadingStateType() returns ERROR.
 *
 * @param state
 * @returns
 */
export const isLoadingStateInErrorState = isLoadingStateWithStateType(LoadingStateType.ERROR);

/**
 * Type guard that checks whether a {@link LoadingState} has a non-undefined value, regardless of loading status.
 *
 * @example
 * ```ts
 * isLoadingStateWithDefinedValue(successResult('hello')); // true
 * isLoadingStateWithDefinedValue(successResult(null)); // true (null is defined)
 * isLoadingStateWithDefinedValue(beginLoading()); // false
 * ```
 *
 * @param state - the loading state to check
 * @returns true if the state has a defined (non-undefined) value
 */
export function isLoadingStateWithDefinedValue<L extends LoadingState>(state: Maybe<L> | LoadingStateWithDefinedValue<LoadingStateValue<L>>): state is LoadingStateWithDefinedValue<LoadingStateValue<L>> {
  return state ? state.value !== undefined : false;
}

/**
 * Type guard that checks whether a {@link LoadingState} has a non-null error, regardless of loading status.
 *
 * @example
 * ```ts
 * isLoadingStateWithError(errorResult(new Error('fail'))); // true
 * isLoadingStateWithError(successResult('ok')); // false
 * ```
 *
 * @param state - the loading state to check
 * @returns true if the state has an error
 */
export function isLoadingStateWithError<L extends LoadingState>(state: Maybe<L> | LoadingState<LoadingStateValue<L>>): state is LoadingStateWithError<LoadingStateValue<L>> {
  return state ? state.error != null : false;
}

/**
 * Type guard that checks whether a {@link LoadingState} has finished loading and has a defined value.
 *
 * @param state - the loading state to check
 * @returns true if finished loading with a non-undefined value
 */
export function isLoadingStateFinishedLoadingWithDefinedValue<L extends LoadingState>(state: Maybe<L> | LoadingStateWithDefinedValue<LoadingStateValue<L>>): state is LoadingStateWithDefinedValue<LoadingStateValue<L>> {
  return state ? isLoadingStateFinishedLoading(state) && state.value !== undefined : false;
}

/**
 * Type guard that checks whether a {@link LoadingState} has finished loading and has an error.
 *
 * @param state - the loading state to check
 * @returns true if finished loading with an error
 */
export function isLoadingStateFinishedLoadingWithError<L extends LoadingState>(state: Maybe<L> | LoadingState<LoadingStateValue<L>>): state is LoadingStateWithError<LoadingStateValue<L>> {
  return state ? isLoadingStateFinishedLoading(state) && state.error != null : false;
}

/**
 * Compares the metadata (page, loading, error) of two {@link PageLoadingState} instances for equivalence.
 *
 * Does not compare values — only structural metadata.
 *
 * @example
 * ```ts
 * isPageLoadingStateMetadataEqual(
 *   { page: 1, loading: true },
 *   { page: 1, loading: true }
 * ); // true
 *
 * isPageLoadingStateMetadataEqual(
 *   { page: 1 },
 *   { page: 2 }
 * ); // false
 * ```
 *
 * @param a - first page loading state
 * @param b - second page loading state
 * @returns true if metadata is equivalent
 */
export function isPageLoadingStateMetadataEqual(a: Partial<PageLoadingState>, b: Partial<PageLoadingState>) {
  return valuesAreBothNullishOrEquivalent(a.page, b.page) && a.loading == b.loading && valuesAreBothNullishOrEquivalent(a.error, b.error);
}

// TODO(BREAKING_CHANGE): Fix all LoadingState types to use the LoadingStateValue inference typings

/**
 * Merges multiple {@link LoadingState} instances into a single combined state.
 *
 * If any input is loading, returns a loading state. If any has an error (and is not still loading),
 * returns the first error. When all are successful, merges the values using the optional merge function
 * or `mergeObjects` by default.
 *
 * @example
 * ```ts
 * // Merge two successful states (values spread-merged)
 * const merged = mergeLoadingStates(
 *   successResult({ a: 1 }),
 *   successResult({ b: 2 })
 * );
 * // { loading: false, value: { a: 1, b: 2 } }
 *
 * // Merge with a custom function
 * const merged = mergeLoadingStates(
 *   successResult({ x: 10 }),
 *   successResult({ y: 20 }),
 *   (a, b) => ({ sum: a.x + b.y })
 * );
 * // { loading: false, value: { sum: 30 } }
 *
 * // Any loading input makes the result loading
 * const merged = mergeLoadingStates(beginLoading(), successResult({ a: 1 }));
 * // { loading: true }
 * ```
 *
 * @param a - the first loading state to merge
 * @param b - the second loading state to merge
 * @returns the combined loading state reflecting the merged values, errors, and loading flags
 */
/* eslint-disable @typescript-eslint/max-params -- variadic overload signatures */
export function mergeLoadingStates<A extends object, B extends object>(a: LoadingState<A>, b: LoadingState<B>): LoadingState<A & B>;
export function mergeLoadingStates<A extends object, B extends object, O>(a: LoadingState<A>, b: LoadingState<B>, mergeFn: (a: A, b: B) => O): LoadingState<O>;
export function mergeLoadingStates<A extends object, B extends object, C extends object>(a: LoadingState<A>, b: LoadingState<B>, c: LoadingState<C>): LoadingState<A & B & C>;
export function mergeLoadingStates<A extends object, B extends object, C extends object, O>(a: LoadingState<A>, b: LoadingState<B>, c: LoadingState<C>, mergeFn: (a: A, b: B, c: C) => O): LoadingState<O>;
export function mergeLoadingStates<A extends object, B extends object, C extends object, D extends object>(a: LoadingState<A>, b: LoadingState<B>, c: LoadingState<C>, d: LoadingState<D>): LoadingState<A & B & C & D>;
export function mergeLoadingStates<A extends object, B extends object, C extends object, D extends object, O>(a: LoadingState<A>, b: LoadingState<B>, c: LoadingState<C>, d: LoadingState<D>, mergeFn: (a: A, b: B, c: C, d: D) => O): LoadingState<O>;
export function mergeLoadingStates<A extends object, B extends object, C extends object, D extends object, E extends object, O>(a: LoadingState<A>, b: LoadingState<B>, c: LoadingState<C>, d: LoadingState<D>, e: LoadingState<E>): LoadingState<A & B & C & D & E>;
export function mergeLoadingStates<A extends object, B extends object, C extends object, D extends object, E extends object, O>(a: LoadingState<A>, b: LoadingState<B>, c: LoadingState<C>, d: LoadingState<D>, e: LoadingState<E>, mergeFn: (a: A, b: B, c: C, d: D, e: E) => O): LoadingState<O>;
export function mergeLoadingStates<O>(...args: any[]): LoadingState<O>;
// eslint-disable-next-line jsdoc/require-jsdoc -- JSDoc is on the overload signatures above
export function mergeLoadingStates<O>(...args: any[]): LoadingState<O> {
  /* eslint-enable @typescript-eslint/max-params */
  const validArgs = filterMaybeArrayValues(args); // filter out any undefined values
  const lastValueIsMergeFn = typeof validArgs.at(-1) === 'function';
  const loadingStates: LoadingState<any>[] = lastValueIsMergeFn ? validArgs.slice(0, -1) : validArgs;
  const mergeFn = lastValueIsMergeFn ? args.at(validArgs.length - 1) : (...inputArgs: any[]) => mergeObjects(inputArgs);

  const error = loadingStates.find((x) => x.error)?.error; // find the first error
  let result: LoadingState<O>;

  if (error) {
    // ignore all loading states, except for any error-prone item that is still loading
    const currentLoadings: Maybe<boolean>[] = loadingStates.map((x) => (x.error ? x.loading : false));
    const nonMaybeLoadings = currentLoadings.filter((x) => x != null) as boolean[];
    const loading = nonMaybeLoadings.length > 0 ? reduceBooleansWithOr(nonMaybeLoadings) : undefined;

    // TODO: Merge loadingProgress values, probably only if they're all defined though, otherwise undefined

    result = {
      // Evaluate both for the loading state.
      loading,
      error
    };
  } else {
    const loading = reduceBooleansWithOr(loadingStates.map(isLoadingStateLoading));

    if (loading) {
      result = {
        loading: true
      };
    } else {
      const values = loadingStates.map((x) => x.value);
      const value = mergeFn(...values) as O;

      result = {
        loading: false,
        value
      };
    }
  }

  return result;
}

/**
 * Returns a copy of the state with the value and error cleared, and `loading` set to the given flag.
 *
 * Useful for resetting a state back to loading or idle without losing other metadata (e.g., page).
 *
 * @param state - the state to copy metadata from
 * @param loading - whether to mark as loading (defaults to true)
 * @returns a new state with value/error cleared
 */
export function mergeLoadingStateWithLoading<S extends LoadingState>(state: S, loading = true): S {
  return {
    ...state,
    value: undefined,
    loading,
    error: undefined
  };
}

/**
 * Returns a copy of the state with the given value, `loading: false`, and error cleared.
 *
 * @param state - the state to copy metadata from
 * @param value - the new value to set
 * @returns a new state representing success
 */
export function mergeLoadingStateWithValue<S extends LoadingState>(state: S, value: LoadingStateValue<S> | undefined): S {
  return {
    ...state,
    value: value ?? undefined,
    loading: false,
    error: undefined
  };
}

/**
 * Returns a copy of the state with the given error and `loading: false`.
 *
 * @param state - the state to copy metadata from
 * @param error - the error to set
 * @returns a new state representing an error
 */
export function mergeLoadingStateWithError<S extends LoadingState = LoadingState>(state: S, error?: ReadableDataError): S {
  return {
    ...state,
    loading: false,
    error
  };
}

export type MapMultipleLoadingStateValuesFn<T, X> = (input: X[]) => T;

export interface MapMultipleLoadingStateResultsConfiguration<T, X, L extends LoadingState<X>[], R extends LoadingState<T>> {
  readonly mapValues?: MapMultipleLoadingStateValuesFn<T, X>;
  readonly mapState?: (input: L) => R;
}

/**
 * Maps multiple {@link LoadingState} results into a single state using a value mapping or state mapping function.
 *
 * Returns `undefined` if any input is still loading or has an error.
 *
 * @param input - array of loading states to combine
 * @param config - mapping configuration with either `mapValues` or `mapState`
 * @returns the combined loading state, or undefined if inputs are not ready
 *
 * @throws {Error} When neither `mapValues` nor `mapState` is provided in the config.
 */
export function mapMultipleLoadingStateResults<T, X, L extends LoadingState<X>[], R extends LoadingState<T>>(input: L, config: MapMultipleLoadingStateResultsConfiguration<T, X, L, R>): Maybe<R> {
  const { mapValues, mapState } = config;
  const loading = isAnyLoadingStateInLoadingState(input);
  const error = input.map((x) => x.error).find(Boolean);
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
  readonly alwaysMapValue?: boolean;
  readonly mapValue?: MapLoadingStateValuesFn<A, B, L>;
  readonly mapState?: MapLoadingStateFn<A, B, L, O>;
}

/**
 * Maps the value of a single {@link LoadingState} to a new type using the provided configuration.
 *
 * Preserves the loading/error metadata while transforming the value via `mapValue` or the entire
 * state via `mapState`. When `alwaysMapValue` is true, maps even when the value is null/undefined.
 *
 * @example
 * ```ts
 * const result = mapLoadingStateResults(successResult(0), {
 *   mapValue: (v) => `Value: ${v}`
 * });
 * // { value: 'Value: 0', loading: false }
 * ```
 *
 * @param input - the loading state to transform
 * @param config - mapping configuration
 * @returns the transformed loading state
 */
export function mapLoadingStateResults<A, B, L extends LoadingState<A> = LoadingState<A>, O extends LoadingState<B> = LoadingState<B>>(input: L, config: MapLoadingStateResultsConfiguration<A, B, L, O>): O;
export function mapLoadingStateResults<A, B, L extends PageLoadingState<A> = PageLoadingState<A>, O extends PageLoadingState<B> = PageLoadingState<B>>(input: L, config: MapLoadingStateResultsConfiguration<A, B, L, O>): O;
export function mapLoadingStateResults<A, B, L extends Partial<PageLoadingState<A>> = Partial<PageLoadingState<A>>, O extends Partial<PageLoadingState<B>> = Partial<PageLoadingState<B>>>(input: L, config: MapLoadingStateResultsConfiguration<A, B, L, O>): O;
export function mapLoadingStateResults<A, B, L extends Partial<PageLoadingState<A>> = Partial<PageLoadingState<A>>, O extends Partial<PageLoadingState<B>> = Partial<PageLoadingState<B>>>(input: L, config: MapLoadingStateResultsConfiguration<A, B, L, O>): O {
  const { mapValue, mapState, alwaysMapValue = false } = config;
  const inputValue = input.value;
  let value: B;

  if ((inputValue != null || alwaysMapValue) && mapValue) {
    value = mapValue(inputValue as A, input);
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

/**
 * Creates a function that extracts and maps the value from a {@link LoadingState}, returning undefined
 * when the state has no value.
 *
 * @param mapFn - function to transform the value and state into the output type
 * @returns a function that accepts a loading state and returns the mapped value or undefined
 */
export function mapLoadingStateValueFunction<O, I, L extends LoadingState<I> = LoadingState<I>>(mapFn: MapLoadingStateValueMapFunction<O, I, L>): MapLoadingStateValueFunction<O, I, L> {
  return (state: L) => {
    let result: Maybe<O>;

    if (state.value != null) {
      result = mapFn(state.value, state);
    }

    return result;
  };
}
