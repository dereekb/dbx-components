import { type DecisionFunction, type Maybe, type ReadableError, filterMaybeArrayValues, type EqualityComparatorFunction, safeCompareEquality, type GetterOrValue, getValueFromGetter, type MaybeSoStrict } from '@dereekb/util';
import { type MonoTypeOperatorFunction, type OperatorFunction, startWith, type Observable, filter, map, tap, catchError, combineLatest, distinctUntilChanged, first, of, shareReplay, switchMap, type ObservableInputTuple, firstValueFrom, scan } from 'rxjs';
import { timeoutStartWith } from '../rxjs/timeout';
import {
  successResult,
  type LoadingState,
  type PageLoadingState,
  beginLoading,
  isLoadingStateFinishedLoading,
  mergeLoadingStates,
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
  type LoadingStateWithDefinedValue,
  isPageLoadingStateMetadataEqual,
  type LoadingStateWithError
} from './loading.state';
import { filterMaybeStrict } from '../rxjs/value';

// TODO(BREAKING_CHANGE): Fix all LoadingState types to use the LoadingStateValue inference typings

/**
 * Wraps an observable output and maps the value to a {@link LoadingState}.
 *
 * Emits a loading state immediately, then emits a success result when the observable emits a value,
 * or an error result if the observable errors.
 *
 * If firstOnly is provided, it will only take the first value the observable returns.
 *
 * @example
 * ```ts
 * // Wrap a data fetch observable into a LoadingState
 * readonly jsonContentState$ = loadingStateFromObs(this.jsonContent$);
 *
 * // Wrap an observable and only take the first emitted value
 * readonly singleValueState$ = loadingStateFromObs(this.data$, true);
 * ```
 *
 * @param obs - The source observable to wrap.
 * @param firstOnly - If true, only takes the first value from the observable.
 * @returns An observable that emits {@link LoadingState} values representing the loading lifecycle.
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
export function combineLoadingStates<A, B>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>): Observable<LoadingState<A & B>>;
export function combineLoadingStates<A extends object, B extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, mergeFn: (a: A, b: B) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<A extends object, B extends object, C extends object>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>): Observable<LoadingState<A & B & C>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, mergeFn: (a: A, b: B, c: C) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, obsD: Observable<LoadingState<D>>): Observable<LoadingState<A & B & C & D>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, obsD: Observable<LoadingState<D>>, mergeFn: (a: A, b: B, c: C, d: D) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object, E extends object>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, obsD: Observable<LoadingState<D>>, obsE: Observable<LoadingState<E>>): Observable<LoadingState<A & B & C & D & E>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object, E extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, obsD: Observable<LoadingState<D>>, obsE: Observable<LoadingState<E>>, mergeFn: (a: A, b: B, c: C, d: D, e: E) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<O>(...args: any[]): Observable<LoadingState<O>>;
// eslint-disable-next-line jsdoc/require-jsdoc -- JSDoc is on the overload signatures above
export function combineLoadingStates<O>(...args: any[]): Observable<LoadingState<O>> {
  /* eslint-enable @typescript-eslint/max-params */
  const validArgs = filterMaybeArrayValues(args); // filter out any undefined values
  const lastValueIsMergeFn = typeof validArgs[validArgs.length - 1] === 'function';
  const obsArgs: Observable<LoadingState<any>>[] = lastValueIsMergeFn ? validArgs.slice(0, validArgs.length - 1) : validArgs;
  const mergeFn = lastValueIsMergeFn ? validArgs[validArgs.length - 1] : undefined;

  return combineLatest(obsArgs).pipe(
    distinctUntilChanged((x, y) => {
      return !x.some((_, i) => x[i] !== y[i]);
    }), // Prevent remerging the same values!
    map((states: LoadingState<any>[]) => {
      return mergeLoadingStates(...states, mergeFn) as LoadingState<O>;
    }),
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
 *
 * @param sources - An array of LoadingState observables to combine.
 * @returns An observable emitting a {@link LoadingState}<boolean> representing the combined status.
 */
export function combineLoadingStatesStatus<A extends readonly LoadingState<any>[]>(sources: readonly [...ObservableInputTuple<A>]): Observable<LoadingState<boolean>> {
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
 *
 * @param state - Optional partial loading state to include in the initial emission.
 * @returns A `MonoTypeOperatorFunction` that prepends a loading state to the observable.
 */
export function startWithBeginLoading<L extends LoadingState>(): MonoTypeOperatorFunction<L>;
export function startWithBeginLoading<L extends LoadingState>(state?: Partial<LoadingState>): MonoTypeOperatorFunction<L>;
export function startWithBeginLoading<L extends PageLoadingState>(state?: Partial<PageLoadingState>): MonoTypeOperatorFunction<L>;
export function startWithBeginLoading<L extends LoadingState>(state?: Partial<L>): MonoTypeOperatorFunction<L> {
  return startWith<L>(beginLoading(state) as unknown as L);
}

/**
 * Returns the current value from the {@link LoadingState}, including `undefined` when still loading or no value is set.
 *
 * Unlike {@link valueFromLoadingState}, this operator emits for every state change, regardless of whether the value is defined.
 *
 * @example
 * ```ts
 * // Expose the current (possibly undefined) value from a loading state
 * const currentValue$: Observable<Maybe<T>> = state$.pipe(
 *   currentValueFromLoadingState(),
 *   shareReplay(1)
 * );
 * ```
 *
 * @returns An `OperatorFunction` that maps each {@link LoadingState} to its current value (or undefined).
 */
export function currentValueFromLoadingState<L extends LoadingState>(): OperatorFunction<L, Maybe<LoadingStateValue<L>>> {
  return (obs: Observable<L>) => {
    return obs.pipe(map((x) => x.value as Maybe<LoadingStateValue<L>>));
  };
}

/**
 * Returns the current non-null/non-undefined value from the {@link LoadingState}.
 *
 * Equivalent to piping {@link currentValueFromLoadingState} and `filterMaybeStrict()`.
 * Only emits when the value is defined, filtering out loading and error states without values.
 *
 * @example
 * ```ts
 * // Only emit when the loading state has a defined value
 * const value$ = state$.pipe(
 *   valueFromLoadingState(),
 *   // only emits non-null/non-undefined values
 * );
 * ```
 *
 * @returns An `OperatorFunction` that emits only defined values from the {@link LoadingState}.
 */
export function valueFromLoadingState<L extends LoadingStateWithDefinedValue>(): OperatorFunction<L, MaybeSoStrict<LoadingStateValue<L>>> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      map((x) => x.value as LoadingStateValue<L>),
      filterMaybeStrict()
    );
  };
}

/**
 * Returns the error once the {@link LoadingState} has finished loading with an error.
 *
 * Filters to only emit when the state contains an error, then extracts and emits the {@link ReadableError}.
 *
 * @example
 * ```ts
 * // React to errors from a loading state
 * state$.pipe(
 *   errorFromLoadingState(),
 *   tap((error) => console.error('Loading failed:', error))
 * ).subscribe();
 * ```
 *
 * @returns An `OperatorFunction` that emits the {@link ReadableError} from error states.
 */
export function errorFromLoadingState<L extends LoadingState>(): OperatorFunction<L, ReadableError> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      filter(isLoadingStateWithError),
      map((x) => x.error as ReadableError)
    );
  };
}

/**
 * Throws an error if the {@link LoadingState} value has an error.
 *
 * Passes through non-error states unchanged, but throws the error from any {@link LoadingStateWithError},
 * converting the loading state error into an observable error that can be caught with `catchError`.
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
 *
 * @returns An `OperatorFunction` that passes through non-error states and throws on error states.
 */
export function throwErrorFromLoadingStateError<L extends LoadingState>(): OperatorFunction<L, L> {
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
export function valueFromFinishedLoadingState<L extends LoadingState>(defaultValue: GetterOrValue<LoadingStateValue<L>>): OperatorFunction<L, LoadingStateValue<L>>;
export function valueFromFinishedLoadingState<L extends LoadingState>(defaultValue?: Maybe<GetterOrValue<LoadingStateValue<L>>>): OperatorFunction<L, Maybe<LoadingStateValue<L>>>;
export function valueFromFinishedLoadingState<L extends LoadingStateWithDefinedValue>(): OperatorFunction<L, LoadingStateValue<L>>;
export function valueFromFinishedLoadingState<L extends LoadingState>(defaultValue?: Maybe<GetterOrValue<LoadingStateValue<L>>>): OperatorFunction<L, Maybe<LoadingStateValue<L>>> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      filter(isLoadingStateFinishedLoading),
      map((x) => (x.value as Maybe<LoadingStateValue<L>>) ?? getValueFromGetter(defaultValue))
    );
  };
}

/**
 * Executes a side-effect function when the piped {@link LoadingState} matches the given {@link LoadingStateType}.
 *
 * This is a tap-style operator that does not modify the stream, but calls `fn` when the state matches the specified type.
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
 *
 * @param fn - The side-effect function to call when the state matches.
 * @param type - The {@link LoadingStateType} to match against.
 * @returns A `MonoTypeOperatorFunction` that taps on matching states.
 */
export function tapOnLoadingStateType<L extends LoadingState>(fn: (state: L) => void, type: LoadingStateType): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateType<L extends LoadingState>(fn: (state: L) => void, type: LoadingStateType): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateType<L extends PageLoadingState>(fn: (state: L) => void, type: LoadingStateType): MonoTypeOperatorFunction<L>;
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
 * @example
 * ```ts
 * // Log the successful value
 * state$.pipe(
 *   tapOnLoadingStateSuccess((state) => console.log('Loaded:', state.value))
 * ).subscribe();
 * ```
 *
 * @param fn - The side-effect function to call on success states.
 * @returns A `MonoTypeOperatorFunction` that taps on successful states.
 */
export function tapOnLoadingStateSuccess<L extends LoadingState>(fn: (state: L) => void): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateSuccess<L extends LoadingState>(fn: (state: L) => void): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateSuccess<L extends PageLoadingState>(fn: (state: L) => void): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateSuccess<L extends LoadingState>(fn: (state: L) => void): MonoTypeOperatorFunction<L> {
  return tapOnLoadingStateType(fn, LoadingStateType.SUCCESS);
}

/**
 * Convenience function for using {@link mapLoadingStateResults} with an Observable.
 *
 * Maps the value within a {@link LoadingState} using the provided configuration, preserving the loading/error state metadata.
 *
 * @example
 * ```ts
 * // Map a SystemState<T> loading state to just its data property
 * readonly dataState$: Observable<LoadingState<T>> = this.systemStateLoadingState$.pipe(
 *   mapLoadingState({ mapValue: (x: SystemState<T>) => x.data }),
 *   shareReplay(1)
 * );
 * ```
 *
 * @param config - Configuration for mapping the loading state value.
 * @returns An `OperatorFunction` that maps the value within the loading state.
 */
export function mapLoadingState<A, B, L extends LoadingState<A> = LoadingState<A>, O extends LoadingState<B> = LoadingState<B>>(config: MapLoadingStateResultsConfiguration<A, B, L, O>): OperatorFunction<L, O>;
export function mapLoadingState<A, B, L extends PageLoadingState<A> = PageLoadingState<A>, O extends PageLoadingState<B> = PageLoadingState<B>>(config: MapLoadingStateResultsConfiguration<A, B, L, O>): OperatorFunction<L, O>;
export function mapLoadingState<A, B, L extends Partial<PageLoadingState<A>> = Partial<PageLoadingState<A>>, O extends Partial<PageLoadingState<B>> = Partial<PageLoadingState<B>>>(config: MapLoadingStateResultsConfiguration<A, B, L, O>): OperatorFunction<L, O>;
export function mapLoadingState<A, B, L extends Partial<PageLoadingState<A>> = Partial<PageLoadingState<A>>, O extends Partial<PageLoadingState<B>> = Partial<PageLoadingState<B>>>(config: MapLoadingStateResultsConfiguration<A, B, L, O>): OperatorFunction<L, O> {
  return map((state: L) => mapLoadingStateResults(state, config));
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
 *
 * @param operator - The RxJS operator to apply to the loading state's value.
 * @param mapOnUndefined - If true, also applies the operator when the value is undefined (but loading is finished and no error).
 * @returns An `OperatorFunction` that transforms the value within the loading state.
 */
export function mapLoadingStateValueWithOperator<L extends LoadingState, O>(operator: OperatorFunction<LoadingStateValue<L>, O>, mapOnUndefined?: boolean): OperatorFunction<L, LoadingStateWithValueType<L, O>>;
export function mapLoadingStateValueWithOperator<L extends PageLoadingState, O>(operator: OperatorFunction<LoadingStateValue<L>, O>, mapOnUndefined?: boolean): OperatorFunction<L, LoadingStateWithValueType<L, O>>;
export function mapLoadingStateValueWithOperator<L extends Partial<PageLoadingState>, O>(operator: OperatorFunction<LoadingStateValue<L>, O>, mapOnUndefined?: boolean): OperatorFunction<L, LoadingStateWithValueType<L, O>>;
export function mapLoadingStateValueWithOperator<L extends Partial<PageLoadingState>, O>(operator: OperatorFunction<LoadingStateValue<L>, O>, mapOnUndefined = false): OperatorFunction<L, LoadingStateWithValueType<L, O>> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      switchMap((state: L) => {
        let mappedObs: Observable<LoadingStateWithValueType<L, O>>;

        if (isLoadingStateWithDefinedValue(state) || (mapOnUndefined && isLoadingStateFinishedLoading(state) && !isLoadingStateWithError(state))) {
          // map the value
          mappedObs = of((state as LoadingStateWithDefinedValue<LoadingStateValue<L>>).value).pipe(
            operator,
            map((value) => ({ ...state, value }) as unknown as LoadingStateWithValueType<L, O>),
            // if the operator does not return nearly instantly, then return the current state, minus a value
            timeoutStartWith({ ...state, loading: true, value: undefined } as unknown as LoadingStateWithValueType<L, O>, 0)
          );
        } else {
          // only pass through if there is an error, otherwise show loading.
          if (isLoadingStateWithError(state)) {
            mappedObs = of({ ...state, value: undefined }) as unknown as Observable<LoadingStateWithValueType<L, O>>;
          } else {
            // never pass through the non-mapped state's value as-is.
            mappedObs = of({ ...state, loading: true, value: undefined }) as unknown as Observable<LoadingStateWithValueType<L, O>>;
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
 * @example
 * ```ts
 * // On error, return an empty list instead of propagating the error
 * readonly notificationItemsLoadingState$ = this.store.notificationItemsLoadingState$.pipe(
 *   catchLoadingStateErrorWithOperator<LoadingState<NotificationItem<any>[]>>(
 *     map(() => successResult([]))
 *   )
 * );
 * ```
 *
 * @param operator - The RxJS operator to apply to the error loading state.
 * @returns A `MonoTypeOperatorFunction` that catches and transforms error states.
 */
export function catchLoadingStateErrorWithOperator<L extends LoadingState>(operator: OperatorFunction<L & LoadingStateWithError, L>): MonoTypeOperatorFunction<L>;
export function catchLoadingStateErrorWithOperator<L extends PageLoadingState>(operator: OperatorFunction<L & LoadingStateWithError, L>): MonoTypeOperatorFunction<L>;
export function catchLoadingStateErrorWithOperator<L extends Partial<PageLoadingState>>(operator: OperatorFunction<L & LoadingStateWithError, L>): MonoTypeOperatorFunction<L>;
export function catchLoadingStateErrorWithOperator<L extends Partial<PageLoadingState>>(operator: OperatorFunction<L & LoadingStateWithError, L>): MonoTypeOperatorFunction<L> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      switchMap((state: L) => {
        let mappedObs: Observable<L>;

        if (isLoadingStateWithError(state)) {
          // map the value using the error state
          mappedObs = of(state as L & LoadingStateWithError).pipe(
            operator,
            // if the operator does not return nearly instantly, then return the current state, minus a value
            timeoutStartWith({ ...state, loading: true, value: undefined } as unknown as L, 0)
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
  readonly metadataComparator?: EqualityComparatorFunction<Maybe<Partial<L>>>;
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
 *
 * @param config - Either a value comparator function or a full {@link DistinctLoadingStateConfig}.
 * @returns A `MonoTypeOperatorFunction` that filters out duplicate loading states.
 */
export function distinctLoadingState<L extends LoadingState>(config: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>> | DistinctLoadingStateConfig<L>): MonoTypeOperatorFunction<L>;
export function distinctLoadingState<L extends PageLoadingState>(config: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>> | DistinctLoadingStateConfig<L>): MonoTypeOperatorFunction<L>;
export function distinctLoadingState<L extends Partial<PageLoadingState>>(config: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>> | DistinctLoadingStateConfig<L>): MonoTypeOperatorFunction<L>;
export function distinctLoadingState<L extends Partial<PageLoadingState>>(inputConfig: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>> | DistinctLoadingStateConfig<L>): MonoTypeOperatorFunction<L> {
  const { compareOnUndefinedValue, valueComparator, metadataComparator: inputMetadataComparator, passRetainedValue: inputPassRetainedValue } = typeof inputConfig === 'function' ? ({ valueComparator: inputConfig } as DistinctLoadingStateConfig<L>) : inputConfig;
  const passRetainedValue = inputPassRetainedValue ?? ((x) => x !== null);
  const metadataComparator = inputMetadataComparator ?? (isPageLoadingStateMetadataEqual as EqualityComparatorFunction<Maybe<Partial<L>>>);

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
          const nextValue = state.value as Maybe<LoadingStateValue<L>>;

          // determine the value change
          let isSameValue = false;

          if (isLoadingStateWithDefinedValue(state) || (compareOnUndefinedValue && isLoadingStateFinishedLoading(state) && !isLoadingStateWithError(state))) {
            // if the value is the same, then
            isSameValue = valueComparator(nextValue, acc.value);
          } else if (passRetainedValue(nextValue as Maybe<LoadingStateValue<L>>, acc.value, state, acc.previous)) {
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
 *
 * @param obs - The observable emitting {@link LoadingState} values.
 * @returns A Promise that resolves with the value or rejects with the error.
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
