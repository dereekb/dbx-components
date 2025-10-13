import { type Observable } from 'rxjs';
import { type LoadingState, type LoadingErrorPair } from './loading.state';
import { LoadingProgress } from './loading';
import { Maybe } from '@dereekb/util';

/**
 * A LoadingErrorPair that always defines a loading value.
 */
export interface LoadingContextEvent extends LoadingErrorPair {
  readonly loading: boolean;
  /**
   * Optional loading progress value.
   */
  readonly loadingProgress?: Maybe<LoadingProgress>;
}

/**
 * An observable LoadingContext that provides a stream of LoadingContextEvents.
 */
export interface LoadingContext<E extends LoadingContextEvent = LoadingContextEvent> {
  /**
   * Stream of events that provide the current LoadingContextEvent for the LoadingContext.
   */
  readonly stream$: Observable<E>;
}

/**
 * A LoadingContextEvent that has a value.
 */
export interface LoadingStateContextEvent<T = unknown> extends LoadingContextEvent, Omit<LoadingState<T>, 'loading'> {}
