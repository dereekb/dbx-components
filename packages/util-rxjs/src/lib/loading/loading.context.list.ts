import { Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { LoadingEvent } from './loading';
import { ModelListState } from './loading.state.list';
import { hasResults, isRetrievingFirstPage } from './loading.state.list.reducer';
import { AbstractLoadingEventForLoadingPairConfig, AbstractLoadingStateLoadingContext } from './loading.context';

export interface ModelListLoadingEvent<T> extends LoadingEvent {
  list?: Maybe<T[]>;
}

export interface LoadingEventForModelListStateConfig<S extends ModelListState<any> = ModelListState<any>> extends AbstractLoadingEventForLoadingPairConfig<S> {
  /**
   * Number of items in the list to limit in the result.
   */
  limit?: number;
}

/**
 * LoadingContext implementation that uses a ModelListState observable.
 */
export class ModelListLoadingContext<L = any, S extends ModelListState<L> = ModelListState<L>> extends AbstractLoadingStateLoadingContext<L[], S, ModelListLoadingEvent<L>, LoadingEventForModelListStateConfig<S>>  {

  /**
   * Returns the current models or an empty list.
   */
  readonly list$: Observable<L[]> = this.stream$.pipe(map(x => x.list ?? []), shareReplay(1));
  readonly models$: Observable<L[]> = this.list$;

  protected loadingEventForLoadingPair(state: S, { strict = false, limit }: LoadingEventForModelListStateConfig = {}): ModelListLoadingEvent<L> {
    const stateHasResults = hasResults(state);

    let isLoading = state?.loading;
    const error = state?.error;
    let list = state?.model;

    if (list && limit) {
      list = list.slice(0, limit);
    }

    if (state?.retrieving !== undefined) {
      // Show loading regardless of the state.
      if (strict !== false) {
        isLoading = true;
      } else {
        // Is only loading if we're retrieving the first page and have no results.
        isLoading = isLoading && isRetrievingFirstPage(state);
      }
    } else {
      isLoading = !stateHasResults;
    }

    return {
      isLoading: Boolean(isLoading),
      error,
      list
    };
  }

}
