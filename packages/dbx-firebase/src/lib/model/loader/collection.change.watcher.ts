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
   * Current mode observable
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
}

/**
 * DbxFirebaseCollectionChangeWatcher instance that can be destroyed and the mode changed.
 */
export interface DbxFirebaseCollectionChangeWatcherInstance<S extends DbxFirebaseCollectionLoaderAccessor<any>> extends DbxFirebaseCollectionChangeWatcher<S>, Destroyable {
  /**
   * Changes the mode
   */
  setMode(mode: DbxFirebaseCollectionChangeWatcherTriggerMode): void;
}

export function dbxFirebaseCollectionChangeWatcher<S extends DbxFirebaseCollectionLoaderAccessor<any>>(store: S, initialMode?: DbxFirebaseCollectionChangeWatcherTriggerMode): DbxFirebaseCollectionChangeWatcherInstance<S> {
  const _mode = new BehaviorSubject<DbxFirebaseCollectionChangeWatcherTriggerMode>(initialMode ?? 'off');
  const _sub = new SubscriptionObject();

  const mode$ = _mode.pipe(distinctUntilChanged());

  const event$: Observable<DbxFirebaseCollectionChangeWatcherEvent> = store.queryChangeWatcher$.pipe(
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

  const hasChangeAvailable$: Observable<boolean> = event$.pipe(
    map((x) => x.type !== 'none'),
    shareReplay(1)
  );

  const triggered$: Observable<boolean> = combineLatest([mode$, hasChangeAvailable$]).pipe(map(([mode, hasChange]) => mode === 'auto' && hasChange));

  const trigger$: Observable<void> = triggered$.pipe(
    filter((triggered) => triggered),
    map(() => undefined)
  );

  function destroy() {
    _sub.destroy();
    _mode.complete();
  }

  function setMode(mode: DbxFirebaseCollectionChangeWatcherTriggerMode) {
    _mode.next(mode);
  }

  const instance: DbxFirebaseCollectionChangeWatcherInstance<S> = {
    store,
    mode$,
    event$,
    hasChangeAvailable$,
    triggered$,
    trigger$,
    destroy,
    setMode
  };

  return instance;
}
