import { loadingStateIsLoading } from '@dereekb/rxjs';
import { LimitArrayConfig, hasNonNullValue, limitArray, Maybe } from '@dereekb/util';
import { Observable, distinctUntilChanged } from 'rxjs';
import { filter, map, shareReplay } from 'rxjs/operators';
import { LoadingContextEvent } from './loading.context';
import { ListLoadingState } from './loading.state';
import { AbstractLoadingEventForLoadingPairConfig, AbstractLoadingStateContext } from './loading.context.state';

export interface ListLoadingStateContextEvent<T> extends LoadingContextEvent {
  list?: Maybe<T[]>;
}

export interface LoadingEventForListLoadingStateConfig<S extends ListLoadingState<any> = ListLoadingState<any>> extends AbstractLoadingEventForLoadingPairConfig<S>, Partial<LimitArrayConfig> { }

/**
 * LoadingContext implementation that uses a ListLoadingState observable.
 */
export class ListLoadingStateContext<L = any, S extends ListLoadingState<L> = ListLoadingState<L>> extends AbstractLoadingStateContext<L[], S, ListLoadingStateContextEvent<L>, LoadingEventForListLoadingStateConfig<S>>  {

  /**
   * Returns the current models or an empty list.
   */
  readonly list$: Observable<L[]> = this.stream$.pipe(map(x => x.list ?? []), shareReplay(1));
  readonly models$: Observable<L[]> = this.list$;
  readonly isEmpty$: Observable<boolean> = this.stream$.pipe(
    filter(x => !loadingStateIsLoading(x)),
    map(x => Boolean(x.list && !(x.list?.length > 0))),
    distinctUntilChanged()
  );

  protected loadingEventForLoadingPair(state: S, config: LoadingEventForListLoadingStateConfig = {}): ListLoadingStateContextEvent<L> {
    const { showLoadingOnNoModel } = config;

    let loading = state?.loading;
    const error = state?.error;
    let list = state?.model;

    const hasModel = list != null;

    if (hasModel) {
      list = limitArray(list, config);  // Always limit the model/results.
    }

    // If there is no error
    if (!hasNonNullValue(error)) {
      if (showLoadingOnNoModel) {
        loading = !hasModel;
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
