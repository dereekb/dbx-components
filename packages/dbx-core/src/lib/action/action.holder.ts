import { Observable, of } from 'rxjs';
import { Destroyable, Maybe } from '@dereekb/util';
import { LockSet } from '@dereekb/rxjs';
import { ActionContextStoreSource, DbxActionContextStoreSourceInstance, SecondaryActionContextStoreSource } from './action.store.source';
import { ActionContextStore } from './action.store';
import { DbxActionDisabledKey } from './action';

/**
 * Abstract class that can either use SecondaryActionContextStoreSource or create it's own.
 */
export class DbxActionContextBaseSource<T = unknown, O = unknown> implements ActionContextStoreSource<T, O>, Destroyable {

  private readonly _store?: ActionContextStore<T, O>;
  private readonly _store$: Observable<ActionContextStore<T, O>>;
  private readonly _instance: DbxActionContextStoreSourceInstance<T, O>;

  readonly isModified$: Observable<boolean>;
  readonly triggered$: Observable<boolean>;
  readonly success$: Observable<Maybe<O>>;

  constructor(readonly inputSource?: SecondaryActionContextStoreSource<T, O>) {
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

  public enable(key?: DbxActionDisabledKey, enable?: boolean): void {
    this._instance.enable(key, enable);
  }

  public disable(key?: DbxActionDisabledKey, disable?: boolean): void {
    this._instance.disable(key, disable);
  }

  public setIsModified(isModified?: boolean): void {
    this._instance.setIsModified(isModified);
  }

}
