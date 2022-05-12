import { groupValues } from '@dereekb/util';
import { timeHasExpired } from '@dereekb/date';
import { filter, map, Observable, skip, switchMap } from 'rxjs';
import { DocumentChange, QuerySnapshot } from '../types';
import { FirestoreItemPageIterationInstance } from "./iterator";

export const DEFAULT_QUERY_CHANGE_WATCHER_DELAY = 1000 * 8;

export interface IterationQueryChangeWatcherConfig<T> {
  readonly instance: FirestoreItemPageIterationInstance<T>;
  readonly delay?: number;
}

export interface IterationQueryChangeWatcher<T> {

  /**
   * Streams all subsequent query changes.
   */
  readonly stream$: Observable<QuerySnapshot<T>>;

  /**
   * Event stream
   */
  readonly event$: Observable<IterationQueryChangeWatcherEvent<T>>;

  /**
   * Change 
   */
  readonly change$: Observable<IterationQueryChangeWatcherChangeType>;

}

export interface IterationQueryChangeWatcherEvent<T> extends IterationQueryChangeWatcherChangeGroup<T> {
  readonly changes: DocumentChange<T>[];
  readonly type: IterationQueryChangeWatcherChangeType;
}

export interface IterationQueryChangeWatcherChangeGroup<T> {
  readonly added: DocumentChange<T>[];
  readonly removed: DocumentChange<T>[];
  readonly modified: DocumentChange<T>[];
}

export type IterationQueryChangeWatcherChangeType = 'addedAndRemoved' | 'added' | 'removed' | 'modified' | 'none';

export function iterationQueryChangeWatcher<T>(config: IterationQueryChangeWatcherConfig<T>): IterationQueryChangeWatcher<T> {
  const { instance, delay: timeUntilActive = DEFAULT_QUERY_CHANGE_WATCHER_DELAY } = config;
  const stream$ = instance.snapshotIteration.firstSuccessfulPageResults$.pipe(switchMap((first) => {
    const { time, stream } = first.value!.value!;

    // todo: capture the change type.

    return stream().pipe(
      skip(1),  // skip the first value.
      filter(() => timeHasExpired(time, timeUntilActive))
    );
  }));

  const event$ = stream$.pipe(map(event => {
    const changes = event.docChanges();

    const results: IterationQueryChangeWatcherChangeGroup<T> = groupValues(changes, (x) => x.type);
    (results as any).changes = changes;
    (results as any).added = results.added ?? [];
    (results as any).removed = results.removed ?? [];
    (results as any).modified = results.modified ?? [];
    (results as any).type = iterationQueryChangeWatcherChangeTypeForGroup(results);

    return results as IterationQueryChangeWatcherEvent<T>;
  }));

  const change$ = event$.pipe(map(x => x.type));

  return {
    stream$,
    change$,
    event$
  };
}

export function iterationQueryChangeWatcherChangeTypeForGroup<T>(group: IterationQueryChangeWatcherChangeGroup<T>): IterationQueryChangeWatcherChangeType {
  const hasAdded = group.added.length > 0;
  const hasRemoved = group.removed.length > 0;
  let type: IterationQueryChangeWatcherChangeType;

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
