/**
 * @module Firestore Query Watcher
 *
 * This module provides functionality for watching changes to Firestore query results over time.
 * It tracks document additions, modifications, and removals, and provides an event-based
 * system for reacting to these changes in real-time.
 */
import { groupValues, type Building, build, calculateExpirationDate } from '@dereekb/util';
import { map, type Observable, skip, switchMap, timer, shareReplay } from 'rxjs';
import { type DocumentChange, type QuerySnapshot } from '../types';
import { type FirestoreItemPageIterationInstance, type FirestoreItemPageQueryResult } from './iterator';
import { type ItemPageIteratorResult } from '@dereekb/rxjs';

/**
 * Default delay in milliseconds before a query change watcher begins processing events.
 *
 * A value of 0 means the watcher will start immediately after the first successful page result.
 */
export const DEFAULT_QUERY_CHANGE_WATCHER_DELAY = 0;

/**
 * Configuration for creating a query document change watcher.
 *
 * @template T - The document data type
 */
export interface IterationQueryDocChangeWatcherConfig<T = unknown> {
  /**
   * The iteration instance that will be watched for changes.
   *
   * This instance provides access to the underlying Firestore query and its results,
   * which the watcher will monitor for document changes.
   */
  readonly instance: FirestoreItemPageIterationInstance<T>;

  /**
   * Optional delay in milliseconds before the watcher begins processing events.
   *
   * This delay is applied after the first successful page result is received.
   * Default is 0 (start immediately).
   */
  readonly delay?: number;
}

/**
 * Interface for watching query result changes events.
 *
 * Provides observables for monitoring changes to Firestore query results over time,
 * including document additions, modifications, and removals.
 *
 * @template T - The document data type
 */
export interface IterationQueryDocChangeWatcher<T = unknown> {
  /**
   * Streams all subsequent query snapshots after the initial result.
   *
   * This observable emits the raw QuerySnapshot objects from Firestore,
   * allowing direct access to all query results and their changes.
   */
  readonly stream$: Observable<QuerySnapshot<T>>;

  /**
   * Streams processed change events derived from the query snapshots.
   *
   * This observable transforms the raw query snapshots into structured event
   * objects that categorize document changes into added, removed, and modified
   * groups, making it easier to respond to specific types of changes.
   */
  readonly event$: Observable<IterationQueryDocChangeWatcherEvent<T>>;
}

/**
 * Event representing a set of changes to a Firestore query result.
 *
 * This event captures all document changes that occurred in a single update,
 * categorized by their type (added, removed, modified) along with metadata
 * about when the changes occurred and an overall classification of the event.
 *
 * @template T - The document data type
 */
export interface IterationQueryDocChangeWatcherEvent<T = unknown> extends IterationQueryDocChangeWatcherChangeGroup<T> {
  /**
   * Timestamp when this change event was processed.
   */
  readonly time: Date;

  /**
   * Array of all document changes in this event.
   *
   * Contains the complete set of changes, regardless of their type.
   */
  readonly changes: DocumentChange<T>[];

  /**
   * Classification of this change event based on the types of changes it contains.
   *
   * This provides a quick way to determine the nature of the changes without
   * examining the individual document changes.
   */
  readonly type: IterationQueryDocChangeWatcherChangeType;
}

/**
 * Group of document changes categorized by their change type.
 *
 * This interface organizes document changes into three distinct categories:
 * added, removed, and modified, making it easier to process changes based
 * on their type.
 *
 * @template T - The document data type
 */
export interface IterationQueryDocChangeWatcherChangeGroup<T = unknown> {
  /**
   * Documents that were newly added to the query results.
   */
  readonly added: DocumentChange<T>[];

  /**
   * Documents that were removed from the query results.
   */
  readonly removed: DocumentChange<T>[];

  /**
   * Documents that remained in the query results but had their data modified.
   */
  readonly modified: DocumentChange<T>[];
}

/**
 * Classification of a change event based on the types of document changes it contains.
 *
 * - 'addedAndRemoved': Both additions and removals occurred
 * - 'added': Only additions occurred
 * - 'removed': Only removals occurred
 * - 'modified': Only modifications occurred
 * - 'none': No changes occurred
 */
export type IterationQueryDocChangeWatcherChangeType = 'addedAndRemoved' | 'added' | 'removed' | 'modified' | 'none';

/**
 * Creates a watcher for monitoring changes to Firestore query results.
 *
 * This function sets up observables that track document changes (additions, removals,
 * and modifications) in the results of a Firestore query over time. It provides both
 * raw query snapshots and processed change events, making it easier to react to
 * specific types of changes.
 *
 * @template T - The document data type
 * @param config - Configuration for the watcher, including the iteration instance to watch
 *                and an optional delay before starting to monitor changes
 * @returns A watcher object with observables for streaming changes
 *
 * @example
 * // Create a watcher for changes to active users
 * const usersIterator = firestoreItemPageIterator({
 *   queryFactory: () => collection(firestore, 'users').where('status', '==', 'active'),
 *   pageSize: 10
 * });
 *
 * const watcher = iterationQueryDocChangeWatcher({
 *   instance: usersIterator,
 *   delay: 1000 // wait 1 second after first results before watching for changes
 * });
 *
 * // React to specific change types
 * watcher.event$.subscribe(event => {
 *   if (event.type === 'added') {
 *     console.log('New users added:', event.added.map(change => change.doc.data()));
 *   }
 * });
 */
export function iterationQueryDocChangeWatcher<T = unknown>(config: IterationQueryDocChangeWatcherConfig<T>): IterationQueryDocChangeWatcher<T> {
  const { instance, delay: timeUntilActive = DEFAULT_QUERY_CHANGE_WATCHER_DELAY } = config;

  const stream$ = instance.snapshotIteration.firstSuccessfulPageResults$.pipe(
    switchMap((first) => {
      const { time, stream } = (first.value as ItemPageIteratorResult<FirestoreItemPageQueryResult<T>>).value as FirestoreItemPageQueryResult<T>;
      const beginCheckingAt = calculateExpirationDate({ expiresFromDate: time, expiresIn: timeUntilActive }) as Date;

      // don't start streaming until the given moment.
      return timer(beginCheckingAt).pipe(
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

/**
 * Determines the overall change type for a group of document changes.
 *
 * This function analyzes a change group to classify it based on the types of changes
 * it contains. It follows a priority order for classification:
 * 1. If both additions and removals are present, classify as 'addedAndRemoved'.
 * 2. If only additions are present, classify as 'added'.
 * 3. If only removals are present, classify as 'removed'.
 * 4. If only modifications are present, classify as 'modified'.
 * 5. If no changes are present, classify as 'none'.
 *
 * @template T - The document data type
 * @param group - The change group to classify
 * @returns The overall change type classification
 */
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
