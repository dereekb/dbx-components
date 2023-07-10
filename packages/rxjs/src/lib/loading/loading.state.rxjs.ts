import { DecisionFunction, Maybe, ReadableError, filterMaybeValues, takeFront } from '@dereekb/util';
import { MonoTypeOperatorFunction, OperatorFunction, startWith, Observable, filter, map, tap, catchError, combineLatest, distinctUntilChanged, first, of, shareReplay, switchMap, ObservableInputTuple, firstValueFrom } from 'rxjs';
import { timeoutStartWith } from '../rxjs';
import { successResult, LoadingState, PageLoadingState, beginLoading, loadingStateHasFinishedLoading, mergeLoadingStates, mapLoadingStateResults, MapLoadingStateResultsConfiguration, LoadingStateValue, loadingStateHasValue, LoadingStateType, loadingStateType, loadingStateIsLoading, loadingStateHasError, LoadingStateWithValueType, errorResult } from './loading.state';

// TODO: Fix all LoadingState types to use the LoadingStateValue inference

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
  const validArgs = filterMaybeValues(args); // filter out any undefined values
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
 * Combines the status of all loading states. Only emits when the LoadingStateType of the result changes.
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
        const oneOrMoreStatesAreCurrentlyLoading = allLoadingStates.findIndex(loadingStateIsLoading) !== -1;

        if (oneOrMoreStatesAreCurrentlyLoading) {
          result = beginLoading(); // still loading
        } else {
          result = successResult(true);
        }
      }

      return result;
    }),
    distinctUntilChanged((x, y) => loadingStateType(x) === loadingStateType(y)),
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
 * Returns the value once the LoadingState has finished loading with success.
 */
export function valueFromLoadingState<L extends LoadingState>(): OperatorFunction<L, LoadingStateValue<L>> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      filter(loadingStateHasValue),
      map((x) => x.value as LoadingStateValue<L>)
    );
  };
}

/**
 * Returns the error once the LoadingState has finished loading with an error.
 */
export function errorFromLoadingState<L extends LoadingState>(): OperatorFunction<L, ReadableError> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      filter(loadingStateHasError),
      map((x) => x.error as ReadableError)
    );
  };
}

/**
 * Returns the value once the LoadingState has finished loading, even if an error occured or there is no value.
 */
export function valueFromFinishedLoadingState<L extends LoadingState>(): OperatorFunction<L, Maybe<LoadingStateValue<L>>> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      filter(loadingStateHasFinishedLoading),
      map((x) => x.value as Maybe<LoadingStateValue<L>>)
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
    decisionFunction = loadingStateIsLoading;
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
 * Convenience function for mapping the loading state's value from one value to another using an arbitrary operator.
 */
export function mapLoadingStateValueWithOperator<L extends LoadingState, O>(operator: OperatorFunction<LoadingStateValue<L>, O>): OperatorFunction<L, LoadingStateWithValueType<L, O>>;
export function mapLoadingStateValueWithOperator<L extends PageLoadingState, O>(operator: OperatorFunction<LoadingStateValue<L>, O>): OperatorFunction<L, LoadingStateWithValueType<L, O>>;
export function mapLoadingStateValueWithOperator<L extends Partial<PageLoadingState>, O>(operator: OperatorFunction<LoadingStateValue<L>, O>): OperatorFunction<L, LoadingStateWithValueType<L, O>>;
export function mapLoadingStateValueWithOperator<L extends Partial<PageLoadingState>, O>(operator: OperatorFunction<LoadingStateValue<L>, O>): OperatorFunction<L, LoadingStateWithValueType<L, O>> {
  return (obs: Observable<L>) => {
    return obs.pipe(
      switchMap((state: L) => {
        let mappedObs: Observable<LoadingStateWithValueType<L, O>>;

        // TODO: if the value changes to loading but retains the same values, the loading state will simply be passed along with the mapped values.

        if (loadingStateHasValue(state)) {
          mappedObs = of(state.value).pipe(
            operator,
            map((value) => ({ ...state, value } as unknown as LoadingStateWithValueType<L, O>))
          );
        } else {
          mappedObs = of(state) as unknown as Observable<LoadingStateWithValueType<L, O>>;
        }

        return mappedObs;
      })
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
  return firstValueFrom(obs.pipe(filter(loadingStateHasFinishedLoading))).then((x) => {
    let result: T;

    if (x.error) {
      throw x.error;
    } else {
      result = x.value as T;
    }

    return result;
  });
}
