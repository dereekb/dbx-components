import { shareReplay, startWith, Observable, switchMap, BehaviorSubject, distinctUntilChanged, combineLatest, map, filter, take } from 'rxjs';
import { Directive, Input, OnDestroy, OnInit } from '@angular/core';
import { FirestoreDocument, IterationQueryDocChangeWatcherChangeType, IterationQueryDocChangeWatcherEvent } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseCollectionStore } from './store.collection';
import { DbxFirebaseCollectionStoreDirective } from './store.collection.directive';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';

/**
 * Refresh mode
 */
export type DbxFirebaseCollectionChangeDirectiveMode = 'auto' | 'manual';
export type DbxFirebaseCollectionChangeDirectiveEvent = Pick<IterationQueryDocChangeWatcherEvent<unknown>, 'time' | 'type'>;

/**
 * Used to watch query doc changes and respond to them accordingly.
 */
@Directive({
  selector: '[dbxFirebaseCollectionChange]'
})
export class DbxFirebaseCollectionChangeDirective<T = unknown, D extends FirestoreDocument<T> = FirestoreDocument<T>, S extends DbxFirebaseCollectionStore<T, D> = DbxFirebaseCollectionStore<T, D>> extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private _mode = new BehaviorSubject<DbxFirebaseCollectionChangeDirectiveMode>('manual');
  readonly mode$ = this._mode.pipe(distinctUntilChanged());

  readonly event$: Observable<DbxFirebaseCollectionChangeDirectiveEvent> = this.dbxFirebaseCollectionStoreDirective.store.queryChangeWatcher$.pipe(
    switchMap((x) =>
      x.event$.pipe(
        filter((x) => x.type !== 'none'), // do not share 'none' events.
        take(1), // only need one event to mark as change is available.
        startWith({
          time: new Date(),
          type: 'none' as IterationQueryDocChangeWatcherChangeType
        })
      )
    ),
    shareReplay(1)
  );

  readonly hasChangeAvailable$: Observable<boolean> = this.event$.pipe(
    map((x) => x.type !== 'none'),
    shareReplay(1)
  );

  constructor(readonly dbxFirebaseCollectionStoreDirective: DbxFirebaseCollectionStoreDirective<T, D, S>) {
    super();
  }

  ngOnInit(): void {
    this.sub = combineLatest([this.mode$, this.hasChangeAvailable$])
      .pipe(filter(([mode, hasChange]) => mode === 'auto' && hasChange))
      .subscribe(() => {
        this.restart();
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._mode.complete();
  }

  @Input('dbxFirebaseCollectionChange')
  get mode(): DbxFirebaseCollectionChangeDirectiveMode {
    return this._mode.value;
  }

  set mode(mode: Maybe<DbxFirebaseCollectionChangeDirectiveMode | ''>) {
    this._mode.next(mode || 'manual');
  }

  restart() {
    this.dbxFirebaseCollectionStoreDirective.store.restart();
  }
}
