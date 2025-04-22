import { flattenArray } from '@dereekb/util';
import { type QueryDocumentSnapshot, type QuerySnapshot } from '../types';
import { type IterateFirestoreDocumentSnapshotCheckpointsConfig, type IterateFirestoreDocumentSnapshotCheckpointsResult, type IterateFirestoreDocumentSnapshotPairBatchesConfig, iterateFirestoreDocumentSnapshotCheckpoints, iterateFirestoreDocumentSnapshotPairBatches } from './query.iterate';
import { type FirestoreDocument } from '../accessor/document';
import { type FirestoreDocumentSnapshotDataPairWithData } from '../accessor/document.utility';

// MARK: Iterate Document Snapshot Pairs
/**
 * Configuration for loading all document snapshots with their associated data as pairs.
 *
 * This interface defines the options for retrieving all document snapshots that match
 * specific criteria, along with their associated data, in a single batch operation.
 * It supports pagination via the checkpoint system for efficient handling of large result sets.
 *
 * @template T - The document data type
 * @template D - The FirestoreDocument implementation type (defaults to FirestoreDocument<T>)
 */
export interface LoadAllFirestoreDocumentSnapshotPairsConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Pick<IterateFirestoreDocumentSnapshotPairBatchesConfig<T, unknown, D>, 'documentAccessor' | 'queryFactory' | 'constraintsFactory' | 'dynamicConstraints' | 'totalSnapshotsLimit' | 'handleRepeatCursor' | 'filterCheckpointSnapshots' | 'limitPerCheckpoint'> {
  /**
   * Optional callback function to process each batch of snapshot pairs as they are loaded.
   *
   * This function is called once for each batch (checkpoint) of results, allowing for
   * batch processing of documents without waiting for all results to be collected.
   *
   * @param snapshotDataPairs - Array of document snapshots with their associated data
   * @param batchIndex - Zero-based index of the current batch
   * @returns A promise that resolves when batch processing is complete
   */
  iterateSnapshotPairsBatch?(snapshotDataPairs: FirestoreDocumentSnapshotDataPairWithData<D>[], batchIndex: number): Promise<void>;
}

/**
 * Result of loading all document snapshots with their associated data as pairs.
 *
 * Contains the complete array of document snapshot pairs and metadata about the
 * query execution, such as the number of checkpoints processed and whether any
 * limits were reached.
 *
 * @template T - The document data type
 * @template D - The FirestoreDocument implementation type (defaults to FirestoreDocument<T>)
 */
export interface LoadAllFirestoreDocumentSnapshotPairsResult<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Pick<IterateFirestoreDocumentSnapshotCheckpointsResult, 'totalCheckpoints' | 'totalSnapshotsVisited' | 'totalSnapshotsLimitReached'> {
  /**
   * Array of all document snapshots with their associated data.
   *
   * Each item in the array contains both the Firestore document snapshot and
   * the data extracted from it, along with additional metadata.
   */
  readonly snapshotPairs: FirestoreDocumentSnapshotDataPairWithData<D>[];
}

/**
 * Loads all document snapshots that match the specified criteria, along with their associated data,
 * into a single array.
 *
 * This function uses the paginated checkpoint system to efficiently retrieve potentially large
 * result sets in batches, then combines them into a single result array. It supports optional
 * batch processing while loading.
 *
 * @template T - The document data type
 * @template D - The FirestoreDocument implementation type (defaults to FirestoreDocument<T>)
 * @param config - Configuration options for the loading operation
 * @returns Promise resolving to the result containing all matching document snapshot pairs
 *
 * @example
 * // Load all active user documents with their data
 * const result = await loadAllFirestoreDocumentSnapshotPairs({
 *   queryFactory: () => collection(firestore, 'users'),
 *   constraintsFactory: () => [where('status', '==', 'active')],
 *   documentAccessor: userAccessorFactory,
 *   // Process batches as they load
 *   iterateSnapshotPairsBatch: async (pairs, index) => {
 *     console.log(`Processing batch ${index} with ${pairs.length} users`);
 *   }
 * });
 *
 * console.log(`Loaded ${result.snapshotPairs.length} user documents`);
 */
export async function loadAllFirestoreDocumentSnapshotPairs<T, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: LoadAllFirestoreDocumentSnapshotPairsConfig<T, D>): Promise<LoadAllFirestoreDocumentSnapshotPairsResult<T, D>> {
  const { documentAccessor, queryFactory, constraintsFactory, dynamicConstraints, totalSnapshotsLimit, limitPerCheckpoint, handleRepeatCursor, filterCheckpointSnapshots, iterateSnapshotPairsBatch: optionalIterateSnapshotPairsBatch } = config;

  const allDocumentGroups: FirestoreDocumentSnapshotDataPairWithData<D>[][] = [];
  const { totalCheckpoints, totalSnapshotsVisited, totalSnapshotsLimitReached } = await iterateFirestoreDocumentSnapshotPairBatches({
    documentAccessor,
    queryFactory,
    constraintsFactory,
    dynamicConstraints,
    totalSnapshotsLimit,
    handleRepeatCursor,
    filterCheckpointSnapshots,
    limitPerCheckpoint,
    maxParallelCheckpoints: 1, // run serially since we want the results in order
    iterateSnapshotPairsBatch: async (snapshotDataPairs: FirestoreDocumentSnapshotDataPairWithData<D>[], batchIndex: number) => {
      allDocumentGroups.push(snapshotDataPairs);

      if (optionalIterateSnapshotPairsBatch) {
        await optionalIterateSnapshotPairsBatch(snapshotDataPairs, batchIndex);
      }
    }
  });

  const snapshotPairs: FirestoreDocumentSnapshotDataPairWithData<D>[] = flattenArray(allDocumentGroups);
  return {
    snapshotPairs,
    totalCheckpoints,
    totalSnapshotsVisited,
    totalSnapshotsLimitReached
  };
}

// MARK: Iterate Document Snapshots
/**
 * Configuration for loading all document snapshots that match specific criteria.
 *
 * This interface defines the options for retrieving all document snapshots in a single batch
 * operation, without their associated data. It supports pagination via the checkpoint system
 * for efficient handling of large result sets.
 *
 * @template T - The document data type
 */
export interface LoadAllFirestoreDocumentSnapshotsConfig<T> extends Pick<IterateFirestoreDocumentSnapshotCheckpointsConfig<T, unknown>, 'queryFactory' | 'constraintsFactory' | 'dynamicConstraints' | 'totalSnapshotsLimit' | 'handleRepeatCursor' | 'filterCheckpointSnapshots' | 'limitPerCheckpoint'> {
  /**
   * Optional callback function to process each batch of snapshots as they are loaded.
   *
   * This function is called once for each batch (checkpoint) of results, allowing for
   * batch processing of documents without waiting for all results to be collected.
   *
   * @param snapshots - Array of document snapshots in the current batch
   * @param query - The complete query snapshot for the current batch
   * @returns A promise that resolves when batch processing is complete
   */
  iterateSnapshotsForCheckpoint?(snapshots: QueryDocumentSnapshot<T>[], query: QuerySnapshot<T>): Promise<void>;
}

/**
 * Result of loading all document snapshots that match specific criteria.
 *
 * Contains the complete array of document snapshots and metadata about the
 * query execution, such as the number of checkpoints processed and whether any
 * limits were reached.
 *
 * @template T - The document data type
 */
export interface LoadAllFirestoreDocumentSnapshotsResult<T> extends Pick<IterateFirestoreDocumentSnapshotCheckpointsResult, 'totalCheckpoints' | 'totalSnapshotsVisited' | 'totalSnapshotsLimitReached'> {
  /**
   * Array of all document snapshots that matched the query criteria.
   *
   * These snapshots can be used to access document data, IDs, and references.
   */
  readonly snapshots: QueryDocumentSnapshot<T>[];
}

/**
 * Loads all document snapshots that match the specified criteria into a single array.
 *
 * This function uses the paginated checkpoint system to efficiently retrieve potentially large
 * result sets in batches, then combines them into a single result array. It supports optional
 * batch processing while loading.
 *
 * Unlike loadAllFirestoreDocumentSnapshotPairs, this function only retrieves the document
 * snapshots without automatically loading their associated data.
 *
 * @template T - The document data type
 * @param config - Configuration options for the loading operation
 * @returns Promise resolving to the result containing all matching document snapshots
 *
 * @example
 * // Load all documents created in the last 24 hours
 * const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
 * const result = await loadAllFirestoreDocumentSnapshot({
 *   queryFactory: () => collection(firestore, 'events'),
 *   constraintsFactory: () => [where('createdAt', '>=', yesterday), orderBy('createdAt')],
 *   totalSnapshotsLimit: 1000, // Stop after 1000 documents
 *   // Process batches as they load
 *   iterateSnapshotsForCheckpoint: async (snapshots, query) => {
 *     console.log(`Processing batch with ${snapshots.length} events`);
 *   }
 * });
 *
 * console.log(`Loaded ${result.snapshots.length} event documents`);
 */
export async function loadAllFirestoreDocumentSnapshot<T>(config: LoadAllFirestoreDocumentSnapshotsConfig<T>): Promise<LoadAllFirestoreDocumentSnapshotsResult<T>> {
  const { queryFactory, constraintsFactory, dynamicConstraints, totalSnapshotsLimit, limitPerCheckpoint, handleRepeatCursor, filterCheckpointSnapshots, iterateSnapshotsForCheckpoint } = config;

  const allDocumentGroups: QueryDocumentSnapshot<T>[][] = [];

  const { totalCheckpoints, totalSnapshotsVisited, totalSnapshotsLimitReached } = await iterateFirestoreDocumentSnapshotCheckpoints({
    queryFactory,
    constraintsFactory,
    dynamicConstraints,
    totalSnapshotsLimit,
    handleRepeatCursor,
    filterCheckpointSnapshots,
    limitPerCheckpoint,
    maxParallelCheckpoints: 1, // run serially since we want the results in order
    iterateCheckpoint: async (snapshots: QueryDocumentSnapshot<T>[], query: QuerySnapshot<T>) => {
      if (snapshots.length) {
        allDocumentGroups.push(snapshots); // add to snapshots array

        if (iterateSnapshotsForCheckpoint) {
          await iterateSnapshotsForCheckpoint(snapshots, query);
        }
      }

      return []; // return nothing
    }
  });

  const snapshots: QueryDocumentSnapshot<T>[] = flattenArray(allDocumentGroups);
  return {
    snapshots,
    totalCheckpoints,
    totalSnapshotsVisited,
    totalSnapshotsLimitReached
  };
}
