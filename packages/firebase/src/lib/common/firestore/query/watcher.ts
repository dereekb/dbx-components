import { groupValues, type Building, build } from '@dereekb/util';
import { toExpires } from '@dereekb/date';
import { map, type Observable, skip, switchMap, timer, shareReplay } from 'rxjs';
import { type DocumentChange, type QuerySnapshot } from '../types';
import { type FirestoreItemPageIterationInstance, type FirestoreItemPageQueryResult } from './iterator';
import { type ItemPageIteratorResult } from '@dereekb/rxjs';

export const DEFAULT_QUERY_CHANGE_WATCHER_DELAY = 0;

export interface IterationQueryDocChangeWatcherConfig<T = unknown> {
  readonly instance: FirestoreItemPageIterationInstance<T>;
  readonly delay?: number;
}

/**
 * Interface for watching query result changes events.
 */
export interface IterationQueryDocChangeWatcher<T = unknown> {
  /**
   * Streams all subsequent query changes.
   */
  readonly stream$: Observable<QuerySnapshot<T>>;

  /**
   * Event stream
   */
  readonly event$: Observable<IterationQueryDocChangeWatcherEvent<T>>;
}

export interface IterationQueryDocChangeWatcherEvent<T = unknown> extends IterationQueryDocChangeWatcherChangeGroup<T> {
  readonly time: Date;
  readonly changes: DocumentChange<T>[];
  readonly type: IterationQueryDocChangeWatcherChangeType;
}

export interface IterationQueryDocChangeWatcherChangeGroup<T = unknown> {
  readonly added: DocumentChange<T>[];
  readonly removed: DocumentChange<T>[];
  readonly modified: DocumentChange<T>[];
}

export type IterationQueryDocChangeWatcherChangeType = 'addedAndRemoved' | 'added' | 'removed' | 'modified' | 'none';

export function iterationQueryDocChangeWatcher<T = unknown>(config: IterationQueryDocChangeWatcherConfig<T>): IterationQueryDocChangeWatcher<T> {
  const { instance, delay: timeUntilActive = DEFAULT_QUERY_CHANGE_WATCHER_DELAY } = config;

  const stream$ = instance.snapshotIteration.firstSuccessfulPageResults$.pipe(
    switchMap((first) => {
      const { time, stream } = (first.value as ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>).value as FirestoreItemPageQueryResult<T>;
      const beginCheckingAt = toExpires(time, timeUntilActive);

      // don't start streaming until the given moment.
      return timer(beginCheckingAt.expiresAt ?? new Date()).pipe(
        switchMap(() =>
          stream().pipe(
            skip(1) // skip the first value, as it should be equivalent to the query results given.
          )
        )
      );
    }),
    shareReplay(1)
  );

  const event$ = stream$.pipe(
    map((event) => {
      const changes = event.docChanges();

      const results = build({
        base: groupValues(changes, (x) => x.type) as Building<IterationQueryDocChangeWatcherEvent<T>>,
        build: (x) => {
          x.time = new Date();
          x.changes = changes;
          x.added = x.added ?? [];
          x.removed = x.removed ?? [];
          x.modified = x.modified ?? [];
          x.type = iterationQueryDocChangeWatcherChangeTypeForGroup(x as IterationQueryDocChangeWatcherEvent<T>);
        }
      });

      return results;
    }),
    shareReplay(1)
  );

  return {
    stream$,
    event$
  };
}

export function iterationQueryDocChangeWatcherChangeTypeForGroup<T = unknown>(group: IterationQueryDocChangeWatcherChangeGroup<T>): IterationQueryDocChangeWatcherChangeType {
  const hasAdded = group.added.length > 0;
  const hasRemoved = group.removed.length > 0;
  let type: IterationQueryDocChangeWatcherChangeType;

  if (hasAdded && hasRemoved) {
    type = 'addedAndRemoved';
  } else if (hasAdded) {
    type = 'added';
  } else if (hasRemoved) {
    type = 'removed';
  } else if (group.modified.length > 0) {
    type = 'modified';
  } else {
    type = 'none';
  }

  return type;
}
