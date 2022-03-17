import { switchMap, map, catchError, of, BehaviorSubject } from 'rxjs';
import { ObservableGetter, SubscriptionObject, IsModifiedFunction, asObservable, returnIfIs, filterMaybe } from '@dereekb/rxjs';
import { Destroyable, Initialized, Maybe } from '@dereekb/util';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * DbxActionValueOnTriggerInstance function. Returns an ObervableGetter that returns a value.
 */
export type DbxActionValueOnTriggerFunction<T> = () => ObservableGetter<Maybe<T>>;

export interface DbxActionValueOnTriggerResult<T = any> {
  value?: Maybe<T>;
  reject?: any;
}

/**
 * DbxActionValueOnTriggerInstance configuration.
 */
export interface DbxActionValueOnTriggerInstanceConfig<T> {
  readonly source: DbxActionContextStoreSourceInstance<T, any>,
  readonly valueGetter?: Maybe<DbxActionValueOnTriggerFunction<T>>;
  readonly isModifiedFunction?: Maybe<IsModifiedFunction<T>>;
}

/**
 * Utility class that handles trigger events to retrieve a value.
 */
export class DbxActionValueOnTriggerInstance<T> implements Initialized, Destroyable {

  private _valueGetter = new BehaviorSubject<Maybe<DbxActionValueOnTriggerFunction<T>>>(undefined);
  readonly valueGetter$ = this._valueGetter.pipe(filterMaybe());

  readonly source: DbxActionContextStoreSourceInstance<T, any>;

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
          // Catch any errors and pass them to reject.
          catchError((reject) => of({ reject }))
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
    });
  }

}
