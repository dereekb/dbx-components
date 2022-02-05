import { hasNonNullValue, Maybe } from '@dereekb/util';
import { loadingStateIsLoading } from '@dereekb/rxjs';
import { Observable } from 'rxjs';
import { map, shareReplay, filter } from 'rxjs/operators';
import { LoadingContextEvent } from './loading.context';
import { AbstractLoadingEventForLoadingPairConfig, AbstractLoadingStateContext } from './loading.context.state';
import { LoadingState } from './loading.state';


export interface LoadingStateEvent<T = any> extends LoadingContextEvent {
  model?: Maybe<T>;
}

export interface LoadingEventForLoadingPairConfig<S extends LoadingState = LoadingState> extends AbstractLoadingEventForLoadingPairConfig<S> { }

/**
 * LoadingContext implementation for a LoadingState.
 */
export class LoadingStateContext<T = any, S extends LoadingState<T> = LoadingState<T>> extends AbstractLoadingStateContext<T, S, LoadingStateEvent<T>, LoadingEventForLoadingPairConfig<S>> {

  readonly model$: Observable<Maybe<T>> = this.stream$.pipe(map(x => x.model), shareReplay(1));
  readonly modelAfterLoaded$: Observable<Maybe<T>> = this.stream$.pipe(filter(x => !x.loading), map(x => x.model), shareReplay(1));

  protected loadingEventForLoadingPair(pair: S, { showLoadingOnNoModel }: LoadingEventForLoadingPairConfig = {}): LoadingStateEvent<T> {
    let loading: boolean = false;

    const error = pair?.error;
    const model = pair?.model;

    if (!hasNonNullValue(error)) {
      if (showLoadingOnNoModel) {
        loading = !hasNonNullValue(model);
      } else {
        loading = loadingStateIsLoading(pair);
      }
    }

    return {
      loading,
      error,
      model
    };
  }

}
