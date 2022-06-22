import { Directive, Input, OnDestroy, OnInit } from '@angular/core';
import { FirestoreDocument } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseCollectionStore } from './store.collection';
import { DbxFirebaseCollectionStoreDirective } from './store.collection.directive';
import { DbxFirebaseCollectionChangeWatcher, dbxFirebaseCollectionChangeWatcher, DbxFirebaseCollectionChangeWatcherEvent, DbxFirebaseCollectionChangeWatcherTriggerMode } from '../loader/collection.change.watcher';
import { Observable } from 'rxjs';
import { dbxFirebaseCollectionChangeTriggerForWatcher } from '../loader/collection.change.trigger';

/**
 * Used to watch query doc changes and respond to them accordingly.
 */
@Directive({
  selector: '[dbxFirebaseCollectionChange]'
})
export class DbxFirebaseCollectionChangeDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> implements DbxFirebaseCollectionChangeWatcher<S>, OnInit, OnDestroy {
  private _watcher = dbxFirebaseCollectionChangeWatcher(this.dbxFirebaseCollectionStoreDirective.store);
  private _trigger = dbxFirebaseCollectionChangeTriggerForWatcher(this._watcher, () => this.restart());

  readonly mode$: Observable<DbxFirebaseCollectionChangeWatcherTriggerMode> = this._watcher.mode$;
  readonly event$: Observable<DbxFirebaseCollectionChangeWatcherEvent> = this._watcher.event$;
  readonly hasChangeAvailable$: Observable<boolean> = this._watcher.hasChangeAvailable$;
  readonly triggered$: Observable<boolean> = this._watcher.triggered$;
  readonly trigger$: Observable<void> = this._watcher.trigger$;

  get store() {
    return this._watcher.store;
  }

  constructor(readonly dbxFirebaseCollectionStoreDirective: DbxFirebaseCollectionStoreDirective<T, D, S>) {}

  ngOnInit(): void {
    this._trigger.init();
  }

  ngOnDestroy(): void {
    this._watcher.destroy();
    this._trigger.destroy();
  }

  @Input('dbxFirebaseCollectionChange')
  get mode(): DbxFirebaseCollectionChangeWatcherTriggerMode {
    return this._watcher.mode;
  }

  set mode(mode: Maybe<DbxFirebaseCollectionChangeWatcherTriggerMode | ''>) {
    this._watcher.mode = mode || 'off';
  }

  restart() {
    this.dbxFirebaseCollectionStoreDirective.store.restart();
  }
}
