import { type Observable } from 'rxjs';
import { type LoadingErrorPair } from './loading.state';

export interface LoadingContextEvent extends LoadingErrorPair {
  readonly loading: boolean;
}

/**
 * An observable LoadingContext that provides a stream of events.
 */
export interface LoadingContext {
  /**
   * Stream of events that provide the current LoadingContextEvent for the LoadingContext.
   */
  readonly stream$: Observable<LoadingContextEvent>;
}
