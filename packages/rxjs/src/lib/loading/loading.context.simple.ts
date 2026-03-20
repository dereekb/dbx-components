import { isLoadingStateWithError } from './loading.state';
import { type Destroyable, type ReadableError } from '@dereekb/util';
import { BehaviorSubject, type Observable } from 'rxjs';
import { type LoadingContext, type LoadingContextEvent } from './loading.context';

/**
 * Simple imperative {@link LoadingContext} implementation backed by a {@link BehaviorSubject}.
 *
 * Provides methods to manually set loading, success, and error states. Useful in components
 * or services that need to drive a loading indicator without a dedicated state observable.
 *
 * @example
 * ```ts
 * const context = new SimpleLoadingContext();
 * // context starts in loading state by default
 *
 * context.setSuccess(); // marks loading as complete
 * context.setError({ message: 'Something went wrong' }); // sets an error
 * context.clearError(); // clears the error but preserves loading state
 * context.destroy(); // completes the internal subject
 * ```
 */
export class SimpleLoadingContext implements LoadingContext, Destroyable {
  private readonly _subject = new BehaviorSubject<LoadingContextEvent>({ loading: true });

  readonly stream$: Observable<LoadingContextEvent> = this._subject.asObservable();

  constructor(loading = true) {
    this.setLoading(loading);
  }

  /**
   * Completes the internal subject, ending the stream.
   */
  destroy(): void {
    this._subject.complete();
  }

  /**
   * Whether the current state has a non-null error.
   *
   * @returns true if the current state contains an error
   */
  public hasError(): boolean {
    return isLoadingStateWithError(this._subject.value);
  }

  /**
   * Clears the current error while preserving other state.
   */
  public clearError(): void {
    this._subject.next({
      ...this._subject.value,
      error: undefined
    });
  }

  /**
   * Convenience method to mark loading as complete (sets loading to false).
   */
  public setSuccess(): void {
    this.setLoading(false);
  }

  /**
   * Sets the loading flag and clears any existing error.
   *
   * @param loading - whether loading is in progress (defaults to true)
   */
  public setLoading(loading: boolean = true): void {
    // clears the current error
    this._subject.next({
      loading
    });
  }

  /**
   * Sets an error state with an optional loading flag.
   *
   * @param error - the error to set
   * @param loading - whether loading is still in progress (defaults to false)
   */
  public setError(error: ReadableError, loading: boolean = false): void {
    this._subject.next({
      loading,
      error
    });
  }
}
