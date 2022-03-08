import { Observable, of } from 'rxjs';
import { Destroyable } from '@dereekb/util';
import { LockSet } from '@dereekb/rxjs';
import { ActionContextStoreSource, DbxActionContextStoreSourceInstance, SecondaryActionContextStoreSource } from './action.store.source';
import { ActionContextStore } from './action.store';

/**
 * Abstract class that can either use SecondaryActionContextStoreSource or create it's own.
 */
export class DbxActionContextBaseSource<T = any, O = any> implements ActionContextStoreSource, Destroyable {

  private readonly _store?: ActionContextStore;
  private readonly _store$: Observable<ActionContextStore<T, O>>;
  private readonly _instance: DbxActionContextStoreSourceInstance<T, O>;

  readonly isModified$: Observable<boolean>;
  readonly triggered$: Observable<boolean>;
  readonly success$: Observable<O>;

  constructor(readonly inputSource?: SecondaryActionContextStoreSource) {
    if (this.inputSource) {
      this._store$ = this.inputSource.store$;
    } else {
      this._store = new ActionContextStore();
      this._store$ = of(this._store);
    }

    this._instance = new DbxActionContextStoreSourceInstance(this);
    this.isModified$ = this._instance.isModified$;
    this.triggered$ = this._instance.triggered$;
    this.success$ = this._instance.success$;
  }

  destroy(): void {
    if (this._store) {
      this._store.ngOnDestroy();
      this._instance.ngOnDestroy();
    }
  }

  get lockSet(): LockSet {
    return this._instance.lockSet;
  }

  get sourceInstance(): DbxActionContextStoreSourceInstance<T, O> {
    return this._instance;
  }

  get store$(): Observable<ActionContextStore<T, O>> {
    return this._store$;
  }

  /**
   * Use to trigger the action directly.
   */
  public trigger(): void {
    this._instance.trigger();
  }

  public readyValue(value: T): void {
    this._instance.readyValue(value);
  }

  public reset(): void {
    this._instance.reset();
  }

}
