import { ReadableError } from '../error/error';
import { BehaviorSubject, isObservable, Observable, combineLatest, of } from 'rxjs';
import { filter, first, map } from 'rxjs/operators';
import { ActionContextStoreSourceInstance } from './action';

export interface WorkHandlerContextDelegate<O = any> {
  startWorking(): void;
  success(result: O): void;
  reject(error: any): void;
}

/**
 * WorkHandlerContextDelegate implementation using an ActionContextStoreSourceInstance.
 */
export class WorkHandlerContextSourceDelegate<T = any, O = any> implements WorkHandlerContextDelegate<O> {

  constructor(readonly source: ActionContextStoreSourceInstance<T, O>) { }

  startWorking(): void {
    this.source.startWorking();
  }

  success(result: O): void {
    this.source.success(result);
  }

  reject(error: any): void {
    this.source.reject(error);
  }

}

/**
 * Used by DbNgxActionHandlerDirective when handling a function.
 */
export class WorkHandlerContext<T = any, O = any> {

  private _done = false;
  private _doneActionBegan;

  private _actionBegan = new BehaviorSubject<boolean>(false);
  private _isComplete = new BehaviorSubject<boolean>(false);

  constructor(public readonly value: T, readonly delegate: WorkHandlerContextDelegate<O>) {

    // Schedule to cleanup self once isComplete is true.
    // NOTE: May not be needed.
    this._isComplete.subscribe((done) => {
      if (done) {
        this._doneActionBegan = this.actionBegan;
        this._done = true;

        // Delay to prevent error.
        setTimeout(() => {
          this._actionBegan.complete();
          this._isComplete.complete();

          delete this._actionBegan;
          delete this._isComplete;
        });
      }
    });
  }

  get actionBegan(): boolean {
    return this._doneActionBegan ?? this._actionBegan.value;
  }

  get actionBegan$(): Observable<boolean> {
    return this._done ? of(this._doneActionBegan) : this._actionBegan.asObservable();
  }

  get isComplete(): boolean {
    return this._done || this._isComplete.value;
  }

  get isComplete$(): Observable<boolean> {
    return this._done ? of(true) : this._isComplete.asObservable();
  }

  /**
   * Begins working using an observable.
   */
  startWorkingWithObservable(actionObs: Observable<O>): void {
    this.startWorking();
    actionObs.pipe(first()).subscribe((actionResult: O) => {
      this.success(actionResult);
    }, (error: any) => {
      const message = error.message ?? error.code ?? undefined;
      this.reject((message) ? ({ message }) : undefined);
    });
  }

  /**
   * Notifies the system that the action has begun.
   */
  startWorking(): void {
    this._setWorking();
    this.delegate.startWorking();
  }

  /**
   * Sets success on the action.
   */
  success(result?: O): void {
    this._setComplete();
    this.delegate.success(result);
  }

  /**
   * Sets rejected on the action.
   */
  reject(error?: ReadableError): void {
    this._setComplete();
    this.delegate.reject(error);
  }

  private _setWorking(): void {
    if (this.actionBegan) {
      throw new Error('Action already has been triggered for this context.');
    }

    this._actionBegan.next(true);
  }

  private _setComplete(): void {
    if (this.isComplete) {
      throw new Error('Action has already been marked as completed.');
    }

    this._isComplete.next(true);
  }

}

export type HandleActionFunctionConfigFn<T, O> = (value: T) => HandleWorkValueReadyConfig<T, O>;

/**
 * Creates a function that uses a provider to always handle new values.
 */
export function handleWorkValueReadyWithConfigFn<T, O>(providerFn: HandleActionFunctionConfigFn<T, O>): (value: T) => WorkHandlerContext {
  return (value) => {
    const config: HandleWorkValueReadyConfig<T, O> = providerFn(value);
    return handleWorkValueReadyFn(config)(value);
  };
}

/**
 * Config for handleWorkValueReadyFn().
 */
export interface HandleWorkValueReadyConfig<T, O> {
  handlerFunction: HandleActionFunction<T, O>;
  delegate: WorkHandlerContextDelegate<O>;
}

/**
 * Performs the action. Can either return an observable that will use the handler, or can use the handler itself.
 */
export type HandleActionFunction<T = any, O = any> = (value: T, context: WorkHandlerContext<T, O>) => Observable<O> | void;

/**
 * Creates a function that handles the incoming value and creates a WorkHandlerContext.
 */
export function handleWorkValueReadyFn<T, O>({ handlerFunction, delegate }: HandleWorkValueReadyConfig<T, O>): (value: T) => WorkHandlerContext {
  return (value: T) => {
    const handler = new WorkHandlerContext<T, O>(value, delegate);
    let fnResult: void | Observable<O>;

    try {
      fnResult = handlerFunction(value, handler);
    } catch (e) {
      console.error('Action encountered an unexpected error.', e);
      handler.reject(e);
      return;
    }

    if (!handler.isComplete) {
      if (fnResult && isObservable(fnResult)) {
        if (handler.actionBegan) {
          throw new Error('Action already marked as begun from handlerFunction result. Either return an observable or use the handler directly.');
        }

        handler.startWorkingWithObservable(fnResult);
      }
    }

    return handler;
  };
}
