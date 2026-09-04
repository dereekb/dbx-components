import { type DecisionFunction, type Maybe, type ReadableError, filterMaybeArrayValues, type EqualityComparatorFunction, safeCompareEquality, type GetterOrValue, getValueFromGetter, type MaybeSoStrict } from '@dereekb/util';
import { type MonoTypeOperatorFunction, type OperatorFunction, startWith, type Observable, filter, map, tap, catchError, combineLatest, distinctUntilChanged, first, of, shareReplay, switchMap, type ObservableInputTuple, firstValueFrom, scan } from 'rxjs';
import { timeoutStartWith } from '../rxjs/timeout';
import {
  successResult,
  type LoadingState,
  type PageLoadingState,
  beginLoading,
  isLoadingStateFinishedLoading,
  mergeLoadingStatesArray,
  mapLoadingStateResults,
  type MapLoadingStateResultsConfiguration,
  type LoadingStateValue,
  isLoadingStateWithDefinedValue,
  LoadingStateType,
  loadingStateType,
  isLoadingStateLoading,
  isLoadingStateWithError,
  type LoadingStateWithValueType,
  errorResult,
  isPageLoadingStateMetadataEqual,
  type LoadingStateWithError,
  loadingStateValue,
  loadingStateWithValueType
} from './loading.state';
import { filterMaybeStrict } from '../rxjs/value';

/**
 * Wraps an observable output and maps the value to a {@link LoadingState}.
 *
 * Emits a loading state immediately, then emits a success result when the observable emits a value,
 * or an error result if the observable errors.
 *
 * If firstOnly is provided, it will only take the first value the observable returns.
 *
 * @param obs - The source observable to wrap.
 * @param firstOnly - If true, only takes the first value from the observable.
 * @returns An observable that emits {@link LoadingState} values representing the loading lifecycle.
 *
 * @example
 * ```ts
 * // Wrap a data fetch observable into a LoadingState
 * readonly jsonContentState$ = loadingStateFromObs(this.jsonContent$);
 *
 * // Wrap an observable and only take the first emitted value
 * readonly singleValueState$ = loadingStateFromObs(this.data$, true);
 * ```
 */
export function loadingStateFromObs<T>(obs: Observable<T>, firstOnly?: boolean): Observable<LoadingState<T>> {
  if (firstOnly) {
    obs = obs.pipe(first());
  }

  return obs.pipe(
    map((value) => successResult(value)),
    catchError((error) => of(errorResult<T>(error))),
    timeoutStartWith(beginLoading<T>(), 50),
    shareReplay(1)
  );
}

/**
 * Convenience function for creating a pipe that merges multiple loading states into one.
 *
 * Combines two or more {@link LoadingState} observables using `combineLatest` and merges their values.
 * If any input is still loading, the combined state is loading. If any input has an error, the error is propagated.
 * An optional merge function can be provided to customize how the values are combined; otherwise, values are spread-merged.
 *
 * @example
 * ```ts
 * // Merge two loading states into one combined state using object spread
 * const combined$ = combineLoadingStates(
 *   of(successResult({ a: true })),
 *   of(successResult({ b: true }))
 * );
 * // => emits LoadingState<{ a: true } & { b: true }>
 *
 * // Merge with a custom merge function
 * const combined$ = combineLoadingStates(
 *   of(successResult({ a: 1 })),
 *   of(successResult({ b: 2 })),
 *   (a, b) => ({ sum: a.a + b.b })
 * );
 * // => emits LoadingState<{ sum: number }> with value { sum: 3 }
 * ```
 *
 * @param obsA - the first LoadingState observable to combine
 * @param obsB - the second LoadingState observable to combine
 * @returns An observable emitting the merged {@link LoadingState}.
 */
/* eslint-disable @typescript-eslint/max-params -- variadic overload signatures */
export function combineLoadingStates<A extends object, B extends object>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>): Observable<LoadingState<A & B>>;
export function combineLoadingStates<A extends object, B extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, mergeFn: (a: A, b: B) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<A extends object, B extends object, C extends object>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>): Observable<LoadingState<A & B & C>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, mergeFn: (a: A, b: B, c: C) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, obsD: Observable<LoadingState<D>>): Observable<LoadingState<A & B & C & D>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object, O>(
  obsA: Observable<LoadingState<A>>,
  obsB: Observable<LoadingState<B>>,
  obsC: Observable<LoadingState<C>>,
  obsD: Observable<LoadingState<D>>,
  mergeFn: (a: A, b: B, c: C, d: D) => O
): Observable<LoadingState<O>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object, E extends object>(
  obsA: Observable<LoadingState<A>>,
  obsB: Observable<LoadingState<B>>,
  obsC: Observable<LoadingState<C>>,
  obsD: Observable<LoadingState<D>>,
  obsE: Observable<LoadingState<E>>
): Observable<LoadingState<A & B & C & D & E>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object, E extends object, O>(
  obsA: Observable<LoadingState<A>>,
  obsB: Observable<LoadingState<B>>,
  obsC: Observable<LoadingState<C>>,
  obsD: Observable<LoadingState<D>>,
  obsE: Observable<LoadingState<E>>,
  mergeFn: (a: A, b: B, c: C, d: D, e: E) => O
): Observable<LoadingState<O>>;
export function combineLoadingStates<O>(...args: any[]): Observable<LoadingState<O>>;
// eslint-disable-next-line jsdoc/require-jsdoc -- JSDoc is on the overload signatures above
export function combineLoadingStates<O>(...args: any[]): Observable<LoadingState<O>> {
  /* eslint-enable @typescript-eslint/max-params */
  const validArgs = filterMaybeArrayValues(args); // filter out any undefined values
  const lastValueIsMergeFn = typeof validArgs.at(-1) === 'function';
  const obsArgs: Observable<LoadingState<any>>[] = lastValueIsMergeFn ? validArgs.slice(0, -1) : validArgs;
  const mergeFn = lastValueIsMergeFn ? validArgs.at(-1) : undefined;

  return combineLatest(obsArgs).pipe(
    distinctUntilChanged((x, y) => {
      return !x.some((_, i) => x[i] !== y[i]);
    }), // Prevent remerging the same values!
    map((states: LoadingState<any>[]) => mergeLoadingStatesArray<O>(states, mergeFn)),
    shareReplay(1) // Share the result.
  );
}

/**
 * Combines the status of all loading states into a single {@link LoadingState}<boolean>.
 *
 * Only emits when the {@link LoadingStateType} of the result changes, or the loading state progress changes.
 * If any source has an error, the error is propagated. If any source is still loading, the result is loading.
 * When all sources are successful, the result value is `true`.
 *
 * @param sources - LoadingState observables whose statuses participate in the combined emission.
 * @returns An observable emitting a {@link LoadingState}<boolean> representing the combined status.
 *
 * @example
 * ```ts
 * const success$ = of(successResult(1));
 * const success2$ = of(successResult(2));
 *
 * // All success => emits { value: true }
 * const status$ = combineLoadingStatesStatus([success$, success2$]);
 *
 * // One loading => emits loading state
 * const loading$ = of(beginLoading());
 * const status$ = combineLoadingStatesStatus([loading$, success$]);
 * ```
 */
export function combineLoadingStatesStatus<A extends readonly LoadingState[]>(sources: readonly [...ObservableInputTuple<A>]): Observable<LoadingState<boolean>> {
  return combineLatest(sources).pipe(
    map((allLoadingStates) => {
      const firstErrorState = allLoadingStates.find((x) => x.error);
      let result: LoadingState<boolean>;

      if (firstErrorState) {
        result = errorResult(firstErrorState.error);
      } else {
        const oneOrMoreStatesAreCurrentlyLoading = allLoadingStates.some(isLoadingStateLoading);

        if (oneOrMoreStatesAreCurrentlyLoading) {
          result = beginLoading(); // still loading
        } else {
          result = successResult(true);
        }
      }

      return result;
    }),
    distinctUntilChanged((x, y) => loadingStateType(x) === loadingStateType(y) && x.loadingProgress === y.loadingProgress),
    shareReplay(1)
  );
}

/**
 * Merges `startWith()` with `beginLoading()` into a single typed operator.
 *
 * Preferred over using both individually, as typing information can get lost when chaining them separately.
 * An optional partial state can be provided to include additional metadata (e.g., page info) in the initial loading state.
 *
 * @param state - Optional partial loading state to include in the initial emission.
 * @returns A `MonoTypeOperatorFunction` that prepends a loading state to the observable.
 *
 * @example
 * ```ts
 * // Emit a loading state immediately before the source observable emits
 * readonly resultsState$ = this.fetchValues().pipe(
 *   map((values) => successResult(values)),
 *   startWithBeginLoading(),
 *   shareReplay(1)
 * );
 *
 * // Use inside a switchMap to re-emit loading on each new search
 * readonly searchResultsState$ = this.searchText$.pipe(
 *   switchMap((text) =>
 *     this.search(text).pipe(
 *       startWithBeginLoading()
 *     )
 *   ),
 *   shareReplay(1)
 * );
 * ```
 */
export function startWithBeginLoading<L extends LoadingState>(state?: Partial<NoInfer<L>>): MonoTypeOperatorFunction<L> {
  /**
   * `NoInfer` is required here: `Partial<L>` is a homomorphic mapped type and therefore an inference
   * source that outranks the contextual return type, so without it a `FilteredPage` argument would
   * reverse-infer `L := FilteredPage` instead of taking `L` from the stream being piped.
   */
  return startWith<L>(beginLoading(state) as unknown as L);
}

/**
 * Returns the current value from the {@link LoadingState}, including `undefined` when still loading or no value is set.
 *
 * Unlike {@link valueFromLoadingState}, this operator emits for every state change, regardless of whether the value is defined.
 *
 * @returns An `OperatorFunction` that maps each {@link LoadingState} to its current value (or undefined).
 *
 * @example
 * ```ts
 * // Expose the current (possibly undefined) value from a loading state
 * const currentValue$: Observable<Maybe<T>> = state$.pipe(
 *   currentValueFromLoadingState(),
 *   shareReplay(1)
 * );
 * ```
 */
export function currentValueFromLoadingState<T>(): OperatorFunction<LoadingState<T>, Maybe<T>> {
  return (obs: Observable<LoadingState<T>>) => {
    return obs.pipe(map((x) => x.value));
  };
}

/**
 * Returns the current non-null/non-undefined value from the {@link LoadingState}.
 *
 * Equivalent to piping {@link currentValueFromLoadingState} and `filterMaybeStrict()`.
 * Only emits when the value is defined, filtering out loading and error states without values.
 *
 * @returns An `OperatorFunction` that emits only defined values from the {@link LoadingState}.
 *
 * @example
 * ```ts
 * // Only emit when the loading state has a defined value
 * const value$ = state$.pipe(
 *   valueFromLoadingState(),
 *   // only emits non-null/non-undefined values
 * );
 * ```
 */
export function valueFromLoadingState<T>(): OperatorFunction<LoadingState<T>, MaybeSoStrict<T>> {
  return (obs: Observable<LoadingState<T>>) => {
    return obs.pipe(
      map((x) => x.value),
      filterMaybeStrict()
    );
  };
}

/**
 * Returns the error once the {@link LoadingState} has finished loading with an error.
 *
 * Filters to only emit when the state contains an error, then extracts and emits the {@link ReadableError}.
 *
 * @returns An `OperatorFunction` that emits the {@link ReadableError} from error states.
 *
 * @example
 * ```ts
 * // React to errors from a loading state
 * state$.pipe(
 *   errorFromLoadingState(),
 *   tap((error) => console.error('Loading failed:', error))
 * ).subscribe();
 * ```
 */
export function errorFromLoadingState(): OperatorFunction<LoadingState, ReadableError> {
  return (obs: Observable<LoadingState>) => {
    return obs.pipe(
      filter(isLoadingStateWithError),
      map((x) => x.error)
    );
  };
}

/**
 * Throws an error if the {@link LoadingState} value has an error.
 *
 * Passes through non-error states unchanged, but throws the error from any {@link LoadingStateWithError},
 * converting the loading state error into an observable error that can be caught with `catchError`.
 *
 * @returns An `OperatorFunction` that passes through non-error states and throws on error states.
 *
 * @example
 * ```ts
 * // Convert a LoadingState observable to a Promise, throwing on error states
 * const result = await firstValueFrom(
 *   loadingState$.pipe(
 *     throwErrorFromLoadingStateError(),
 *     valueFromFinishedLoadingState()
 *   )
 * );
 * ```
 */
export function throwErrorFromLoadingStateError<L extends LoadingState>(): MonoTypeOperatorFunction<L> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      map((x) => {
        if (isLoadingStateWithError(x)) {
          throw x.error;
        }

        return x;
      })
    );
  };
}

/**
 * Returns the value once the {@link LoadingState} has finished loading, even if an error occurred or there is no value.
 *
 * Filters to only emit when loading is complete, then maps to the value. A default value (or getter) can be
 * provided to use when the finished state has no value (e.g., due to an error).
 *
 * @example
 * ```ts
 * // Wait for loading to complete and emit the value
 * const value$ = state$.pipe(
 *   valueFromFinishedLoadingState(),
 *   shareReplay(1)
 * );
 *
 * // Provide a default value for error/empty states
 * const items$ = itemsState$.pipe(
 *   valueFromFinishedLoadingState(() => []),
 *   shareReplay(1)
 * );
 * ```
 *
 * @param defaultValue - Optional default value or getter to use when the finished state has no value.
 * @returns An `OperatorFunction` that emits the value (or default) once loading is finished.
 */
export function valueFromFinishedLoadingState<T>(defaultValue: GetterOrValue<NoInfer<T>>): OperatorFunction<LoadingState<T>, T>;
export function valueFromFinishedLoadingState<T>(defaultValue?: Maybe<GetterOrValue<NoInfer<T>>>): OperatorFunction<LoadingState<T>, Maybe<T>>;

export function valueFromFinishedLoadingState<T>(defaultValue?: Maybe<GetterOrValue<NoInfer<T>>>): OperatorFunction<LoadingState<T>, Maybe<T>> {
  // `NoInfer` on `defaultValue` is required: argument inference outranks the contextual return type,
  // so a `() => []` default would otherwise infer `T = never[]` and reject the real stream.
  return (obs: Observable<LoadingState<T>>) => {
    return obs.pipe(
      filter(isLoadingStateFinishedLoading),
      map((x) => x.value ?? getValueFromGetter(defaultValue))
    );
  };
}

/**
 * Executes a side-effect function when the piped {@link LoadingState} matches the given {@link LoadingStateType}.
 *
 * This is a tap-style operator that does not modify the stream, but calls `fn` when the state matches the specified type.
 *
 * @param fn - The side-effect function to call when the state matches.
 * @param type - The {@link LoadingStateType} to match against.
 * @returns A `MonoTypeOperatorFunction` that taps on matching states.
 *
 * @example
 * ```ts
 * // Log whenever the state transitions to an error
 * state$.pipe(
 *   tapOnLoadingStateType((state) => console.error('Error:', state.error), LoadingStateType.ERROR)
 * ).subscribe();
 *
 * // Trigger an action when loading begins
 * state$.pipe(
 *   tapOnLoadingStateType(() => showSpinner(), LoadingStateType.LOADING)
 * ).subscribe();
 * ```
 */
export function tapOnLoadingStateType<L extends LoadingState>(fn: (state: L) => void, type: LoadingStateType): MonoTypeOperatorFunction<L> {
  let decisionFunction: DecisionFunction<L>;

  if (type === LoadingStateType.LOADING) {
    decisionFunction = isLoadingStateLoading;
  } else {
    decisionFunction = (state) => loadingStateType(state) === type;
  }

  return tap((state: L) => {
    if (decisionFunction(state)) {
      fn(state);
    }
  });
}

/**
 * Executes a side-effect function when the input {@link LoadingState} has a successful value.
 *
 * This is a convenience wrapper around {@link tapOnLoadingStateType} with {@link LoadingStateType.SUCCESS}.
 *
 * @param fn - The side-effect function to call on success states.
 * @returns A `MonoTypeOperatorFunction` that taps on successful states.
 *
 * @example
 * ```ts
 * // Log the successful value
 * state$.pipe(
 *   tapOnLoadingStateSuccess((state) => console.log('Loaded:', state.value))
 * ).subscribe();
 * ```
 */
export function tapOnLoadingStateSuccess<L extends LoadingState>(fn: (state: L) => void): MonoTypeOperatorFunction<L> {
  return tapOnLoadingStateType(fn, LoadingStateType.SUCCESS);
}

/**
 * Convenience function for using {@link mapLoadingStateResults} with an Observable.
 *
 * Maps the value within a {@link LoadingState} using the provided configuration, preserving the loading/error state metadata.
 *
 * @param config - Configuration for mapping the loading state value.
 * @returns An `OperatorFunction` that maps the value within the loading state.
 *
 * @example
 * ```ts
 * // Map a SystemState<T> loading state to just its data property
 * readonly dataState$: Observable<LoadingState<T>> = this.systemStateLoadingState$.pipe(
 *   mapLoadingState({ mapValue: (x: SystemState<T>) => x.data }),
 *   shareReplay(1)
 * );
 * ```
 */
export function mapLoadingState<L extends LoadingState, B, O extends LoadingState = LoadingStateWithValueType<L, B>>(config: MapLoadingStateResultsConfiguration<L, B, O>): OperatorFunction<L, O> {
  return map((state: L) => mapLoadingStateResults<L, B, O>(state, config));
}

/**
 * Maps the value within a {@link LoadingState} using an arbitrary RxJS operator.
 *
 * When the state has a defined value, the value is extracted, passed through the provided operator,
 * and the result is wrapped back into the loading state. If the operator does not emit immediately,
 * a temporary loading state (with no value) is emitted while waiting.
 *
 * Error and loading states are passed through without invoking the operator.
 *
 * @param operator - The RxJS operator to apply to the loading state's value.
 * @param mapOnUndefined - If true, also applies the operator when the value is undefined (but loading is finished and no error).
 * @returns An `OperatorFunction` that transforms the value within the loading state.
 *
 * @example
 * ```ts
 * // Filter loading state values using a search string operator
 * readonly state$: Observable<ListLoadingState<DocValue>> = this._values.pipe(
 *   switchMap((x) => of(successResult(x)).pipe(startWithBeginLoading())),
 *   mapLoadingStateValueWithOperator(
 *     filterWithSearchString({
 *       filter: (a) => a.name,
 *       search$: this.search$
 *     })
 *   )
 * );
 *
 * // Transform values using switchMap inside the operator
 * readonly groupsState$ = this.itemsState$.pipe(
 *   mapLoadingStateValueWithOperator(
 *     switchMap((items) => this.viewDelegate$.pipe(
 *       switchMap((delegate) => asObservable(delegate.groupBy(items)))
 *     ))
 *   ),
 *   shareReplay(1)
 * );
 * ```
 */
export function mapLoadingStateValueWithOperator<L extends LoadingState, O>(operator: OperatorFunction<LoadingStateValue<L>, O>, mapOnUndefined = false): OperatorFunction<L, LoadingStateWithValueType<L, O>> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      switchMap((state: L) => {
        let mappedObs: Observable<LoadingStateWithValueType<L, O>>;

        if (isLoadingStateWithDefinedValue(state) || (mapOnUndefined && isLoadingStateFinishedLoading(state) && !isLoadingStateWithError(state))) {
          // map the value
          mappedObs = of(loadingStateValue(state) as LoadingStateValue<L>).pipe(
            operator,
            map((value) => loadingStateWithValueType<L, O>(state, value)),
            // if the operator does not return nearly instantly, then return the current state, minus a value
            timeoutStartWith(loadingStateWithValueType<L, O>({ ...state, loading: true }, undefined), 0)
          );
        } else {
          // only pass through if there is an error, otherwise show loading.
          if (isLoadingStateWithError(state)) {
            mappedObs = of(loadingStateWithValueType<L, O>(state, undefined));
          } else {
            // never pass through the non-mapped state's value as-is.
            mappedObs = of(loadingStateWithValueType<L, O>({ ...state, loading: true }, undefined));
          }
        }

        return mappedObs;
      })
    );
  };
}

/**
 * Catches a {@link LoadingStateWithError} and transforms it into a new {@link LoadingState} using the provided operator.
 *
 * Non-error states are passed through unchanged. When an error state is encountered, it is passed through the
 * operator to produce a replacement state. If the operator does not emit immediately, a temporary loading state is emitted.
 *
 * @param operator - The RxJS operator to apply to the error loading state.
 * @returns A `MonoTypeOperatorFunction` that catches and transforms error states.
 *
 * @example
 * ```ts
 * // On error, return an empty list instead of propagating the error
 * readonly notificationItemsLoadingState$ = this.store.notificationItemsLoadingState$.pipe(
 *   catchLoadingStateErrorWithOperator<LoadingState<NotificationItem<any>[]>>(
 *     map(() => successResult([]))
 *   )
 * );
 * ```
 */
export function catchLoadingStateErrorWithOperator<L extends LoadingState>(operator: OperatorFunction<NoInfer<L> & LoadingStateWithError, NoInfer<L>>): MonoTypeOperatorFunction<L> {
  // `NoInfer` is required: `operator` mentions `L` directly, and argument inference outranks the
  // contextual return type, so `map(() => successResult([]))` would otherwise infer
  // `L := LoadingStateWithValue<never[]>` and reject the stream it is piped into.
  return (obs: Observable<L>) => {
    return obs.pipe(
      switchMap((state: L) => {
        let mappedObs: Observable<L>;

        if (isLoadingStateWithError(state)) {
          // map the value using the error state
          mappedObs = of(state).pipe(
            operator,
            // if the operator does not return nearly instantly, then return the current state, minus a value
            timeoutStartWith(loadingStateWithValueType({ ...state, loading: true }, undefined) as unknown as L, 0)
          );
        } else {
          mappedObs = of(state);
        }

        return mappedObs;
      })
    );
  };
}

/**
 * Config for {@link distinctLoadingState}.
 */
export interface DistinctLoadingStateConfig<L extends LoadingState> {
  /**
   * Whether or not to pass the retained value when the next LoadingState's value (the value being considered by this DecisionFunction) is null/undefined.
   *
   * By default this uses a DecisionFunction that returns true on undefined and false on null.
   */
  readonly passRetainedValue?: (value: Maybe<LoadingStateValue<L>>, previousValue: Maybe<LoadingStateValue<L>>, state: L, previousState: Maybe<L>) => boolean; // eslint-disable-line @typescript-eslint/max-params
  /**
   * Whether or not to compare the
   */
  readonly compareOnUndefinedValue?: boolean;
  /**
   * Used for comparing the values of the LoadingState.
   */
  readonly valueComparator: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>>;
  /**
   * Used for comparing the metadata values of the LoadingState. By default uses isPageLoadingStateMetadataEqual.
   */
  readonly metadataComparator?: EqualityComparatorFunction<Maybe<Partial<PageLoadingState>>>;
}

/**
 * A special `distinctUntilChanged`-like operator for {@link LoadingState} and {@link PageLoadingState}.
 *
 * Retains the previous value and only emits when the value or loading state metadata actually changes,
 * as determined by the provided value comparator. This prevents unnecessary re-emissions when a loading
 * state re-emits with an equivalent value.
 *
 * Accepts either a simple {@link EqualityComparatorFunction} for comparing values, or a full
 * {@link DistinctLoadingStateConfig} for more fine-grained control over comparison behavior.
 *
 * @param config - Either a value comparator function or a full {@link DistinctLoadingStateConfig}.
 * @returns A `MonoTypeOperatorFunction` that filters out duplicate loading states.
 *
 * @example
 * ```ts
 * // Filter out duplicate loading states using key-based comparison
 * const distinct$ = values$.pipe(
 *   distinctLoadingState(objectKeysEqualityComparatorFunction((x) => x))
 * );
 *
 * // Full config with custom comparator
 * const distinct$ = values$.pipe(
 *   distinctLoadingState({
 *     valueComparator: (a, b) => a?.id === b?.id,
 *   })
 * );
 * ```
 */
export function distinctLoadingState<L extends LoadingState>(config: NoInfer<EqualityComparatorFunction<Maybe<LoadingStateValue<L>>> | DistinctLoadingStateConfig<L>>): MonoTypeOperatorFunction<L> {
  // `NoInfer` for the same reason as catchLoadingStateErrorWithOperator: the config mentions `L`.
  const { compareOnUndefinedValue, valueComparator, metadataComparator: inputMetadataComparator, passRetainedValue: inputPassRetainedValue } = typeof config === 'function' ? ({ valueComparator: config } as DistinctLoadingStateConfig<L>) : config;
  const passRetainedValue = inputPassRetainedValue ?? ((x) => x !== null);
  const metadataComparator = inputMetadataComparator ?? isPageLoadingStateMetadataEqual;

  interface DistinctLoadingStateScan<L extends LoadingState> {
    readonly isSameValue: boolean;
    readonly isSameLoadingStateMetadata: boolean;
    readonly value?: Maybe<LoadingStateValue<L>>;
    readonly current?: L;
    readonly previous?: L;
  }

  return (obs: Observable<L>) => {
    return obs.pipe(
      scan(
        (acc: DistinctLoadingStateScan<L>, state: L) => {
          const nextValue = loadingStateValue(state);

          // determine the value change
          let isSameValue = false;

          if (isLoadingStateWithDefinedValue(state) || (compareOnUndefinedValue && isLoadingStateFinishedLoading(state) && !isLoadingStateWithError(state))) {
            // if the value is the same, then
            isSameValue = valueComparator(nextValue, acc.value);
          } else if (passRetainedValue(nextValue, acc.value, state, acc.previous)) {
            isSameValue = true;
          }

          // determine the metadata changes
          const isSameLoadingStateMetadata = safeCompareEquality(state, acc.previous, metadataComparator);

          // pick the value
          const value: Maybe<LoadingStateValue<L>> = isSameValue ? acc.value : nextValue;

          const current: L = {
            ...state, // copy all metadata over
            value // set the new value
          };

          return {
            ...acc,
            value,
            isSameValue,
            isSameLoadingStateMetadata,
            previous: state,
            current
          };
        },
        {
          isSameValue: false,
          isSameLoadingStateMetadata: false
        }
      ),
      // only pipe through when the value is different or the loading state metadata is different
      filter((x) => !(x.isSameValue && x.isSameLoadingStateMetadata)),
      // pass the current state
      map((x) => x.current as L)
    );
  };
}

/**
 * Creates a Promise from an Observable of {@link LoadingState} that resolves when loading finishes.
 *
 * Waits for the first finished loading state, then resolves with the value. If the finished state
 * contains an error, the promise is rejected with that error.
 *
 * @param obs - The observable emitting {@link LoadingState} values.
 * @returns Resolves with the first finished value or rejects when the finished state carries an error.
 *
 * @example
 * ```ts
 * // Await a loading state observable as a promise
 * const value = await promiseFromLoadingState(dataState$);
 *
 * // Use within a work instance to forward errors
 * const result = await promiseFromLoadingState(
 *   loadingStateObs.pipe(
 *     filterMaybe(),
 *     tap(() => this._setWorking(true))
 *   )
 * ).catch((e) => {
 *   this.reject(e);
 *   throw e;
 * });
 * ```
 */
export function promiseFromLoadingState<T>(obs: Observable<LoadingState<T>>): Promise<T> {
  return firstValueFrom(obs.pipe(filter(isLoadingStateFinishedLoading))).then((x) => {
    let result: T;

    if (x.error) {
      throw x.error;
    } else {
      result = x.value as T;
    }

    return result;
  });
}
