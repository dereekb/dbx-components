import { onFalseToTrue, scanCount, SubscriptionObject, filterMaybe, ObservableOrValue, asObservable } from '@dereekb/rxjs';
import { BehaviorSubject, combineLatest, filter, shareReplay, switchMap, exhaustMap, combineLatestWith, distinctUntilChanged, EMPTY, Observable } from 'rxjs';
import { FirestoreDocument } from '@dereekb/firebase';
import { Destroyable, Maybe, Initialized } from '@dereekb/util';
import { DbxFirebaseCollectionStore } from '../store';
import { DbxFirebaseCollectionChangeWatcher, dbxFirebaseCollectionChangeWatcher, DbxFirebaseCollectionChangeWatcherInstance } from './collection.change.watcher';

export type DbxFirebaseCollectionChangeTriggerFunction<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> = (instance: DbxFirebaseCollectionChangeTriggerInstance<T, D, S>) => ObservableOrValue<void>;

/**
 * Restarts the store.
 *
 * @param instance
 * @returns
 */
export const DEFAULT_FIREBASE_COLLECTION_CHANGE_TRIGGER_FUNCTION: DbxFirebaseCollectionChangeTriggerFunction<any, any> = (instance) => instance.watcher.store.restart();

export interface DbxFirebaseCollectionChangeTriggerInstanceConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> {
  readonly watcher: DbxFirebaseCollectionChangeWatcher<T, D, S> & Partial<Destroyable>;
  /**
   * Whether or not to also destroy the watcher when the trigger instance is destroyed.
   *
   * Defaults to false.
   */
  readonly destroyWatcherOnDestroy?: boolean;
  /**
   * Initial trigger function to use.
   *
   * By default restarts the store.
   */
  readonly triggerFunction?: Maybe<DbxFirebaseCollectionChangeTriggerFunction<T, D, S>>;
}

export interface DbxFirebaseCollectionChangeTrigger<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> {
  readonly watcher: DbxFirebaseCollectionChangeWatcher<T, D, S>;
  triggerFunction?: Maybe<DbxFirebaseCollectionChangeTriggerFunction<T, D, S>>;
}

export class DbxFirebaseCollectionChangeTriggerInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> implements DbxFirebaseCollectionChangeTrigger<T, D, S>, Initialized, Destroyable {
  readonly watcher: DbxFirebaseCollectionChangeWatcher<T, D, S>;

  private _triggerFunction = new BehaviorSubject<Maybe<DbxFirebaseCollectionChangeTriggerFunction<T, D, S>>>(undefined);
  private _sub = new SubscriptionObject();

  constructor(readonly config: DbxFirebaseCollectionChangeTriggerInstanceConfig<T, D, S>) {
    this.watcher = config.watcher;
    this.triggerFunction = config.triggerFunction ?? DEFAULT_FIREBASE_COLLECTION_CHANGE_TRIGGER_FUNCTION;
  }

  init(): void {
    this._sub.subscription = this._triggerFunction
      .pipe(
        switchMap((triggerFunction) => {
          if (triggerFunction) {
            return this.watcher.triggered$.pipe(
              filter((triggered) => triggered),
              exhaustMap(() => asObservable(triggerFunction(this)))
            );
          } else {
            return EMPTY;
          }
        })
      )
      .subscribe();
  }

  destroy(): void {
    this._triggerFunction.complete();

    if (this.config.destroyWatcherOnDestroy === true) {
      (this.watcher as unknown as Destroyable)?.destroy();
    }
  }

  get triggerFunction(): Maybe<DbxFirebaseCollectionChangeTriggerFunction<T, D, S>> {
    return this._triggerFunction.value;
  }

  set triggerFunction(triggerFunction: Maybe<DbxFirebaseCollectionChangeTriggerFunction<T, D, S>>) {
    this._triggerFunction.next(triggerFunction);
  }
}

/**
 * Creates a new DbxFirebaseCollectionChangeWatcher, set the modes to "auto", and creates a new DbxFirebaseCollectionChangeTriggerInstance.
 *
 * @param store
 * @param triggerFunction
 * @returns
 */
export function dbxFirebaseCollectionChangeTriggerInstanceForStore<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>>(store: S, triggerFunction?: Maybe<DbxFirebaseCollectionChangeTriggerFunction<T, D, S>>): DbxFirebaseCollectionChangeTriggerInstance<T, D, S> {
  return dbxFirebaseCollectionChangeTriggerInstance<T, D, S>({
    watcher: dbxFirebaseCollectionChangeWatcher<T, D, S>(store, 'auto'),
    destroyWatcherOnDestroy: true,
    triggerFunction
  });
}

export function dbxFirebaseCollectionChangeTriggerInstanceForWatcher<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>>(watcher: DbxFirebaseCollectionChangeWatcher<T, D, S>, triggerFunction?: Maybe<DbxFirebaseCollectionChangeTriggerFunction<T, D, S>>): DbxFirebaseCollectionChangeTriggerInstance<T, D, S> {
  return dbxFirebaseCollectionChangeTriggerInstance<T, D, S>({
    watcher,
    destroyWatcherOnDestroy: false,
    triggerFunction
  });
}

export function dbxFirebaseCollectionChangeTriggerInstance<T, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>>(config: DbxFirebaseCollectionChangeTriggerInstanceConfig<T, D, S>): DbxFirebaseCollectionChangeTriggerInstance<T, D, S> {
  return new DbxFirebaseCollectionChangeTriggerInstance(config);
}
