import { hasNonNullValue, type Maybe } from '@dereekb/util';
import { map, shareReplay, filter, type Observable } from 'rxjs';
import { type LoadingContextEvent } from './loading.context';
import { type AbstractLoadingEventForLoadingPairConfig, type AbstractLoadingStateContext, AbstractLoadingStateContextInstance, type LoadingStateContextInstanceInputConfig } from './loading.context.state';
import { isLoadingStateLoading, type LoadingState } from './loading.state';

export interface LoadingStateContextEvent<T = unknown> extends LoadingContextEvent {
  value?: Maybe<T>;
}

export type LoadingEventForLoadingPairConfig<S extends LoadingState = LoadingState> = AbstractLoadingEventForLoadingPairConfig<S>;

export interface LoadingStateContext<T = unknown, S extends LoadingState<T> = LoadingState<T>> extends AbstractLoadingStateContext<T, S, LoadingStateContextEvent<T>> {
  readonly list$: Observable<T[]>;
  readonly values$: Observable<T[]>;
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
        loading = isLoadingStateLoading(pair);
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
