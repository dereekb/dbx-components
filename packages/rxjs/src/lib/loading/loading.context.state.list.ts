import { type LimitArrayConfig, hasNonNullValue, limitArray, type Maybe, Configurable } from '@dereekb/util';
import { type Observable, distinctUntilChanged, map, shareReplay, skipWhile } from 'rxjs';
import { isLoadingStateLoading, type ListLoadingState } from './loading.state';
import { DEFAULT_LOADING_EVENT_FOR_LOADING_PAIR_FUNCTION, type LoadingEventForLoadingPairConfigInput, loadingStateContext, LoadingStateContext, LoadingStateContextConfig, LoadingStateContextInput, MutableLoadingStateContext } from './loading.context.state';
import { mapIsListLoadingStateWithEmptyValue, isListLoadingStateWithEmptyValue } from './loading.state.list';
import { LoadingContextEvent, LoadingStateContextEvent } from './loading.context';

export interface ListLoadingStateContext<L = unknown, S extends ListLoadingState<L> = ListLoadingState<L>> extends Omit<LoadingStateContext<L[], S>, 'value$' | 'currentValue$' | 'valueAfterLoaded$'> {
  /**
   * The current list. Always provided, even while loading.
   */
  readonly currentList$: Observable<Maybe<L[]>>;
  /**
   * The latest list from the most recent loaded state.
   */
  readonly listAfterLoaded$: Observable<Maybe<L[]>>;
  /**
   * The latest list from listAfterLoaded$, or a default value if the list was empty.
   */
  readonly list$: Observable<L[]>;
  /**
   * Whether or not the currentList$ value is empty.
   *
   * Only resolves after the first non-loading event has occured.
   *
   * After that, will return true if the value is empty even if loading a new value.
   */
  readonly isEmpty$: Observable<boolean>;
  /**
   * Returns true while loading and the current value is considered empty.
   */
  readonly isEmptyLoading$: Observable<boolean>;
  /**
   * Whether or not the current value is empty and not loading.
   *
   * Only resolves when the first non-loading event has occured.
   *
   * After that, will return true if the value is empty even if loading a new value.
   */
  readonly isEmptyAndNotLoading$: Observable<boolean>;
}

/**
 * A ListLoadingStateContext that can be updated and destroyed.
 */
export type MutableListLoadingStateContext<L = unknown, S extends ListLoadingState<L> = ListLoadingState<L>> = ListLoadingStateContext<L, S> & Pick<MutableLoadingStateContext<L[], S>, 'setStateObs' | 'destroy'>;

/**
 * Configuration for listLoadingStateContext().
 */
export type ListLoadingStateContextConfig<L, S extends ListLoadingState<L> = ListLoadingState<L>> = Omit<LoadingStateContextConfig<L[], S>, 'loadingEventForLoadingPair'> & Partial<LimitArrayConfig>;

/**
 * Input for listLoadingStateContext().
 */
export type ListLoadingStateContextInput<L, S extends ListLoadingState<L> = ListLoadingState<L>> = Omit<LoadingStateContextInput<L[], S>, 'loadingEventForLoadingPair'> | ListLoadingStateContextConfig<L, S>;

/**
 * Creates a ListLoadingStateContext.
 *
 * @param input Optional configuration for the ListLoadingStateContext.
 * @returns A ListLoadingStateContext.
 */
export function listLoadingStateContext<L, S extends ListLoadingState<L> = ListLoadingState<L>>(input?: ListLoadingStateContextInput<L, S>): MutableListLoadingStateContext<L, S> {
  const limitArrayConfig = (typeof input === 'object' ? input : undefined) as Maybe<Partial<LimitArrayConfig>>;

  const loadingState = loadingStateContext<L[], S>({
    ...input,
    loadingEventForLoadingPair: (state: S, config: LoadingEventForLoadingPairConfigInput) => {
      const result = DEFAULT_LOADING_EVENT_FOR_LOADING_PAIR_FUNCTION(state, config) as Configurable<LoadingStateContextEvent<L[]>>;
      const hasValue = hasNonNullValue(result.value);

      if (hasValue) {
        result.value = limitArray(result.value, limitArrayConfig); // Always limit the value/results.
      }

      return result as LoadingContextEvent & S;
    }
  });

  const currentList$ = loadingState.value$;
  const listAfterLoaded$ = loadingState.valueAfterLoaded$;
  const list$ = loadingState.valueAfterLoaded$.pipe(map((x) => x ?? []));

  const isEmpty$ = loadingState.stream$.pipe(
    skipWhile((x) => isLoadingStateLoading(x)), // skip until the first non-loading event has occured
    mapIsListLoadingStateWithEmptyValue(),
    distinctUntilChanged()
  );

  const isEmptyLoading$ = loadingState.stream$.pipe(
    map((x) => isLoadingStateLoading(x) && isListLoadingStateWithEmptyValue(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  const isEmptyAndNotLoading$ = loadingState.stream$.pipe(
    map((x) => !isLoadingStateLoading(x) && isListLoadingStateWithEmptyValue(x)),
    distinctUntilChanged()
  );

  const result: MutableListLoadingStateContext<L, S> = {
    ...loadingState,
    currentList$,
    listAfterLoaded$,
    list$,
    isEmpty$,
    isEmptyLoading$,
    isEmptyAndNotLoading$
  };

  return result;
}
