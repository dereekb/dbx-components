import { Directive, Input, OnDestroy, OnInit } from '@angular/core';
import { FirestoreDocument } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseCollectionStore } from './store.collection';
import { DbxFirebaseCollectionStoreDirective } from './store.collection.directive';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFirebaseCollectionChangeWatcher, dbxFirebaseCollectionChangeWatcher, DbxFirebaseCollectionChangeWatcherEvent, DbxFirebaseCollectionChangeWatcherTriggerMode } from '../loader/collection.change.watcher';
import { Observable } from 'rxjs';

/**
 * Used to watch query doc changes and respond to them accordingly.
 */
@Directive({
  selector: '[dbxFirebaseCollectionChange]'
})
export class DbxFirebaseCollectionChangeDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> extends AbstractSubscriptionDirective implements DbxFirebaseCollectionChangeWatcher, OnInit, OnDestroy {
  private _watcher = dbxFirebaseCollectionChangeWatcher<T, D, S>(this.dbxFirebaseCollectionStoreDirective.store);

  readonly mode$: Observable<DbxFirebaseCollectionChangeWatcherTriggerMode> = this._watcher.mode$;
  readonly event$: Observable<DbxFirebaseCollectionChangeWatcherEvent> = this._watcher.event$;
  readonly hasChangeAvailable$: Observable<boolean> = this._watcher.hasChangeAvailable$;
  readonly triggered$: Observable<boolean> = this._watcher.triggered$;
  readonly trigger$: Observable<void> = this._watcher.trigger$;

  constructor(readonly dbxFirebaseCollectionStoreDirective: DbxFirebaseCollectionStoreDirective<T, D, S>) {
    super();
  }
  ngOnInit(): void {
    this.sub = this._watcher.trigger$.subscribe(() => {
      this.restart();
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._watcher.destroy();
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
