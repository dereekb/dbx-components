import { hasNonNullValue, Maybe } from '@dereekb/util';
import { map, shareReplay, filter, Observable } from 'rxjs';
import { LoadingContextEvent } from './loading.context';
import { AbstractLoadingEventForLoadingPairConfig, AbstractLoadingStateContext, AbstractLoadingStateContextInstance, LoadingStateContextInstanceInputConfig } from './loading.context.state';
import { loadingStateIsLoading, LoadingState } from './loading.state';

export interface LoadingStateContextEvent<T = unknown> extends LoadingContextEvent {
  value?: Maybe<T>;
}

export type LoadingEventForLoadingPairConfig<S extends LoadingState = LoadingState> = AbstractLoadingEventForLoadingPairConfig<S>;

export interface LoadingStateContext<L = unknown, S extends LoadingState<L> = LoadingState<L>> extends AbstractLoadingStateContext<L, S, LoadingStateContextEvent<L>> {
  readonly list$: Observable<L[]>;
  readonly values$: Observable<L[]>;
  readonly isEmpty$: Observable<boolean>;
}

/**
 * LoadingContext implementation for a LoadingState.
 */
export class LoadingStateContextInstance<T = unknown, S extends LoadingState<T> = LoadingState<T>> extends AbstractLoadingStateContextInstance<T, S, LoadingStateContextEvent<T>, LoadingEventForLoadingPairConfig<S>> {
  readonly value$: Observable<Maybe<T>> = this.stream$.pipe(
    map((x) => x.value),
    shareReplay(1)
  );
  readonly valueAfterLoaded$: Observable<Maybe<T>> = this.stream$.pipe(
    filter((x) => !x.loading),
    map((x) => x.value),
    shareReplay(1)
  );

  protected loadingEventForLoadingPair(pair: S, { showLoadingOnNoValue }: LoadingEventForLoadingPairConfig = {}): LoadingStateContextEvent<T> {
    let loading: boolean = false;

    const error = pair?.error;
    const value = pair?.value;

    if (!hasNonNullValue(error)) {
      if (showLoadingOnNoValue) {
        loading = !hasNonNullValue(value);
      } else {
        loading = loadingStateIsLoading(pair);
      }
    }

    return {
      loading,
      error,
      value
    };
  }
}

export function loadingStateContext<T = unknown, S extends LoadingState<T> = LoadingState<T>>(config: LoadingStateContextInstanceInputConfig<S, LoadingEventForLoadingPairConfig<S>>): LoadingStateContextInstance<T, S> {
  return new LoadingStateContextInstance(config);
}
