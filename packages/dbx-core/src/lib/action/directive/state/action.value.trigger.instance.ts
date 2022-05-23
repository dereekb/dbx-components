import { toReadableError } from '@dereekb/util';
import { switchMap, map, catchError, of, BehaviorSubject } from 'rxjs';
import { ObservableOrValue, SubscriptionObject, IsModifiedFunction, asObservable, returnIfIs, filterMaybe } from '@dereekb/rxjs';
import { Destroyable, Initialized, Maybe, ReadableError } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * DbxActionValueOnTriggerInstance function. Returns an ObervableGetter that returns a value.
 */
export type DbxActionValueOnTriggerFunction<T> = () => ObservableOrValue<Maybe<T>>;

export interface DbxActionValueOnTriggerResult<T = unknown> {
  value?: Maybe<T>;
  reject?: Maybe<ReadableError>;
}

/**
 * DbxActionValueOnTriggerInstance configuration.
 */
export interface DbxActionValueOnTriggerInstanceConfig<T> {
  readonly source: DbxActionContextStoreSourceInstance<T, unknown>,
  readonly valueGetter?: Maybe<DbxActionValueOnTriggerFunction<T>>;
  readonly isModifiedFunction?: Maybe<IsModifiedFunction<T>>;
}

/**
 * Utility class that handles trigger events to retrieve a value.
 */
export class DbxActionValueOnTriggerInstance<T> implements Initialized, Destroyable {

  private _valueGetter = new BehaviorSubject<Maybe<DbxActionValueOnTriggerFunction<T>>>(undefined);
  readonly valueGetter$ = this._valueGetter.pipe(filterMaybe());

  readonly source: DbxActionContextStoreSourceInstance<T, unknown>;

  isModifiedFunction?: Maybe<IsModifiedFunction<T>>;

  private _triggeredSub = new SubscriptionObject();

  constructor(config: DbxActionValueOnTriggerInstanceConfig<T>) {
    this.source = config.source;
    this._valueGetter.next(config.valueGetter);
  }

  get valueGetter(): Maybe<DbxActionValueOnTriggerFunction<T>> {
    return this._valueGetter.value;
  }

  set valueGetter(valueGetter: Maybe<DbxActionValueOnTriggerFunction<T>>) {
    this._valueGetter.next(valueGetter);
  }

  init(): void {

    // Ready the value after the source is triggered. Do modified check one last time.
    this._triggeredSub.subscription = this.source.triggered$.pipe(
      switchMap(() => this.valueGetter$.pipe(switchMap((valueGetter) => asObservable(valueGetter())))
        .pipe(
          // If the value is not null/undefined and is considered modified, then pass the value.
          switchMap((value) => returnIfIs(this.isModifiedFunction, value, false).pipe(map((value) => ({ value })))),
          // Catch unknown errors and pass them to reject.
          catchError((reject) => of({ reject: toReadableError(reject) }))
        )
      )
    ).subscribe((result: DbxActionValueOnTriggerResult<T>) => {
      if (result.value != null) {
        this.source.readyValue(result.value);
      } else {
        this.source.reject(result.reject);
      }
    });
  }

  destroy(): void {
    this.source.lockSet.onNextUnlock(() => {
      this._triggeredSub.destroy();
      this._valueGetter.complete();
    });
  }

}
