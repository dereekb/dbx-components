import { Maybe, ReadableError } from '@dereekb/util';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoadingContext, LoadingContextEvent } from './loading.context';

/**
 * Simple LoadingContext implementation
 */
export class SimpleLoadingContext implements LoadingContext {

  private _subject: BehaviorSubject<LoadingContextEvent>;
  private _error: Maybe<ReadableError>;

  constructor(loading = true) {
    this._subject = new BehaviorSubject<LoadingContextEvent>({ loading });
  }

  destroy(): void {
    this._subject.complete();
  }

  public hasError(): boolean {
    return Boolean(this._error);
  }

  public clearError(): void {
    delete this._error;
  }

  public get stream$(): Observable<LoadingContextEvent> {
    return this._subject.asObservable();
  }

  public setSuccess(): void {
    this.setLoading(false);
  }

  public setLoading(loading: boolean = true): void {
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
