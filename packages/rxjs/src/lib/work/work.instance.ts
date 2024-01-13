import { type Maybe, type Destroyable, type ReadableError, type ErrorInput } from '@dereekb/util';
import { filter, map, BehaviorSubject, type Observable, of, first, shareReplay, switchMap, delay, from, tap } from 'rxjs';
import { beginLoading, errorResult, type LoadingState, loadingStateHasFinishedLoading, loadingStateIsLoading, promiseFromLoadingState, successResult } from '../loading';
import { filterMaybe, preventComplete } from '../rxjs';
import { SubscriptionObject } from '../subscription';

/**
 * Delegate for WorkInstance
 */
export interface WorkInstanceDelegate<O = unknown> {
  startWorking(): void;
  success(result?: Maybe<O>): void;
  reject(error?: Maybe<unknown>): void;
}

/**
 * Instance that tracks doing an arbitrary piece of asynchronous work that has an input value and an output value.
 */
export class WorkInstance<I = unknown, O = unknown> implements Destroyable {
  private _done = false;
  private _doneActionBegan = false;

  private _result: Maybe<LoadingState<O>>;
  private _loadingState = new BehaviorSubject<Maybe<LoadingState<O>>>(undefined);
  private _sub = new SubscriptionObject();

  readonly loadingState$ = this._loadingState.pipe(filterMaybe());
  protected readonly _hasStarted$ = this._loadingState.pipe(
    map((x) => Boolean(x)),
    shareReplay(1)
  );
  protected readonly _isComplete$ = this.loadingState$.pipe(
    map((x) => loadingStateHasFinishedLoading(x)),
    shareReplay(1)
  );

  constructor(public readonly value: I, readonly delegate: WorkInstanceDelegate<O>) {
    // Schedule to cleanup self once isComplete is true.
    this.result$.subscribe((loadingState) => {
      this._result = loadingState;
      this.destroy();
    });
  }

  get hasStarted(): boolean {
    return this._loadingState.value != null;
  }

  get hasStarted$(): Observable<boolean> {
    return this._done ? of(this._doneActionBegan) : this._hasStarted$;
  }

  get isComplete(): boolean {
    return this._done || loadingStateHasFinishedLoading(this._loadingState.value);
  }

  get isComplete$(): Observable<boolean> {
    return this._done ? of(true) : this._isComplete$;
  }

  get result(): Maybe<LoadingState<O>> {
    return this._result;
  }

  get result$(): Observable<LoadingState<O>> {
    return this._result
      ? of(this._result)
      : this._isComplete$.pipe(
          filter((x) => x === true),
          switchMap(() => this.loadingState$)
        );
  }

  /**
   * Begins working with the input loading state, and passes the value through as the result.
   *
   * If the loading state returns an error, the error is forwarded.
   *
   * @param loadingStateObs
   */
  startWorkingWithLoadingStateObservable(loadingStateObs: Observable<Maybe<LoadingState<O>>>): void {
    const obs = preventComplete(loadingStateObs).pipe(filterMaybe(), shareReplay(1));

    this._sub.subscription = obs
      .pipe(
        delay(0), // delay to prevent an immediate start working, which can override the _sub.subscription value
        first()
      )
      .subscribe(() => {
        this.startWorkingWithObservable(
          obs.pipe(
            filter((x) => x && !loadingStateIsLoading(x)), // don't return until it has finished loading.
            map((x) => {
              if (x.error) {
                throw x.error;
              } else {
                return x.value as O;
              }
            })
          )
        );
      });
  }

  /**
   * Performs a task with the input loading state observable and passes any thrown errors.
   *
   * Does not set the completed state. Use startWorkingWithLoadingStateObservable() instead for single observables.
   *
   * It is used in conjunction with startWorking() and ideal for cases where multiple observables or promises are used.
   *
   * @param loadingStateObs
   */
  performTaskWithLoadingState<T>(loadingStateObs: Promise<LoadingState<T>> | Observable<Maybe<LoadingState<T>>>): Promise<T> {
    return promiseFromLoadingState(
      from(loadingStateObs).pipe(
        filterMaybe(),
        tap((x) => {
          this._setWorking(true); // mark as working if not already marked.
        })
      )
    ).catch((e) => {
      // catch and throw any errors.
      this.reject(e);
      throw e;
    });
  }

  /**
   * Begins working using a promise.
   */
  startWorkingWithPromise(promise: Promise<O>): void {
    this.startWorkingWithObservable(from(promise));
  }

  /**
   * Begins working using an observable.
   */
  startWorkingWithObservable(workObs: Observable<O>): void {
    this.startWorking();
    this._sub.subscription = workObs.pipe(first()).subscribe({
      next: (workResult: O) => {
        this.success(workResult);
      },
      error: (error: ReadableError) => {
        this.reject(error);
      }
    });
  }

  /**
   * Notifies the system that the work has begun.
   */
  startWorking(): void {
    this._setWorking();
    this.delegate.startWorking();
  }

  /**
   * Sets success on the work.
   */
  success(result?: O): void {
    this._setComplete(successResult(result));
    this.delegate.success(result);
  }

  /**
   * Sets rejected on the work.
   */
  reject(error?: ErrorInput): void {
    this._setComplete(errorResult(error));
    this.delegate.reject(error);
  }

  destroy(): void {
    this._doneActionBegan = this.hasStarted;
    this._done = true;

    // Delay to prevent error.
    setTimeout(() => {
      this._loadingState.complete();
      this._sub.destroy();
    });
  }

  private _setWorking(silenceError?: boolean): void {
    if (this.hasStarted && !silenceError) {
      throw new Error('Action already has been triggered for this context.');
    } else {
      this._loadingState.next(beginLoading());
    }
  }

  private _setComplete(loadingState: LoadingState<O>): void {
    if (this.isComplete) {
      throw new Error('Action has already been marked as completed.');
    }

    this._loadingState.next(loadingState);
  }
}
