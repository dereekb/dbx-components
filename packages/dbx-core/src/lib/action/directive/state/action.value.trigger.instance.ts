import { toReadableError, Destroyable, Initialized, Maybe, ReadableError } from '@dereekb/util';
import { switchMap, map, catchError, of, BehaviorSubject, Observable, shareReplay, combineLatestWith } from 'rxjs';
import { ObservableOrValue, SubscriptionObject, IsModifiedFunction, asObservable, returnIfIs, filterMaybe, IsEqualFunction, makeIsModifiedFunctionObservable } from '@dereekb/rxjs';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * DbxActionValueGetterInstance function. Returns an ObervableGetter that returns a value.
 */
export type DbxActionValueGetterValueGetterFunction<T> = () => ObservableOrValue<Maybe<T>>;

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
 * DbxActionValueGetterInstance configuration.
 */
export interface DbxActionValueGetterInstanceConfig<T> {
  readonly source: DbxActionContextStoreSourceInstance<T, unknown>;
  readonly valueGetter?: Maybe<DbxActionValueGetterValueGetterFunction<T>>;
  readonly isEqualFunction?: Maybe<IsEqualFunction<T>>;
  readonly isModifiedFunction?: Maybe<IsModifiedFunction<T>>;
}

/**
 * Utility class that handles trigger events to retrieve a value.
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
