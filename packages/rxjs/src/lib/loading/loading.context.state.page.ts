import { loadingStateIsLoading } from '@dereekb/rxjs';
import { LimitArrayConfig, hasNonNullValue, limitArray, Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { LoadingContextEvent } from './loading.context';
import { PageListLoadingState } from './loading.state.page';
import { AbstractLoadingEventForLoadingPairConfig, AbstractLoadingStateLoadingContext } from './loading.context.state';

export interface PageListLoadingContextEvent<T> extends LoadingContextEvent {
  list?: Maybe<T[]>;
}

export interface LoadingEventForPageListLoadingStateConfig<S extends PageListLoadingState<any> = PageListLoadingState<any>> extends AbstractLoadingEventForLoadingPairConfig<S>, Partial<LimitArrayConfig> { }

/**
 * LoadingContext implementation that uses a PageListLoadingState observable.
 */
export class PageListLoadingContext<L = any, S extends PageListLoadingState<L> = PageListLoadingState<L>> extends AbstractLoadingStateLoadingContext<L[], S, PageListLoadingContextEvent<L>, LoadingEventForPageListLoadingStateConfig<S>>  {

  /**
   * Returns the current models or an empty list.
   */
  readonly list$: Observable<L[]> = this.stream$.pipe(map(x => x.list ?? []), shareReplay(1));
  readonly models$: Observable<L[]> = this.list$;

  protected loadingEventForLoadingPair(state: S, config: LoadingEventForPageListLoadingStateConfig = {}): PageListLoadingContextEvent<L> {
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
