import { type Maybe, type ReadableError, reduceBooleansWithAnd, reduceBooleansWithOr, type ReadableDataError, type Page, type PageNumber, objectHasKey, type MapFunction, type ErrorInput, toReadableError, mergeObjects, filterMaybeArrayValues, valuesAreBothNullishOrEquivalent } from '@dereekb/util';
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
 * @param a - First loading state.
 * @param b - Second loading state.
 * @returns True if loading, loadingProgress, error, and value are all strictly equal.
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
 */
export function isLoadingStateEqual<L extends LoadingState>(a: L, b: L): boolean {
  return a.loading === b.loading && a.loadingProgress === b.loadingProgress && a.error === b.error && a.value === b.value;
}

/**
 * Compares the metadata (loading flag, loading progress, and error) of two {@link LoadingErrorPair} instances,
 * using loose equality for loading and nullish-aware comparison for progress and error.
 *
 * Does not compare the `value` property — only structural metadata.
 *
 * @param a - First loading error pair.
 * @param b - Second loading error pair.
 * @returns True if both pairs have equivalent metadata.
 */
export function isLoadingStateMetadataEqual(a: Partial<LoadingErrorPair>, b: Partial<LoadingErrorPair>): boolean {
  return a.loading == b.loading && valuesAreBothNullishOrEquivalent(a.loadingProgress, b.loadingProgress) && valuesAreBothNullishOrEquivalent(a.error, b.error);
}

/**
 * A value/error pair used in loading situations.
 *
 * The `T = unknown` default is deliberate: it makes the bare `LoadingState` the correct top type for
 * an `L extends LoadingState` constraint, which every shape-preserving helper in this file relies on.
 */
export interface LoadingState<T = unknown> extends LoadingErrorPair {
  readonly value?: Maybe<T>;
}

/**
 * Returns the value type inferred from the LoadingState type.
 *
 * This is a conditional type, and therefore a non-inferable position: a signature that mentions
 * `LoadingStateValue<L>` in an argument position can never infer `L` from that argument. Use it only
 * in callback-parameter positions and return types.
 *
 * Note that `LoadingStateValue<LoadingState<never>>` resolves to `unknown`, not `never`, because
 * inferring `Maybe<never>` (which is `null | undefined`) against `Maybe<T>` leaves `T` candidate-less.
 *
 * The conditional `infer` body is kept intentionally; a `NonNullable<L['value']>` rewrite is
 * functionally equivalent and removes no cast.
 */
export type LoadingStateValue<L extends LoadingState> = L extends LoadingState<infer T> ? T : never;

/**
 * Replaces the value type of the input LoadingState.
 *
 * The `L extends LoadingState ? ... : never` wrapper is load-bearing rather than dead code: it makes
 * the type distribute over a union of state types. `Omit<A | B, K>` collapses a union down to its
 * common keys, so without distribution a union containing a {@link PageLoadingState} would lose `page`.
 */
export type LoadingStateWithValueType<L extends LoadingState, T> = L extends LoadingState ? Omit<L, 'value'> & LoadingState<T> : never;

/**
 * The result of re-deriving a {@link LoadingState} with its `value` and `error` cleared or replaced.
 *
 * The `value` and `error` keys are dropped from `S` before the plain {@link LoadingState} shape is
 * re-added, because the merge helpers may clear a field that `S` itself requires (a
 * `LoadingStateWithDefinedValue<Foo>` cannot honestly be returned once its value is cleared).
 */
export type MergedLoadingState<S extends LoadingState> = Omit<S, 'value' | 'error'> & LoadingState<LoadingStateValue<S>>;

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
 * LoadingPageState that has an array of the values and
 */
export type PageListLoadingState<T = unknown> = PageLoadingState<T[]>;

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
 * @param loadingState - The loading state to classify.
 * @returns The corresponding {@link LoadingStateType}
 *
 * @example
 * ```ts
 * loadingStateType(beginLoading()); // LoadingStateType.LOADING
 * loadingStateType(successResult(42)); // LoadingStateType.SUCCESS
 * loadingStateType(errorResult(new Error())); // LoadingStateType.ERROR
 * loadingStateType({ loading: false }); // LoadingStateType.IDLE
 * ```
 */
export function loadingStateType(loadingState: LoadingState): LoadingStateType {
  const isLoading = !isLoadingStateFinishedLoading(loadingState);
  let type: LoadingStateType;

  if (isLoading) {
    type = LoadingStateType.LOADING;
  } else if (loadingState.error != null) {
    /**
     * The error is checked first: a state can legitimately carry both an error and a value (for
     * instance a state mapped through mapLoadingStateResults, or one merged via
     * mergeLoadingStateWithError), and an error always wins over a stale value.
     */
    type = LoadingStateType.ERROR;
  } else if (objectHasKey(loadingState, 'value')) {
    /**
     * The own-key test is deliberate for `value` (and only for `value`): `value: null` is a
     * meaningful "loaded, but empty" signal, so key presence rather than nullishness decides success.
     */
    type = LoadingStateType.SUCCESS;
  } else {
    type = LoadingStateType.IDLE;
  }

  return type;
}

/**
 * Whether the given {@link LoadingState} has finished loading.
 *
 * Returns `true` when `loading` is explicitly `false`, or when `loading` is not `true`
 * and either a value, error, or `null` value is present.
 *
 * @param state - The loading state to check (may be null/undefined)
 * @returns True if loading is complete.
 *
 * @example
 * ```ts
 * isLoadingStateFinishedLoading(successResult('done')); // true
 * isLoadingStateFinishedLoading(beginLoading()); // false
 * isLoadingStateFinishedLoading({ loading: false }); // true
 * isLoadingStateFinishedLoading(null); // false
 * ```
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
 * @returns A loading state with `loading: false` and no value or error.
 *
 * @example
 * ```ts
 * const state = idleLoadingState();
 * // { loading: false }
 * loadingStateType(state); // LoadingStateType.IDLE
 * ```
 */
export function idleLoadingState<T = never>(): LoadingState<T> {
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
export function beginLoading<T = never>(): LoadingState<T>;
export function beginLoading<T = never>(state: Partial<LoadingState<T>> & Page): PageLoadingState<T>;
export function beginLoading<T = never>(state?: Partial<LoadingState<T>>): LoadingState<T>;
export function beginLoading<T = never>(state?: Partial<LoadingState<T>>): LoadingState<T> {
  return state ? { ...state, loading: true } : { loading: true };
}

/**
 * Creates a {@link PageLoadingState} that is loading for the given page number.
 *
 * @param page - The page number being loaded.
 * @param state - Optional partial state to merge.
 * @returns A page loading state with `loading: true`
 */
export function beginLoadingPage<T>(page: PageNumber, state?: Partial<PageLoadingState<T>>): PageLoadingState<T> {
  return state ? { ...state, page, loading: true } : { page, loading: true };
}

/**
 * Creates a successful {@link LoadingState} with the given value and `loading: false`.
 *
 * @param value - The loaded value.
 * @returns A loading state representing a successful result.
 *
 * @example
 * ```ts
 * const state = successResult({ name: 'Alice' });
 * // { value: { name: 'Alice' }, loading: false }
 * ```
 */
export function successResult<T>(value: T): LoadingStateWithValue<T> {
  return { value, loading: false };
}

/**
 * Creates a successful {@link PageLoadingState} for a specific page.
 *
 * @param page - The page number.
 * @param value - The loaded value.
 * @returns A page loading state representing success.
 */
export function successPageResult<T>(page: PageNumber, value: T): PageLoadingState<T> & LoadingStateWithValue<T> {
  return { ...successResult(value), page };
}

/**
 * Creates a {@link LoadingState} representing an error with `loading: false`.
 *
 * Converts the input error to a {@link ReadableError} via {@link toReadableError}.
 *
 * @param error - The error to wrap (string, Error, or ReadableError)
 * @returns A loading state representing an error.
 *
 * @example
 * ```ts
 * const state = errorResult(new Error('Not found'));
 * // { error: { message: 'Not found', ... }, loading: false }
 * ```
 */
export function errorResult<T = never>(error: ErrorInput): LoadingStateWithError<T>;
export function errorResult<T = never>(error?: Maybe<ErrorInput>): LoadingState<T>;

export function errorResult<T = never>(error?: Maybe<ErrorInput>): LoadingState<T> {
  return { error: toReadableError(error), loading: false };
}

/**
 * Creates a {@link PageLoadingState} representing an error for a specific page.
 *
 * @param page - The page number.
 * @param error - The error to include.
 * @returns A page loading state representing an error.
 */
export function errorPageResult<T = never>(page: PageNumber, error?: Maybe<ErrorInput>): PageLoadingState<T> {
  return { ...errorResult(error), page };
}

/**
 * Whether any of the given {@link LoadingState} instances are currently loading.
 *
 * @param states - Array of loading states to check.
 * @returns True if at least one state is loading.
 *
 * @example
 * ```ts
 * isAnyLoadingStateInLoadingState([successResult(1), beginLoading()]); // true
 * isAnyLoadingStateInLoadingState([successResult(1), successResult(2)]); // false
 * ```
 */
export function isAnyLoadingStateInLoadingState(states: readonly LoadingState[]): boolean {
  return reduceBooleansWithOr(states.map(isLoadingStateLoading), false);
}

/**
 * Whether all given {@link LoadingState} instances have finished loading.
 *
 * @param states - Array of loading states to check.
 * @returns True if every state has finished loading.
 *
 * @example
 * ```ts
 * areAllLoadingStatesFinishedLoading([successResult(1), successResult(2)]); // true
 * areAllLoadingStatesFinishedLoading([successResult(1), beginLoading()]); // false
 * ```
 */
export function areAllLoadingStatesFinishedLoading(states: readonly LoadingState[]): boolean {
  return reduceBooleansWithAnd(states.map(isLoadingStateFinishedLoading), true);
}

/**
 * Creates a predicate function that checks whether a {@link LoadingState} matches the given {@link LoadingStateType}.
 *
 * When the target type is `IDLE`, returns `true` for null/undefined states.
 *
 * @param type - The loading state type to match against.
 * @returns A predicate function for the given type.
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
 * @param state - The loading state to check.
 * @returns True if the state has a defined (non-undefined) value.
 *
 * @example
 * ```ts
 * isLoadingStateWithDefinedValue(successResult('hello')); // true
 * isLoadingStateWithDefinedValue(successResult(null)); // true (null is defined)
 * isLoadingStateWithDefinedValue(beginLoading()); // false
 * ```
 */
export function isLoadingStateWithDefinedValue<L extends LoadingState>(state: Maybe<L>): state is L & LoadingStateWithDefinedValue<LoadingStateValue<L>> {
  return state ? state.value !== undefined : false;
}

/**
 * Type guard that checks whether a {@link LoadingState} has a non-null error, regardless of loading status.
 *
 * @param state - The loading state to check.
 * @returns True if the state has an error.
 *
 * @example
 * ```ts
 * isLoadingStateWithError(errorResult(new Error('fail'))); // true
 * isLoadingStateWithError(successResult('ok')); // false
 * ```
 */
export function isLoadingStateWithError<L extends LoadingState>(state: Maybe<L>): state is L & LoadingStateWithError<LoadingStateValue<L>> {
  return state ? state.error != null : false;
}

/**
 * Type guard that checks whether a {@link LoadingState} has finished loading and has a defined value.
 *
 * @param state - The loading state to check.
 * @returns True if finished loading with a non-undefined value.
 */
export function isLoadingStateFinishedLoadingWithDefinedValue<L extends LoadingState>(state: Maybe<L>): state is L & LoadingStateWithDefinedValue<LoadingStateValue<L>> {
  return state ? isLoadingStateFinishedLoading(state) && state.value !== undefined : false;
}

/**
 * Type guard that checks whether a {@link LoadingState} has finished loading and has an error.
 *
 * @param state - The loading state to check.
 * @returns True if finished loading with an error.
 */
export function isLoadingStateFinishedLoadingWithError<L extends LoadingState>(state: Maybe<L>): state is L & LoadingStateWithError<LoadingStateValue<L>> {
  return state ? isLoadingStateFinishedLoading(state) && state.error != null : false;
}

/**
 * Compares the metadata (page, loading, error) of two {@link PageLoadingState} instances for equivalence.
 *
 * Does not compare values — only structural metadata.
 *
 * @param a - First page loading state.
 * @param b - Second page loading state.
 * @returns True if metadata is equivalent.
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
 */
export function isPageLoadingStateMetadataEqual(a: Partial<PageLoadingState>, b: Partial<PageLoadingState>) {
  return valuesAreBothNullishOrEquivalent(a.page, b.page) && a.loading == b.loading && valuesAreBothNullishOrEquivalent(a.error, b.error);
}

// MARK: Accessors
/**
 * Type guard that checks whether the input {@link LoadingState} also carries a {@link Page}.
 *
 * `Page` is intentionally kept orthogonal to `LoadingState`, so this is the supported way to ask a
 * state whether it is paginated without hoisting page keys onto the base type.
 *
 * @param state - The loading state to check (may be null/undefined)
 * @returns True when the state is present and exposes a numeric `page`.
 *
 * @example
 * ```ts
 * isPageLoadingState(successPageResult(0, 'a')); // true
 * isPageLoadingState(successResult('a')); // false
 * ```
 */
export function isPageLoadingState<L extends LoadingState>(state: Maybe<L>): state is L & Page {
  return state != null && typeof (state as Partial<Page>).page === 'number';
}

/**
 * Reads the `hasNextPage` flag from the input state, if it carries one.
 *
 * @param state - The loading state to read from (may be null/undefined)
 * @returns The `hasNextPage` value, or null/undefined when the state is absent or not paginated.
 *
 * @example
 * ```ts
 * loadingStateHasNextPage({ page: 0, loading: false, hasNextPage: true }); // true
 * loadingStateHasNextPage(successResult('a')); // undefined
 * ```
 */
export function loadingStateHasNextPage(state: Maybe<LoadingState>): Maybe<boolean> {
  /**
   * Documented cast: `hasNextPage` lives on {@link PageLoadingState}, which is orthogonal to the
   * {@link LoadingState} apparent type, so it can only be reached structurally. This is the one place
   * that does so, instead of every caller writing `x as unknown as PageLoadingState`.
   */
  return (state as Maybe<PageLoadingState>)?.hasNextPage;
}

/**
 * Reads the value of a generic {@link LoadingState}.
 *
 * Reading `state.value` where `state: L` resolves through `L`'s apparent type (its constraint), which
 * yields `Maybe<unknown>` rather than `Maybe<LoadingStateValue<L>>`. This is the single documented
 * site that casts that back, so no other function in the library needs to.
 *
 * @param state - The loading state to read the value from.
 * @returns The state's value, typed as the state's value type.
 *
 * @example
 * ```ts
 * loadingStateValue(successResult('a')); // 'a'
 * loadingStateValue(beginLoading<string>()); // undefined
 * ```
 */
export function loadingStateValue<L extends LoadingState>(state: L): Maybe<LoadingStateValue<L>> {
  return state.value as Maybe<LoadingStateValue<L>>;
}

/**
 * Copies the input state, replacing only its value, and retypes the result to match.
 *
 * Distinct from {@link mergeLoadingStateWithValue}, which additionally forces `loading: false` and
 * clears any error; this preserves the input state's metadata (including `loading` and `error`)
 * exactly and swaps the value alone.
 *
 * @param state - The state to copy metadata from.
 * @param value - The replacement value.
 * @returns The state with its value type replaced.
 *
 * @example
 * ```ts
 * loadingStateWithValueType(successPageResult(0, 'a'), 1); // { page: 0, loading: false, value: 1 }
 * ```
 */
export function loadingStateWithValueType<L extends LoadingState, T>(state: L, value: Maybe<T>): LoadingStateWithValueType<L, T> {
  /**
   * Documented cast: no formulation of {@link LoadingStateWithValueType} lets a spread literal satisfy
   * it while `L` is still generic (mapped-type and `Omit`-free variants were both checked). The target
   * is one cast site rather than zero, and this is it.
   */
  return { ...state, value } as unknown as LoadingStateWithValueType<L, T>;
}

/**
 * Function used by {@link mergeLoadingStatesArray} to merge the values of the input states.
 */
export type MergeLoadingStatesArrayFunction<O> = (...values: any[]) => O;

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
export function mergeLoadingStates<A extends object, B extends object, C extends object, D extends object, E extends object>(a: LoadingState<A>, b: LoadingState<B>, c: LoadingState<C>, d: LoadingState<D>, e: LoadingState<E>): LoadingState<A & B & C & D & E>;
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
    const nonMaybeLoadings = currentLoadings.filter((x) => x != null);
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
 * Merges an array of {@link LoadingState} instances into a single combined state.
 *
 * The non-variadic counterpart to {@link mergeLoadingStates}: because the states arrive as one array
 * argument rather than as rest arguments, the output value type `O` is inferable from `mergeFn` and
 * the call site needs no cast.
 *
 * @param states - The loading states to merge.
 * @param mergeFn - Optional function merging the states' values; defaults to `mergeObjects`.
 * @returns The combined loading state.
 *
 * @example
 * ```ts
 * mergeLoadingStatesArray([successResult({ a: 1 }), successResult({ b: 2 })]);
 * // { loading: false, value: { a: 1, b: 2 } }
 *
 * mergeLoadingStatesArray([successResult(1), successResult(2)], (a: number, b: number) => a + b);
 * // { loading: false, value: 3 }
 * ```
 */
export function mergeLoadingStatesArray<O>(states: readonly LoadingState[], mergeFn?: MergeLoadingStatesArrayFunction<O>): LoadingState<O> {
  return mergeLoadingStates<O>(...states, mergeFn);
}

/**
 * Returns a copy of the state with the value and error cleared, and `loading` set to the given flag.
 *
 * Useful for resetting a state back to loading or idle without losing other metadata (e.g., page).
 *
 * @param state - The state to copy metadata from.
 * @param loading - Whether to mark as loading (defaults to true)
 * @returns A new state with value/error cleared.
 */
export function mergeLoadingStateWithLoading<S extends LoadingState>(state: S, loading = true): MergedLoadingState<S> {
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
 * @param state - The state to copy metadata from.
 * @param value - The new value to set.
 * @returns A new state representing success.
 */
export function mergeLoadingStateWithValue<S extends LoadingState>(state: S, value: Maybe<LoadingStateValue<S>>): MergedLoadingState<S> {
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
 * @param state - The state to copy metadata from.
 * @param error - The error to set.
 * @returns A new state representing an error.
 */
export function mergeLoadingStateWithError<S extends LoadingState = LoadingState>(state: S, error?: ReadableDataError): MergedLoadingState<S> {
  /**
   * The spread carries `value` through untouched, which is what the runtime should do — re-assigning
   * it would add a `value` own-key to a state that had none and flip its {@link LoadingStateType}.
   * The cast only restores `value`'s type, which the spread widened to `unknown` via `S`'s apparent
   * type; see {@link loadingStateValue} for the same apparent-type problem stated once.
   */
  return {
    ...state,
    loading: false,
    error
  } as unknown as MergedLoadingState<S>;
}

/**
 * Maps an entire input {@link LoadingState} (and its already-mapped value) to the output state.
 *
 * State-first, per the family-3 rule: `L` and `B` must resolve before `O`'s default is evaluated.
 */
export type MapLoadingStateFn<L extends LoadingState, B, O extends LoadingState = LoadingStateWithValueType<L, B>> = (input: L, value?: B) => O;

/**
 * Maps the value of an input {@link LoadingState} to the output value type.
 */
export type MapLoadingStateValuesFn<L extends LoadingState, B> = (input: LoadingStateValue<L>, state: L) => B;

/**
 * Configuration for {@link mapLoadingStateResults}.
 *
 * The type parameter order is load-bearing: the input state `L` comes first so that it (and then `B`,
 * inferred from `mapValue`'s return) is resolved before `O`'s default is evaluated. Any other order
 * leaves `O` — and with it the input state's shape, including `page` — degraded.
 *
 * `O` is constrained to a bare {@link LoadingState} rather than to `LoadingState<B>`: a caller that
 * threads its own output state type through (as the mapped-iteration layer does) cannot prove
 * `M extends LoadingState<LoadingStateValue<M>>` while `M` is still generic. `mapState`'s signature
 * still ties `O` back to `B`.
 */
export interface MapLoadingStateResultsConfiguration<L extends LoadingState, B, O extends LoadingState = LoadingStateWithValueType<L, B>> {
  readonly alwaysMapValue?: boolean;
  readonly mapValue?: MapLoadingStateValuesFn<L, B>;
  readonly mapState?: MapLoadingStateFn<L, B, O>;
}

/**
 * Maps the value of a single {@link LoadingState} to a new type using the provided configuration.
 *
 * Preserves the loading/error metadata while transforming the value via `mapValue` or the entire
 * state via `mapState`. When `alwaysMapValue` is true, maps even when the value is null/undefined.
 *
 * @param input - The loading state to transform.
 * @param config - Mapping configuration.
 * @returns The transformed loading state.
 *
 * @example
 * ```ts
 * const result = mapLoadingStateResults(successResult(0), {
 *   mapValue: (v) => `Value: ${v}`
 * });
 * // { value: 'Value: 0', loading: false }
 * ```
 */
export function mapLoadingStateResults<L extends LoadingState, B, O extends LoadingState = LoadingStateWithValueType<L, B>>(input: L, config: MapLoadingStateResultsConfiguration<L, B, O>): O {
  const { mapValue, mapState, alwaysMapValue = false } = config;
  const inputValue = loadingStateValue(input);
  let value: B;

  if ((inputValue != null || alwaysMapValue) && mapValue) {
    value = mapValue(inputValue as LoadingStateValue<L>, input);
  } else {
    value = inputValue as unknown as B;
  }

  let result: O;

  if (mapState) {
    result = mapState(input, value);
  } else {
    // `O` may be instantiated more narrowly than its LoadingStateWithValueType<L, B> default, so the
    // constructed state cannot be proven to be an `O` while both remain generic.
    result = loadingStateWithValueType(input, value) as unknown as O;
  }

  return result;
}

/**
 * Extracts and maps the value out of a {@link LoadingState}, or returns undefined when it has none.
 */
export type MapLoadingStateValueFunction<L extends LoadingState, O> = MapFunction<L, Maybe<O>>;

/**
 * Maps a {@link LoadingState}'s non-null value (and the state it came from) to the output type.
 */
export type MapLoadingStateValueMapFunction<L extends LoadingState, O> = (item: LoadingStateValue<L>, state: L) => Maybe<O>;

/**
 * Creates a function that extracts and maps the value from a {@link LoadingState}, returning undefined
 * when the state has no value.
 *
 * @param mapFn - Function to transform the value and state into the output type.
 * @returns Mapper that yields the transformed value when present, or undefined when the state has none.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function mapLoadingStateValueFunction<L extends LoadingState, O>(mapFn: MapLoadingStateValueMapFunction<L, O>): MapLoadingStateValueFunction<L, O> {
  return (state: L) => {
    const value = loadingStateValue(state);
    let result: Maybe<O>;

    if (value != null) {
      result = mapFn(value, state);
    }

    return result;
  };
}
