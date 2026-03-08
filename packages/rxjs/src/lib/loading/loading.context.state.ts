import { type Maybe, type Destroyable, hasNonNullValue } from '@dereekb/util';
import { map, switchMap, shareReplay, distinctUntilChanged, BehaviorSubject, isObservable, type Observable, of } from 'rxjs';
import { timeoutStartWith } from '../rxjs/timeout';
import { filterMaybe } from '../rxjs/value';
import { type LoadingStateContextEvent, type LoadingContext, type LoadingContextEvent } from './loading.context';
import { beginLoading, isLoadingStateEqual, isLoadingStateLoading, type LoadingState } from './loading.state';
import { valueFromFinishedLoadingState, currentValueFromLoadingState } from './loading.state.rxjs';

// MARK: New
/**
 * A LoadingContext that provides several accessors to a LoadingState<T> and corresponding LoadingContextEvent
 */
export interface LoadingStateContext<T = unknown, S extends LoadingState<T> = LoadingState<T>, E extends LoadingContextEvent = LoadingContextEvent & S> extends LoadingContext<E> {
  /**
   * The current observable stream of the state observable.
   */
  readonly currentStateStream$: Observable<Maybe<Observable<Maybe<S>>>>;

  /**
   * The latest non-null observable stream of the state observable.
   */
  readonly stateStream$: Observable<Observable<Maybe<S>>>;

  /**
   * Current state.
   */
  readonly currentState$: Observable<Maybe<S>>;

  /**
   * Latest non-null state.
   */
  readonly state$: Observable<S>;

  /**
   * Observable for the current loading state from the event stream.
   */
  readonly loading$: Observable<boolean>;

  /**
   * The current value. Always provided, even while loading.
   */
  readonly currentValue$: Observable<Maybe<T>>;

  /**
   * The latest value from the most recent loaded state.
   */
  readonly valueAfterLoaded$: Observable<Maybe<T>>;

  /**
   * The latest non-null value from valueAfterLoaded$.
   */
  readonly value$: Observable<T>;
}

/**
 * A LoadingStateContext that can be updated and destroyed.
 */
export interface MutableLoadingStateContext<T = unknown, S extends LoadingState<T> = LoadingState<T>, E extends LoadingStateContextEvent = LoadingContextEvent & S> extends LoadingStateContext<T, S, E>, Destroyable {
  /**
   * Sets a new state observable.
   *
   * @param obs Observable
   */
  setStateObs(obs: Maybe<Observable<Maybe<S>>>): void;
}

/**
 * Configuration for loadingStateContext().
 */
export interface LoadingStateContextConfig<T = unknown, S extends LoadingState<T> = LoadingState<T>, E extends LoadingStateContextEvent = LoadingContextEvent & S> {
  /**
   * The initial observable.
   */
  readonly obs?: Maybe<Observable<Maybe<S>>>;
  /**
   * Whether or not to show loading if finished loading and the value is undefined.
   *
   * Defaults to false.
   */
  readonly showLoadingOnUndefinedValue?: Maybe<boolean>;
  /**
   * Optional function to generate a LoadingContextEvent from a LoadingState and this config.
   *
   * @param state the current state
   * @param config this config
   * @returns the event to emit
   */
  readonly loadingEventForLoadingPair?: Maybe<(state: S, config: LoadingEventForLoadingPairConfigInput) => E>;
}

export type LoadingEventForLoadingPairConfigInput = Pick<LoadingStateContextConfig, 'showLoadingOnUndefinedValue'>;

/**
 * Default function for converting a {@link LoadingState} into a {@link LoadingStateContextEvent}.
 *
 * Determines the `loading` flag based on whether an error is present, whether the value is defined,
 * and the `showLoadingOnUndefinedValue` setting. Loading progress is only included while loading.
 */
export const DEFAULT_LOADING_EVENT_FOR_LOADING_PAIR_FUNCTION = <T = unknown, S extends LoadingState<T> = LoadingState<T>, E extends LoadingStateContextEvent = LoadingContextEvent & S>(state: S, input: LoadingEventForLoadingPairConfigInput): LoadingStateContextEvent<T> => {
  const { showLoadingOnUndefinedValue } = input;
  const { error, value, loadingProgress } = state;
  let loading: boolean = false;

  if (!hasNonNullValue(error)) {
    if (showLoadingOnUndefinedValue) {
      loading = !hasNonNullValue(value);
    } else {
      loading = isLoadingStateLoading(state);
    }
  }

  return {
    loading,
    loadingProgress: loading ? loadingProgress : undefined,
    error,
    value
  };
};
/**
 * Input for loadingStateContext()
 */
export type LoadingStateContextInput<T = unknown, S extends LoadingState<T> = LoadingState<T>, E extends LoadingStateContextEvent = LoadingContextEvent & S> = LoadingStateContextConfig<T, S, E> | LoadingStateContextConfig<T, S, E>['obs'];

/**
 * Creates a new {@link MutableLoadingStateContext} that wraps an observable of {@link LoadingState} values
 * and exposes reactive accessors for the loading flag, current value, errors, and state stream.
 *
 * Accepts either a raw observable or a {@link LoadingStateContextConfig} for fine-grained control
 * over how loading events are derived from the state.
 *
 * @example
 * ```ts
 * // Create a context from a state observable
 * const context = loadingStateContext(myLoadingState$);
 *
 * // Subscribe to the loading flag
 * context.loading$.subscribe((loading) => console.log('Loading:', loading));
 *
 * // Access the value after loading completes
 * context.value$.subscribe((value) => console.log('Value:', value));
 *
 * // Update the state observable later
 * context.setStateObs(newLoadingState$);
 *
 * // Clean up
 * context.destroy();
 * ```
 *
 * @param input - optional observable or config to initialize the context
 * @returns a mutable loading state context with reactive accessors
 */
export function loadingStateContext<T = unknown, S extends LoadingState<T> = LoadingState<T>, E extends LoadingStateContextEvent = LoadingContextEvent & S>(input?: LoadingStateContextInput<T, S, E>): MutableLoadingStateContext<T, S, E> {
  const _config: Maybe<LoadingStateContextConfig<T, S, E>> = input && isObservable(input) ? { obs: input } : input;
  const loadingEventForLoadingPair = _config?.loadingEventForLoadingPair ?? DEFAULT_LOADING_EVENT_FOR_LOADING_PAIR_FUNCTION;
  const showLoadingOnUndefinedValue = _config?.showLoadingOnUndefinedValue ?? false;

  const _stateStream = new BehaviorSubject<Maybe<Observable<Maybe<S>>>>(_config?.obs);

  const currentStateStream$: Observable<Maybe<Observable<Maybe<S>>>> = _stateStream.asObservable();
  const stateStream$: Observable<Observable<Maybe<S>>> = currentStateStream$.pipe(filterMaybe());

  const eventStream$: Observable<E> = currentStateStream$.pipe(
    switchMap((obs) => {
      let result: Observable<E>;

      if (obs) {
        result = obs.pipe(
          filterMaybe(),
          // If the observable did not pass a value immediately, we start with the start value.
          timeoutStartWith(beginLoading() as S),
          map((x) => loadingEventForLoadingPair(x, { showLoadingOnUndefinedValue }))
        ) as Observable<E>;
      } else {
        result = of(beginLoading() as E);
      }

      return result;
    }),
    distinctUntilChanged(isLoadingStateEqual),
    shareReplay(1)
  );

  const currentState$: Observable<Maybe<S>> = currentStateStream$.pipe(switchMap((x) => (x ? x : of(undefined))));
  const state$: Observable<S> = currentState$.pipe(filterMaybe(), shareReplay(1));

  const loading$: Observable<boolean> = eventStream$.pipe(map(isLoadingStateLoading));

  const currentValue$: Observable<Maybe<T>> = state$.pipe(currentValueFromLoadingState(), shareReplay(1));
  const valueAfterLoaded$: Observable<Maybe<T>> = state$.pipe(valueFromFinishedLoadingState(), shareReplay(1));
  const value$: Observable<T> = valueAfterLoaded$.pipe(filterMaybe(), shareReplay(1));

  function setStateObs(obs: Maybe<Observable<Maybe<S>>>) {
    _stateStream.next(obs);
  }

  function destroy() {
    _stateStream.complete();
  }

  const loadingStateContext: MutableLoadingStateContext<T, S, E> = {
    currentStateStream$,
    stateStream$,
    stream$: eventStream$,
    currentState$,
    state$,
    loading$,
    currentValue$,
    valueAfterLoaded$,
    value$,
    setStateObs,
    destroy
  };

  return loadingStateContext;
}
