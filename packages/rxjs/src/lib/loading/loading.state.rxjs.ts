import { DecisionFunction, Maybe, ReadableError } from '@dereekb/util';
import { MonoTypeOperatorFunction, OperatorFunction, startWith, Observable, filter, map, tap, catchError, combineLatest, distinctUntilChanged, first, of, shareReplay, switchMap, exhaustMap } from 'rxjs';
import { timeoutStartWith } from '../rxjs';
import { LoadingState, PageLoadingState, beginLoading, loadingStateHasFinishedLoading, mergeLoadingStates, mapLoadingStateResults, MapLoadingStateResultsConfiguration, LoadingStateValue, loadingStateHasValue, LoadingStateType, loadingStateType, loadingStateIsLoading, loadingStateHasError, LoadingStateWithValueType } from './loading.state';

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
