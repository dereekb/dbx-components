import { type DecisionFunction, type Maybe, type ReadableError, filterMaybeArrayValues, type EqualityComparatorFunction, safeCompareEquality, GetterOrValue, getValueFromGetter, MaybeSoStrict } from '@dereekb/util';
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
 * Wraps an observable output and maps the value to a LoadingState.
 *
 * If firstOnly is provided, it will only take the first value the observable returns.
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
 * Convenience function for creating a pipe that merges the multiple loading states into one.
 */
export function combineLoadingStates<A, B>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>): Observable<LoadingState<A & B>>;
export function combineLoadingStates<A extends object, B extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, mergeFn: (a: A, b: B) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<A extends object, B extends object, C extends object>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>): Observable<LoadingState<A & B & C>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, mergeFn: (a: A, b: B, c: C) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, obsD: Observable<LoadingState<D>>): Observable<LoadingState<A & B & C & D>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, obsD: Observable<LoadingState<D>>, mergeFn: (a: A, b: B, c: C, d: D) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object, E extends object>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, obsD: Observable<LoadingState<D>>, obsE: Observable<LoadingState<E>>): Observable<LoadingState<A & B & C & D & E>>;
export function combineLoadingStates<A extends object, B extends object, C extends object, D extends object, E extends object, O>(obsA: Observable<LoadingState<A>>, obsB: Observable<LoadingState<B>>, obsC: Observable<LoadingState<C>>, obsD: Observable<LoadingState<D>>, obsE: Observable<LoadingState<E>>, mergeFn: (a: A, b: B, c: C, d: D, e: E) => O): Observable<LoadingState<O>>;
export function combineLoadingStates<O>(...args: any[]): Observable<LoadingState<O>>;
export function combineLoadingStates<O>(...args: any[]): Observable<LoadingState<O>> {
  const validArgs = filterMaybeArrayValues(args); // filter out any undefined values
  const lastValueIsMergeFn = typeof validArgs[validArgs.length - 1] === 'function';
  const obsArgs: Observable<LoadingState<any>>[] = lastValueIsMergeFn ? validArgs.slice(0, validArgs.length - 1) : validArgs;
  const mergeFn = lastValueIsMergeFn ? validArgs[validArgs.length - 1] : undefined;

  return combineLatest(obsArgs).pipe(
    distinctUntilChanged((x, y) => {
      if (x && y) {
        const hasSameValues = x.findIndex((_, i) => x[i] !== y[i]) === -1;
        return hasSameValues;
      } else {
        return x === y;
      }
    }), // Prevent remerging the same values!
    map((states: LoadingState<any>[]) => {
      const result = mergeLoadingStates(...states, mergeFn) as LoadingState<O>;
      return result;
    }),
    shareReplay(1) // Share the result.
  );
}

/**
 * Combines the status of all loading states. Only emits when the LoadingStateType of the result changes, or the loading state progress.
 *
 * @param sources
 * @returns
 */
export function combineLoadingStatesStatus<A extends readonly LoadingState<any>[]>(sources: readonly [...ObservableInputTuple<A>]): Observable<LoadingState<boolean>> {
  return combineLatest(sources).pipe(
    map((allLoadingStates) => {
      const firstErrorState = allLoadingStates.find((x) => x.error);
      let result: LoadingState<boolean>;

      if (firstErrorState) {
        result = errorResult(firstErrorState.error);
      } else {
        const oneOrMoreStatesAreCurrentlyLoading = allLoadingStates.findIndex(isLoadingStateLoading) !== -1;

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
 * Merges startWith() with beginLoading().
 *
 * Preferred over using both individually, as typing information can get lost.
 *
 * @returns
 */
export function startWithBeginLoading<L extends LoadingState>(): MonoTypeOperatorFunction<L>;
export function startWithBeginLoading<L extends LoadingState>(state?: Partial<LoadingState>): MonoTypeOperatorFunction<L>;
export function startWithBeginLoading<L extends PageLoadingState>(state?: Partial<PageLoadingState>): MonoTypeOperatorFunction<L>;
export function startWithBeginLoading<L extends LoadingState>(state?: Partial<L>): MonoTypeOperatorFunction<L> {
  return startWith<L>(beginLoading(state) as unknown as L);
}

/**
 * Returns the current value from the LoadingState.
 */
export function currentValueFromLoadingState<L extends LoadingState>(): OperatorFunction<L, Maybe<LoadingStateValue<L>>> {
  return (obs: Observable<L>) => {
    return obs.pipe(map((x) => x.value as Maybe<LoadingStateValue<L>>));
  };
}

/**
 * Returns the current non-null value from the LoadingState.
 *
 * Equivalent to currentValueFromLoadingState() and filterMaybe().
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
 * Returns the error once the LoadingState has finished loading with an error.
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
 * Returns the value once the LoadingState has finished loading, even if an error occured or there is no value.
 *
 * Can optionally specify a default value to use instead.
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
 * Executes a function when the piped LoadingState has the configured state.
 *
 * @param fn
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
    if (state != null && decisionFunction(state)) {
      fn(state);
    }
  });
}

/**
 * Executes a function when the input state has a successful value.
 *
 * @param fn
 */
export function tapOnLoadingStateSuccess<L extends LoadingState>(fn: (state: L) => void): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateSuccess<L extends LoadingState>(fn: (state: L) => void): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateSuccess<L extends PageLoadingState>(fn: (state: L) => void): MonoTypeOperatorFunction<L>;
export function tapOnLoadingStateSuccess<L extends LoadingState>(fn: (state: L) => void): MonoTypeOperatorFunction<L> {
  return tapOnLoadingStateType(fn, LoadingStateType.SUCCESS);
}

/**
 * Convenience function for using mapLoadingStateResults with an Observable.
 */
export function mapLoadingState<A, B, L extends LoadingState<A> = LoadingState<A>, O extends LoadingState<B> = LoadingState<B>>(config: MapLoadingStateResultsConfiguration<A, B, L, O>): OperatorFunction<L, O>;
export function mapLoadingState<A, B, L extends PageLoadingState<A> = PageLoadingState<A>, O extends PageLoadingState<B> = PageLoadingState<B>>(config: MapLoadingStateResultsConfiguration<A, B, L, O>): OperatorFunction<L, O>;
export function mapLoadingState<A, B, L extends Partial<PageLoadingState<A>> = Partial<PageLoadingState<A>>, O extends Partial<PageLoadingState<B>> = Partial<PageLoadingState<B>>>(config: MapLoadingStateResultsConfiguration<A, B, L, O>): OperatorFunction<L, O>;
export function mapLoadingState<A, B, L extends Partial<PageLoadingState<A>> = Partial<PageLoadingState<A>>, O extends Partial<PageLoadingState<B>> = Partial<PageLoadingState<B>>>(config: MapLoadingStateResultsConfiguration<A, B, L, O>): OperatorFunction<L, O> {
  return map((state: L) => mapLoadingStateResults(state, config));
}

/**
 * Convenience function for catching the loading state's error from one value to another using an arbitrary operator.
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
 * Convenience function for catching an LoadingStateWithError and returning a new LoadingState.
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

export interface DistinctLoadingStateConfig<L extends LoadingState> {
  /**
   * Whether or not to pass the retained value when the next LoadingState's value (the value being considered by this DecisionFunction) is null/undefined.
   *
   * By default this uses a DecisionFunction that returns true on undefined and false on null.
   */
  passRetainedValue?: (value: Maybe<LoadingStateValue<L>>, previousValue: Maybe<LoadingStateValue<L>>, state: L, previousState: Maybe<L>) => boolean;
  /**
   * Whether or not to compare the
   */
  compareOnUndefinedValue?: boolean;
  /**
   * Used for comparing the values of the LoadingState.
   */
  valueComparator: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>>;
  /**
   * Used for comparing the metadata values of the LoadingState. By default uses isPageLoadingStateMetadataEqual.
   */
  metadataComparator?: EqualityComparatorFunction<Maybe<Partial<L>>>;
}

interface DistinctLoadingStateScan<L extends LoadingState> {
  readonly isSameValue: boolean;
  readonly isSameLoadingStateMetadata: boolean;
  readonly value?: Maybe<LoadingStateValue<L>>;
  readonly current?: L;
  readonly previous?: L;
}

/**
 * A special distinctUntilChanged-like operator for LoadingState and PageLoadingState.
 *
 * It saves the previous value and passes it through whenever the LoadingState changes.
 *
 * @param operator
 * @param mapOnUndefined
 * @returns
 */
export function distinctLoadingState<L extends LoadingState>(config: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>> | DistinctLoadingStateConfig<L>): MonoTypeOperatorFunction<L>;
export function distinctLoadingState<L extends PageLoadingState>(config: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>> | DistinctLoadingStateConfig<L>): MonoTypeOperatorFunction<L>;
export function distinctLoadingState<L extends Partial<PageLoadingState>>(config: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>> | DistinctLoadingStateConfig<L>): MonoTypeOperatorFunction<L>;
export function distinctLoadingState<L extends Partial<PageLoadingState>>(inputConfig: EqualityComparatorFunction<Maybe<LoadingStateValue<L>>> | DistinctLoadingStateConfig<L>): MonoTypeOperatorFunction<L> {
  const { compareOnUndefinedValue, valueComparator, metadataComparator: inputMetadataComparator, passRetainedValue: inputPassRetainedValue } = typeof inputConfig === 'function' ? ({ valueComparator: inputConfig } as DistinctLoadingStateConfig<L>) : inputConfig;
  const passRetainedValue = inputPassRetainedValue ?? ((x) => x !== null);
  const metadataComparator = inputMetadataComparator ?? (isPageLoadingStateMetadataEqual as EqualityComparatorFunction<Maybe<Partial<L>>>);

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
 * Creates a promise from a Observable that pipes loading states that resolves the value when the loading state has finished loading.
 *
 * If the loading state returns an error, the error is thrown.
 *
 * @param obs
 * @returns
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
