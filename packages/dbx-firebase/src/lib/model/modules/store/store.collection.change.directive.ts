import { Directive, Input, OnDestroy, OnInit, effect, inject, input } from '@angular/core';
import { FirestoreDocument } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseCollectionStore } from './store.collection';
import { DbxFirebaseCollectionStoreDirective } from './store.collection.directive';
import { DbxFirebaseCollectionChangeWatcher, dbxFirebaseCollectionChangeWatcher, DbxFirebaseCollectionChangeWatcherEvent, DbxFirebaseCollectionChangeWatcherTriggerMode } from '../../loader/collection.change.watcher';
import { Observable } from 'rxjs';
import { dbxFirebaseCollectionChangeTriggerForWatcher } from '../../loader/collection.change.trigger';

/**
 * Used to watch query doc changes and respond to them accordingly.
 */
@Directive({
  selector: '[dbxFirebaseCollectionChange]',
  standalone: true
})
export class DbxFirebaseCollectionChangeDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> implements DbxFirebaseCollectionChangeWatcher<S>, OnInit, OnDestroy {
  readonly dbxFirebaseCollectionStoreDirective = inject(DbxFirebaseCollectionStoreDirective<T, D, S>);
  readonly mode = input<DbxFirebaseCollectionChangeWatcherTriggerMode, DbxFirebaseCollectionChangeWatcherTriggerMode | ''>('off', { alias: 'dbxFirebaseCollectionChange', transform: (x) => x || 'off' });

  private readonly _watcher = dbxFirebaseCollectionChangeWatcher(this.dbxFirebaseCollectionStoreDirective.store);
  private readonly _trigger = dbxFirebaseCollectionChangeTriggerForWatcher(this._watcher, () => this.restart());

  readonly mode$: Observable<DbxFirebaseCollectionChangeWatcherTriggerMode> = this._watcher.mode$;
  readonly event$: Observable<DbxFirebaseCollectionChangeWatcherEvent> = this._watcher.event$;
  readonly hasChangeAvailable$: Observable<boolean> = this._watcher.hasChangeAvailable$;
  readonly triggered$: Observable<boolean> = this._watcher.triggered$;
  readonly trigger$: Observable<void> = this._watcher.trigger$;

  protected readonly modeEffect = effect(
    () => {
      this._watcher.setMode(this.mode());
    },
    { allowSignalWrites: true }
  );

  get store() {
    return this._watcher.store;
  }

  ngOnInit(): void {
    this._trigger.init();
  }

  ngOnDestroy(): void {
    this._watcher.destroy();
    this._trigger.destroy();
  }

  restart() {
    this.dbxFirebaseCollectionStoreDirective.store.restart();
  }
}
