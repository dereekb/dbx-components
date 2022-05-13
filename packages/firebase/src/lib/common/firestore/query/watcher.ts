import { groupValues } from '@dereekb/util';
import { toExpires } from '@dereekb/date';
import { map, Observable, skip, switchMap, timer, shareReplay } from 'rxjs';
import { DocumentChange, QuerySnapshot } from '../types';
import { FirestoreItemPageIterationInstance } from "./iterator";

export const DEFAULT_QUERY_CHANGE_WATCHER_DELAY = 0;

export interface IterationQueryDocChangeWatcherConfig<T = any> {
  readonly instance: FirestoreItemPageIterationInstance<T>;
  readonly delay?: number;
}

/**
 * Interface for watching query result changes events.
 */
export interface IterationQueryDocChangeWatcher<T = any> {

  /**
   * Streams all subsequent query changes.
   */
  readonly stream$: Observable<QuerySnapshot<T>>;

  /**
   * Event stream
   */
  readonly event$: Observable<IterationQueryDocChangeWatcherEvent<T>>;

}

export interface IterationQueryDocChangeWatcherEvent<T = any> extends IterationQueryDocChangeWatcherChangeGroup<T> {
  readonly time: Date;
  readonly changes: DocumentChange<T>[];
  readonly type: IterationQueryDocChangeWatcherChangeType;
}

export interface IterationQueryDocChangeWatcherChangeGroup<T = any> {
  readonly added: DocumentChange<T>[];
  readonly removed: DocumentChange<T>[];
  readonly modified: DocumentChange<T>[];
}

export type IterationQueryDocChangeWatcherChangeType = 'addedAndRemoved' | 'added' | 'removed' | 'modified' | 'none';

export function iterationQueryDocChangeWatcher<T = any>(config: IterationQueryDocChangeWatcherConfig<T>): IterationQueryDocChangeWatcher<T> {
  const { instance, delay: timeUntilActive = DEFAULT_QUERY_CHANGE_WATCHER_DELAY } = config;

  const stream$ = instance.snapshotIteration.firstSuccessfulPageResults$.pipe(
    switchMap((first) => {
      const { time, stream } = first.value!.value!;
      const beginCheckingAt = toExpires(time, timeUntilActive);

      // don't start streaming until the given moment.
      return timer(beginCheckingAt.expiresAt ?? new Date()).pipe(switchMap(() => stream().pipe(
        skip(1)  // skip the first value, as it should be equivalent to the query results given.
      )));
    }),
    shareReplay(1)
  );

  const event$ = stream$.pipe(
    map(event => {
      const changes = event.docChanges();

      const results: any = groupValues(changes, (x) => x.type);
      results.time = new Date();
      results.changes = changes;
      results.added = results.added ?? [];
      results.removed = results.removed ?? [];
      results.modified = results.modified ?? [];
      results.type = iterationQueryDocChangeWatcherChangeTypeForGroup(results);

      return results as IterationQueryDocChangeWatcherEvent<T>;
    }),
    shareReplay(1)
  );

  return {
    stream$,
    event$
  };
}

export function iterationQueryDocChangeWatcherChangeTypeForGroup<T = any>(group: IterationQueryDocChangeWatcherChangeGroup<T>): IterationQueryDocChangeWatcherChangeType {
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
