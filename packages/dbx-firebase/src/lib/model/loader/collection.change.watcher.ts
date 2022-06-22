import { IterationQueryDocChangeWatcherChangeType, IterationQueryDocChangeWatcherEvent } from '@dereekb/firebase';
import { SubscriptionObject } from '@dereekb/rxjs';
import { Destroyable } from '@dereekb/util';
import { filter, take, map, BehaviorSubject, distinctUntilChanged, Observable, switchMap, startWith, shareReplay, combineLatest } from 'rxjs';
import { DbxFirebaseCollectionLoaderAccessor } from './collection.loader';

/**
 * DbxFirebaseCollectionChangeWatcher trigger modes
 * - auto: will automatically call trigger
 * - off: will never call trigger
 */
export type DbxFirebaseCollectionChangeWatcherTriggerMode = 'auto' | 'off';
export type DbxFirebaseCollectionChangeWatcherEvent = Pick<IterationQueryDocChangeWatcherEvent<unknown>, 'time' | 'type'>;

/**
 * Used to watch a DbxFirebaseCollectionLoaderAccessor for when the query changes and
 */
export interface DbxFirebaseCollectionChangeWatcher<S extends DbxFirebaseCollectionLoaderAccessor<any>> {
  readonly store: S;
  /**
   * Current mode
   */
  readonly mode$: Observable<DbxFirebaseCollectionChangeWatcherTriggerMode>;
  /**
   * Stream of events
   */
  readonly event$: Observable<DbxFirebaseCollectionChangeWatcherEvent>;
  readonly hasChangeAvailable$: Observable<boolean>;
  /**
   * Current trigger state. Based on the hasChangeAvailable$ state and current mode.
   */
  readonly triggered$: Observable<boolean>;
  /**
   * Trigger emitter. Only emits when triggered$ is/becomes true.
   */
  readonly trigger$: Observable<void>;
  mode: DbxFirebaseCollectionChangeWatcherTriggerMode;
}

/**
 * DbxFirebaseCollectionChangeWatcher instance
 */
export class DbxFirebaseCollectionChangeWatcherInstance<S extends DbxFirebaseCollectionLoaderAccessor<any>> implements Destroyable {
  private readonly _mode = new BehaviorSubject<DbxFirebaseCollectionChangeWatcherTriggerMode>(this._initialMode);
  private readonly _sub = new SubscriptionObject();

  readonly mode$ = this._mode.pipe(distinctUntilChanged());

  readonly event$: Observable<DbxFirebaseCollectionChangeWatcherEvent> = this.store.queryChangeWatcher$.pipe(
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

  readonly triggered$: Observable<boolean> = combineLatest([this.mode$, this.hasChangeAvailable$]).pipe(map(([mode, hasChange]) => mode === 'auto' && hasChange));

  readonly trigger$: Observable<void> = this.triggered$.pipe(
    filter((triggered) => triggered),
    map(() => undefined)
  );

  constructor(readonly store: S, private _initialMode: DbxFirebaseCollectionChangeWatcherTriggerMode = 'off') {}

  destroy(): void {
    this._sub.destroy();
    this._mode.complete();
  }

  get mode(): DbxFirebaseCollectionChangeWatcherTriggerMode {
    return this._mode.value;
  }

  set mode(mode: DbxFirebaseCollectionChangeWatcherTriggerMode) {
    this._mode.next(mode);
  }
}

export function dbxFirebaseCollectionChangeWatcher<S extends DbxFirebaseCollectionLoaderAccessor<any>>(store: S, mode?: DbxFirebaseCollectionChangeWatcherTriggerMode): DbxFirebaseCollectionChangeWatcherInstance<S> {
  return new DbxFirebaseCollectionChangeWatcherInstance(store, mode);
}
