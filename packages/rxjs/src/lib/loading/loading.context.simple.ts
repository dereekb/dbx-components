import { isLoadingStateWithError } from './loading.state';
import { type Destroyable, type ReadableError } from '@dereekb/util';
import { BehaviorSubject, type Observable } from 'rxjs';
import { type LoadingContext, type LoadingContextEvent } from './loading.context';

/**
 * Simple LoadingContext implementation
 */
export class SimpleLoadingContext implements LoadingContext, Destroyable {
  private readonly _subject = new BehaviorSubject<LoadingContextEvent>({ loading: true });

  readonly stream$: Observable<LoadingContextEvent> = this._subject.asObservable();

  constructor(loading = true) {
    this.setLoading(loading);
  }

  destroy(): void {
    this._subject.complete();
  }

  public hasError(): boolean {
    return isLoadingStateWithError(this._subject.value);
  }

  public clearError(): void {
    this._subject.next({
      ...this._subject.value,
      error: undefined
    });
  }

  public setSuccess(): void {
    this.setLoading(false);
  }

  public setLoading(loading: boolean = true): void {
    // clears the current error
    this._subject.next({
      loading
    });
  }

  public setError(error: ReadableError, loading: boolean = false): void {
    this._subject.next({
      loading,
      error
    });
  }
}
