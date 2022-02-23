import { Observable } from 'rxjs';
import { LoadingErrorPair } from './loading.state';

export interface LoadingContextEvent extends LoadingErrorPair {
  loading: boolean;
}

export interface LoadingContext {
  readonly stream$: Observable<LoadingContextEvent>;
}
