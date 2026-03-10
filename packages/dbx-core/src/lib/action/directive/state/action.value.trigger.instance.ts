import { toReadableError, type Destroyable, type Initialized, type Maybe, type ReadableError } from '@dereekb/util';
import { switchMap, map, catchError, of, BehaviorSubject, type Observable, shareReplay, combineLatestWith } from 'rxjs';
import { type ObservableOrValue, SubscriptionObject, type IsModifiedFunction, asObservable, returnIfIs, filterMaybe, type IsEqualFunction, makeIsModifiedFunctionObservable } from '@dereekb/rxjs';
import { type DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Function that retrieves the input value for an action when triggered.
 *
 * Called by {@link DbxActionValueGetterInstance} when the action is triggered,
 * returning the value (or an observable of the value) to pass to the action.
 *
 * @typeParam T - The value type to retrieve.
 */
export type DbxActionValueGetterValueGetterFunction<T> = () => ObservableOrValue<Maybe<T>>;

/**
 * Result of a value getter invocation, containing either a value to proceed with
 * or an error to reject the action.
 *
 * @typeParam T - The value type.
 */
export interface DbxActionValueGetterResult<T = unknown> {
  /**
   * The value to trigger with
   */
  readonly value?: Maybe<T>;
  /**
   * The error to reject with
   */
  readonly reject?: Maybe<ReadableError>;
}

/**
 * Configuration for a {@link DbxActionValueGetterInstance}.
 *
 * @typeParam T - The value type for the action.
 */
export interface DbxActionValueGetterInstanceConfig<T> {
  readonly source: DbxActionContextStoreSourceInstance<T, unknown>;
  readonly valueGetter?: Maybe<DbxActionValueGetterValueGetterFunction<T>>;
  readonly isEqualFunction?: Maybe<IsEqualFunction<T>>;
  readonly isModifiedFunction?: Maybe<IsModifiedFunction<T>>;
}

/**
 * Utility class that handles the trigger-to-value-ready phase of the action lifecycle.
 *
 * When initialized, it subscribes to the source's `triggered$` stream. On each trigger,
 * it calls the configured {@link DbxActionValueGetterValueGetterFunction} to retrieve the value,
 * runs an optional {@link IsModifiedFunction} check, and either calls `readyValue()` with
 * the retrieved value or `reject()` if the value is null/undefined or an error occurred.
 *
 * This separates value retrieval from the trigger event, allowing lazy or async value computation.
 *
 * @typeParam T - The value type for the action.
 *
 * @see {@link DbxActionValueTriggerDirective} for the directive wrapper.
 * @see {@link DbxActionValueDirective} for the simpler always-piped-value approach.
 */
export class DbxActionValueGetterInstance<T> implements Initialized, Destroyable {
  private readonly _valueGetterFunction = new BehaviorSubject<Maybe<DbxActionValueGetterValueGetterFunction<T>>>(undefined);
  readonly valueGetterFunction$ = this._valueGetterFunction.pipe(filterMaybe());

  private readonly _isModifiedFunction = new BehaviorSubject<Maybe<IsModifiedFunction<T>>>(undefined);
  private readonly _isEqualFunction = new BehaviorSubject<Maybe<IsEqualFunction<T>>>(undefined);

  readonly isModifiedFunction$: Observable<IsModifiedFunction<T>> = makeIsModifiedFunctionObservable({
    isModified: this._isModifiedFunction,
    isEqual: this._isEqualFunction
  }).pipe(shareReplay(1));

  readonly source: DbxActionContextStoreSourceInstance<T, unknown>;

  private readonly _triggeredSub = new SubscriptionObject();

  constructor(config: DbxActionValueGetterInstanceConfig<T>) {
    this.source = config.source;
    this.setValueGetterFunction(config.valueGetter);
    this.setIsModifiedFunction(config.isModifiedFunction);
    this.setIsEqualFunction(config.isEqualFunction);
  }

  setValueGetterFunction(valueGetterFunction: Maybe<DbxActionValueGetterValueGetterFunction<T>>) {
    this._valueGetterFunction.next(valueGetterFunction);
  }

  setIsModifiedFunction(isModifiedFunction: Maybe<IsModifiedFunction<T>>) {
    this._isModifiedFunction.next(isModifiedFunction);
  }

  setIsEqualFunction(isEqualFunction: Maybe<IsEqualFunction<T>>) {
    this._isEqualFunction.next(isEqualFunction);
  }

  init(): void {
    // Ready the value after the source is triggered. Do modified check one last time.
    this._triggeredSub.subscription = this.source.triggered$
      .pipe(
        switchMap(() =>
          this.valueGetterFunction$.pipe(
            switchMap((valueGetter) => asObservable(valueGetter())),
            combineLatestWith(this.isModifiedFunction$),
            // If the value is not null/undefined and is considered modified, then pass the value.
            switchMap(([value, isModifiedFunction]) => returnIfIs(isModifiedFunction, value, false).pipe(map((value) => ({ value })))),
            // Catch unknown errors and pass them to reject.
            catchError((reject) => of({ reject: toReadableError(reject) }))
          )
        )
      )
      .subscribe((result: DbxActionValueGetterResult<T>) => {
        if (result.value != null) {
          this.source.readyValue(result.value);
        } else {
          this.source.reject(result.reject);
        }
      });
  }

  destroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      this._valueGetterFunction.complete();
      this._isModifiedFunction.complete();
      this._isEqualFunction.complete();
      this._triggeredSub.destroy();
    });
  }
}
