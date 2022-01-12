import { Maybe } from '@dereekb/util';
import { Observable } from 'rxjs';
import { map, shareReplay, filter } from 'rxjs/operators';
import { LoadingEvent } from './loading';
import { AbstractLoadingEventForLoadingPairConfig, AbstractLoadingStateLoadingContext } from './loading.context';
import { LoadingState } from './loading.state';


export interface LoadingStateLoadingEvent<T = any> extends LoadingEvent {
  model?: Maybe<T>;
}

export interface LoadingEventForLoadingPairConfig<S extends LoadingState = LoadingState> extends AbstractLoadingEventForLoadingPairConfig<S> { }

/**
 * LoadingContext implementation for a LoadingState.
 */
export class LoadingStateLoadingContext<T = any, S extends LoadingState<T> = LoadingState<T>> extends AbstractLoadingStateLoadingContext<T, S, LoadingStateLoadingEvent<T>, LoadingEventForLoadingPairConfig<S>> {

  readonly model$: Observable<Maybe<T>> = this.stream$.pipe(map(x => x.model), shareReplay(1));
  readonly modelAfterLoaded$: Observable<Maybe<T>> = this.stream$.pipe(filter(x => !x.isLoading), map(x => x.model), shareReplay(1));

  protected loadingEventForLoadingPair(pair: S, { strict = false }: LoadingEventForLoadingPairConfig = {}): LoadingStateLoadingEvent<T> {
    let isLoading: Maybe<Boolean> = !pair;
    const error = pair?.error;
    const model = pair?.model;
    const loading = pair?.loading;

    if (!error) {
      // Not loading if the model is there.
      // If strict is true, and there is no model, loading must also be true.
      isLoading = loading || (pair?.model == null && ((strict) ? pair?.loading : true));
    }

    return {
      isLoading: Boolean(isLoading),
      error,
      model
    };
  }

}
