import { Directive, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { FirestoreDocument } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseCollectionStore } from './store.collection';
import { DbxFirebaseCollectionStoreDirective } from './store.collection.directive';
import { DbxFirebaseCollectionChangeWatcher, dbxFirebaseCollectionChangeWatcher, DbxFirebaseCollectionChangeWatcherEvent, DbxFirebaseCollectionChangeWatcherTriggerMode } from '../../loader/collection.change.watcher';
import { Observable } from 'rxjs';
import { dbxFirebaseCollectionChangeTriggerForWatcher } from '../../loader/collection.change.trigger';

/**
 * Used to watch query doc changes and respond to them accordingly.
 */
@Directive({
  selector: '[dbxFirebaseCollectionChange]'
})
export class DbxFirebaseCollectionChangeDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> implements DbxFirebaseCollectionChangeWatcher<S>, OnInit, OnDestroy {
  readonly dbxFirebaseCollectionStoreDirective = inject(DbxFirebaseCollectionStoreDirective<T, D, S>);

  private readonly _watcher = dbxFirebaseCollectionChangeWatcher(this.dbxFirebaseCollectionStoreDirective.store);
  private readonly _trigger = dbxFirebaseCollectionChangeTriggerForWatcher(this._watcher, () => this.restart());

  readonly mode$: Observable<DbxFirebaseCollectionChangeWatcherTriggerMode> = this._watcher.mode$;
  readonly event$: Observable<DbxFirebaseCollectionChangeWatcherEvent> = this._watcher.event$;
  readonly hasChangeAvailable$: Observable<boolean> = this._watcher.hasChangeAvailable$;
  readonly triggered$: Observable<boolean> = this._watcher.triggered$;
  readonly trigger$: Observable<void> = this._watcher.trigger$;

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

  @Input('dbxFirebaseCollectionChange')
  set mode(mode: Maybe<DbxFirebaseCollectionChangeWatcherTriggerMode | ''>) {
    this._watcher.setMode(mode || 'off');
  }

  restart() {
    this.dbxFirebaseCollectionStoreDirective.store.restart();
  }
}
