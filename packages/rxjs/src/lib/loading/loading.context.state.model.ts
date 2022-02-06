import { hasNonNullValue, Maybe } from '@dereekb/util';
import { loadingStateIsLoading } from '@dereekb/rxjs';
import { Observable } from 'rxjs';
import { map, shareReplay, filter } from 'rxjs/operators';
import { LoadingContextEvent } from './loading.context';
import { AbstractLoadingEventForLoadingPairConfig, AbstractLoadingStateContext, AbstractLoadingStateContextInstance, LoadingStateContextInstanceInputConfig } from './loading.context.state';
import { LoadingState } from './loading.state';


export interface LoadingStateContextEvent<T = any> extends LoadingContextEvent {
  model?: Maybe<T>;
}

export interface LoadingEventForLoadingPairConfig<S extends LoadingState = LoadingState> extends AbstractLoadingEventForLoadingPairConfig<S> { }

export interface LoadingStateContext<L = any, S extends LoadingState<L> = LoadingState<L>> extends AbstractLoadingStateContext<L, S, LoadingStateContextEvent<L>> {
  readonly list$: Observable<L[]>;
  readonly models$: Observable<L[]>;
  readonly isEmpty$: Observable<boolean>;
}

/**
 * LoadingContext implementation for a LoadingState.
 */
export class LoadingStateContextInstance<T = any, S extends LoadingState<T> = LoadingState<T>> extends AbstractLoadingStateContextInstance<T, S, LoadingStateContextEvent<T>, LoadingEventForLoadingPairConfig<S>> {

  readonly model$: Observable<Maybe<T>> = this.stream$.pipe(map(x => x.model), shareReplay(1));
  readonly modelAfterLoaded$: Observable<Maybe<T>> = this.stream$.pipe(filter(x => !x.loading), map(x => x.model), shareReplay(1));

  protected loadingEventForLoadingPair(pair: S, { showLoadingOnNoModel }: LoadingEventForLoadingPairConfig = {}): LoadingStateContextEvent<T> {
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

export function loadingStateContext<T = any, S extends LoadingState<T> = LoadingState<T>>(config: LoadingStateContextInstanceInputConfig<S, LoadingEventForLoadingPairConfig<S>>): LoadingStateContextInstance<T, S> {
  return new LoadingStateContextInstance(config);
}
