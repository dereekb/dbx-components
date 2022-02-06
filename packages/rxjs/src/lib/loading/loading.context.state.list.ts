import { loadingStateIsLoading } from '@dereekb/rxjs';
import { LimitArrayConfig, hasNonNullValue, limitArray, Maybe } from '@dereekb/util';
import { Observable, distinctUntilChanged } from 'rxjs';
import { filter, map, shareReplay } from 'rxjs/operators';
import { LoadingContextEvent } from './loading.context';
import { ListLoadingState } from './loading.state';
import { AbstractLoadingEventForLoadingPairConfig, AbstractLoadingStateContext, AbstractLoadingStateContextInstance, LoadingStateContextInstanceInputConfig } from './loading.context.state';

export interface ListLoadingStateContextEvent<T> extends LoadingContextEvent {
  list?: Maybe<T[]>;
}

export interface LoadingEventForListLoadingStateConfig<S extends ListLoadingState<any> = ListLoadingState<any>> extends AbstractLoadingEventForLoadingPairConfig<S>, Partial<LimitArrayConfig> { }

export interface ListLoadingStateContext<L = any, S extends ListLoadingState<L> = ListLoadingState<L>> extends AbstractLoadingStateContext<L[], S, ListLoadingStateContextEvent<L>> {
  readonly list$: Observable<L[]>;
  readonly isEmpty$: Observable<boolean>;
}

/**
 * LoadingContext implementation that uses a ListLoadingState observable.
 */
export class ListLoadingStateContextInstance<L = any, S extends ListLoadingState<L> = ListLoadingState<L>> extends AbstractLoadingStateContextInstance<L[], S, ListLoadingStateContextEvent<L>, LoadingEventForListLoadingStateConfig<S>>  {

  /**
   * Returns the current values or an empty list.
   */
  readonly list$: Observable<L[]> = this.stream$.pipe(map(x => x.list ?? []), shareReplay(1));
  readonly isEmpty$: Observable<boolean> = this.stream$.pipe(
    filter(x => !loadingStateIsLoading(x)),
    map(x => Boolean(x.list && !(x.list?.length > 0))),
    distinctUntilChanged()
  );

  protected loadingEventForLoadingPair(state: S, config: LoadingEventForListLoadingStateConfig = {}): ListLoadingStateContextEvent<L> {
    const { showLoadingOnNoValue } = config;

    let loading = state?.loading;
    const error = state?.error;
    let list = state?.value;

    const hasValue = list != null;

    if (hasValue) {
      list = limitArray(list, config);  // Always limit the value/results.
    }

    // If there is no error
    if (!hasNonNullValue(error)) {
      if (showLoadingOnNoValue) {
        loading = !hasValue;
      } else {
        loading = loadingStateIsLoading(state);
      }
    }

    return {
      loading: Boolean(loading),
      error,
      list
    };
  }

}

export function listLoadingStateContext<T = any, S extends ListLoadingState<T> = ListLoadingState<T>>(config: LoadingStateContextInstanceInputConfig<S, LoadingEventForListLoadingStateConfig<S>>): ListLoadingStateContextInstance<T, S> {
  return new ListLoadingStateContextInstance(config);
}
