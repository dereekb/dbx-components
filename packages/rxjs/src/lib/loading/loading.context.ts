import { type Observable } from 'rxjs';
import { type LoadingErrorPair } from './loading.state';

export interface LoadingContextEvent extends LoadingErrorPair {
  loading: boolean;
}

export interface LoadingContext {
  readonly stream$: Observable<LoadingContextEvent>;
}
