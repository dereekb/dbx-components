/**
 * @module Firestore Query Iteration
 *
 * This module provides a comprehensive system for iterating through Firestore query results
 * with support for pagination, batching, and parallelism. It enables efficient processing of
 * large result sets by using cursor-based pagination (via "checkpoints") and various iteration
 * strategies.
 */
import { type GetterOrValue, type PromiseOrValue, type IndexRef, type Maybe, asGetter, lastValue, type PerformAsyncTasksConfig, performAsyncTasks, batch, type IndexNumber, type PerformAsyncTasksResult, type FactoryWithRequiredInput, performTasksFromFactoryInParallelFunction, getValueFromGetter, type Milliseconds, mapIdentityFunction, type AllowValueOnceFilter, allowValueOnceFilter, type ReadKeyFunction } from '@dereekb/util';
import { type FirestoreDocument, type LimitedFirestoreDocumentAccessor, firestoreDocumentSnapshotPairsLoaderInstance, type FirestoreDocumentSnapshotDataPairWithData } from '../accessor';
import { type QueryDocumentSnapshot, type QuerySnapshot, type DocumentSnapshot } from '../types';
import { type FirestoreQueryConstraint, startAfter, limit } from './constraint';
import { type FirestoreQueryFactory } from './query';
import { type FirestoreModelKey } from '../collection/collection';
import { readFirestoreModelKeyFromDocumentSnapshot } from './query.util';

// MARK: Iterate Snapshot Pairs
/**
 * Configuration for iterating through Firestore document snapshots with their associated data as pairs.
 *
 * @template T - The document data type
 * @template R - The result type of processing each snapshot pair
 * @template D - The FirestoreDocument implementation type (defaults to FirestoreDocument<T>)
 */
export interface IterateFirestoreDocumentSnapshotPairsConfig<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Omit<IterateFirestoreDocumentSnapshotsConfig<T, R>, 'iterateSnapshot'> {
  /**
   * Document accessor to retrieve the documents for the references.
   */
  readonly documentAccessor: LimitedFirestoreDocumentAccessor<T, D>;
  /**
   * The iterate function per each snapshot.
   */
  iterateSnapshotPair(snapshot: FirestoreDocumentSnapshotDataPairWithData<D>): Promise<R>;
}

/**
 * Iterates through the results of a Firestore query by each FirestoreDocumentSnapshotDataPairWithData.
 *
 * This function efficiently handles pagination through potentially large result sets by using
 * the checkpoint system to load documents in batches. For each document snapshot, it loads the
 * associated data using the provided document accessor, then passes the combined pair to the
 * processing function.
 *
 * @template T - The document data type
 * @template R - The result type of processing each snapshot pair
 * @template D - The FirestoreDocument implementation type (defaults to FirestoreDocument<T>)
 * @param config - Configuration for the iteration, including the document accessor and processing function
 * @returns A promise that resolves to the result of the iteration, including statistics about checkpoints and snapshots processed
 */
export async function iterateFirestoreDocumentSnapshotPairs<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: IterateFirestoreDocumentSnapshotPairsConfig<T, R, D>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshotPair, documentAccessor } = config;
  const loadPairForSnapshot = firestoreDocumentSnapshotPairsLoaderInstance<T, D>(documentAccessor as LimitedFirestoreDocumentAccessor<T, D>);

  return iterateFirestoreDocumentSnapshots({
    ...config,
    iterateSnapshot: async (snapshot) => {
      const pair = loadPairForSnapshot(snapshot);
      return iterateSnapshotPair(pair);
    }
  });
}

// MARK: Iterate Snapshots
/**
 * Configuration for iterating through Firestore document snapshots individually.
 *
 * This interface provides settings for processing each document snapshot one by one,
 * rather than in batches.
 *
 * @template T - The document data type
 * @template R - The result type of processing each snapshot
 */
export interface IterateFirestoreDocumentSnapshotsConfig<T, R> extends Omit<IterateFirestoreDocumentSnapshotBatchesConfig<T, IterateFirestoreDocumentSnapshotsResult<T, R>>, 'iterateSnapshotBatch' | 'maxParallelCheckpoints'> {
  /**
   * The iterate function per each snapshot individually.
   *
   * This function is called once for each document snapshot encountered during iteration.
   *
   * @param snapshot - The document snapshot to process
   * @returns A promise resolving to the result of processing this snapshot
   */
  iterateSnapshot(snapshot: QueryDocumentSnapshot<T>): Promise<R>;
  /**
   * (Optional) Additional config for the snapshot's PerformAsyncTasks call. By default uses the performTasksConfig value.
   *
   * This allows fine-tuning the parallelism, batching, and error handling when
   * processing the individual snapshots within a checkpoint batch.
   */
  readonly snapshotsPerformTasksConfig?: Partial<PerformAsyncTasksConfig<QueryDocumentSnapshot<T>>>;
}

/**
 * Result of processing individual document snapshots during iteration.
 *
 * Contains the combined results of all processed snapshots, including successful results,
 * error information, and statistics about the processing operation.
 *
 * @template T - The document data type
 * @template R - The result type of processing each snapshot
 */
export type IterateFirestoreDocumentSnapshotsResult<T, R> = PerformAsyncTasksResult<QueryDocumentSnapshot<T>, R>;

/**
 * Iterates through the results of a Firestore query by each document snapshot by itself.
 *
 * This function efficiently handles pagination through potentially large result sets by using
 * the checkpoint system to load documents in batches. Each document snapshot is then processed
 * individually using the provided processing function.
 *
 * @template T - The document data type
 * @template R - The result type of processing each snapshot
 * @param config - Configuration for the iteration, including the snapshot processing function
 * @returns A promise that resolves to the result of the iteration, including statistics about checkpoints and snapshots processed
 */
export async function iterateFirestoreDocumentSnapshots<T, R>(config: IterateFirestoreDocumentSnapshotsConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshot, performTasksConfig, snapshotsPerformTasksConfig } = config;
  return iterateFirestoreDocumentSnapshotBatches<T, IterateFirestoreDocumentSnapshotsResult<T, R>>({
    ...config,
    maxParallelCheckpoints: 1,
    iterateSnapshotBatch: async (docSnapshots) => {
      const performTasksResult = await performAsyncTasks(docSnapshots, iterateSnapshot, {
        sequential: true, // sequential by default
        ...(snapshotsPerformTasksConfig ?? { ...performTasksConfig, nonConcurrentTaskKeyFactory: undefined, beforeRetry: undefined }) // don't pass the nonConcurrentTaskKeyFactory
      });

      return performTasksResult;
    }
  });
}

// MARK: Iterate Snapshot Pair Batches
/**
 * Config for iterateFirestoreDocumentSnapshots().
 *
 * This interface defines the configuration for processing batches of document snapshots
 * with their associated data. It supports efficient batch processing operations on related
 * documents.
 *
 * @template T - The document data type
 * @template R - The result type of processing each batch
 * @template D - The FirestoreDocument implementation type
 */
export interface IterateFirestoreDocumentSnapshotPairBatchesConfig<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Omit<IterateFirestoreDocumentSnapshotBatchesConfig<T, R>, 'iterateSnapshotBatch'> {
  /**
   * Document accessor to retrieve the documents for the references.
   */
  readonly documentAccessor: LimitedFirestoreDocumentAccessor<T, D>;
  /**
   * The iterate function per each snapshot batch.
   */
  iterateSnapshotPairsBatch(snapshotDataPairs: FirestoreDocumentSnapshotDataPairWithData<D>[], batchIndex: number): Promise<R>;
}

/**
 * Iterates through the results of a Firestore query by each FirestoreDocumentSnapshotDataPair.
 *
 * @param config
 * @returns
 */
export async function iterateFirestoreDocumentSnapshotPairBatches<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: IterateFirestoreDocumentSnapshotPairBatchesConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshotPairsBatch, documentAccessor } = config;
  const loadPairForSnapshot = firestoreDocumentSnapshotPairsLoaderInstance<T, D>(documentAccessor as LimitedFirestoreDocumentAccessor<T, D>);

  return iterateFirestoreDocumentSnapshotBatches({
    ...config,
    maxParallelCheckpoints: 1,
    iterateSnapshotBatch: async (snapshots, batchIndex) => {
      const pairs = snapshots.map(loadPairForSnapshot) as FirestoreDocumentSnapshotDataPairWithData<D>[];
      return iterateSnapshotPairsBatch(pairs, batchIndex);
    }
  });
}

// MARK: Iterate Snapshot Batches
/**
 * Single batch result from iterateFirestoreDocumentSnapshotBatches().
 *
 * Contains the batch index, the snapshots, and the final result for this batch.
 * Used to track the processing results for each batch of documents processed
 * during iteration.
 *
 * @template T - The document data type
 * @template R - The result type from processing the batch
 */
export interface IterateFirestoreDocumentSnapshotBatchesResult<T, R> extends IndexRef {
  /***
   * Batch index number
   */
  readonly i: IndexNumber;
  /**
   * Document snapshots in this batch.
   */
  readonly snapshots: QueryDocumentSnapshot<T>[];
  /**
   * Result for this batch.
   */
  readonly result: R;
}

/**
 * Config for iterateFirestoreDocumentSnapshots().
 */
export interface IterateFirestoreDocumentSnapshotBatchesConfig<T, R> extends Omit<IterateFirestoreDocumentSnapshotCheckpointsConfig<T, IterateFirestoreDocumentSnapshotBatchesResult<T, R>>, 'iterateCheckpoint'> {
  /**
   * Max number of documents per batch. Defaults to 25.
   *
   * If null is then all snapshots will be processed in a single batch.
   */
  readonly batchSize?: Maybe<number>;
  /**
   * Determines the custom batch size for the input.
   *
   * If the factory returns returned null then all snapshots will be processed in a single batch.
   */
  readonly batchSizeForSnapshots?: Maybe<FactoryWithRequiredInput<number | null, QueryDocumentSnapshot<T>[]>>;
  /**
   * The iterate function per each snapshot.
   *
   * The batch will have atleast one item in it.
   */
  iterateSnapshotBatch(snapshotBatch: QueryDocumentSnapshot<T>[], batchIndex: number): Promise<R>;
  /**
   * (Optional) additional config for the PerformAsyncTasks call.
   *
   * By default:
   * - retriesAllowed = 0
   * - throwError = true
   * - sequential = true
   */
  readonly performTasksConfig?: Partial<PerformAsyncTasksConfig<QueryDocumentSnapshot<T>[]>>;
}

/**
 * Default batch size for iterateFirestoreDocumentSnapshotBatches().
 *
 * 25 documents per batch.
 */
export const DEFAULT_ITERATE_FIRESTORE_DOCUMENT_SNAPSHOT_BATCHES_BATCH_SIZE = 25;

/**
 * Iterates through the results of a Firestore query by each document snapshot.
 *
 * @param config
 * @returns
 */
export async function iterateFirestoreDocumentSnapshotBatches<T, R>(config: IterateFirestoreDocumentSnapshotBatchesConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshotBatch, batchSizeForSnapshots: inputBatchSizeForSnapshots, performTasksConfig, batchSize: inputBatchSize } = config;
  const batchSize = inputBatchSize === null ? null : (inputBatchSize ?? DEFAULT_ITERATE_FIRESTORE_DOCUMENT_SNAPSHOT_BATCHES_BATCH_SIZE);
  const batchSizeForSnapshots = inputBatchSizeForSnapshots ?? (() => batchSize);

  return iterateFirestoreDocumentSnapshotCheckpoints({
    ...config,
    iterateCheckpoint: async (docSnapshots) => {
      if (docSnapshots.length > 0) {
        const batchSizeForSnapshotsResult = await batchSizeForSnapshots(docSnapshots);
        const batches = batchSizeForSnapshotsResult === null ? [docSnapshots] : batch(docSnapshots, batchSizeForSnapshotsResult);
        let i = 0;

        const performTasksResult = await performAsyncTasks(batches, (x) => iterateSnapshotBatch(x, i++), {
          sequential: true, // sequential by default
          ...performTasksConfig
        });

        return performTasksResult.results.map(([snapshots, result], i) => ({ snapshots, result, i }));
      } else {
        return [];
      }
    }
  });
}

// MARK: Iterate Checkpoints
/**
 * Config for iterateFirestoreDocumentSnapshotCheckpoints().
 */
export interface IterateFirestoreDocumentSnapshotCheckpointsConfig<T, R> {
  readonly queryFactory: FirestoreQueryFactory<T>;
  readonly constraintsFactory: GetterOrValue<FirestoreQueryConstraint[]>;
  /**
   * Whether or not to call the constraints factory each time.
   *
   * If the constraintsFactory is a getter then this defaults to true. If constraintsFactory is a value then this is set to false.
   */
  readonly dynamicConstraints?: boolean;
  /**
   * Convenience paramenter to add a maximum limit constraint to the query.
   *
   * The actual limit passed to the query will be calculated between this value, the totalSnapshotsLimit value, and the remaining number of snapshots to load.
   *
   * A limit of 0 is NOT considered as unlimited and will cause the function to end immediately.
   */
  readonly limitPerCheckpoint?: Maybe<number>;
  /**
   * The total number of snapshots allowed.
   *
   * Ends on the checkpoint that reaches this limit.
   */
  readonly totalSnapshotsLimit?: Maybe<number>;
  /**
   * The number of max parallel checkpoints to run.
   *
   * By default checkpoints are run serially (max of 1), but can be run in parallel.
   */
  readonly maxParallelCheckpoints?: number;
  /**
   * The amount of time to add as a delay between beginning a new checkpoint.
   *
   * If in parallel this is the minimum amount of time to wait before starting a new checkpoint.
   */
  readonly waitBetweenCheckpoints?: Milliseconds;
  /**
   * Configuration to use when a repeat cursor is visited (potentially indicative of an infinite query loop).
   *
   * Can be configured with false to exit the iteration immediately and return, or can use a function to decide if the iteration should continue.
   *
   * If false is returned the cursor is discarded and the loop will end.
   */
  readonly handleRepeatCursor?: Maybe<false | ((cursor: QueryDocumentSnapshot<T>) => Promise<boolean>)>;
  /**
   * Filter function that can be used to filter out snapshots.
   *
   * If all snapshots are filtered out then the iteration will continue with final item of the snapshot regardless of filtering. The filtering does not impact the continuation decision.
   * Use the handleRepeatCursor to properly exit the loop in unwanted repeat cursor cases.
   *
   * @param snapshot
   * @returns
   */
  readonly filterCheckpointSnapshots?: IterateFirestoreDocumentSnapshotCheckpointsFilterCheckpointSnapshotsFunction<T>;
  /**
   * The iterate function per each snapshot.
   */
  iterateCheckpoint(snapshots: QueryDocumentSnapshot<T>[], query: QuerySnapshot<T>): Promise<R[]>;
  /**
   * (Optional) Called at the end of each checkpoint.
   */
  useCheckpointResult?(checkpointResults: IterateFirestoreDocumentSnapshotCheckpointsIterationResult<T, R>): PromiseOrValue<void>;
}

/**
 * Filter function used to filter out snapshots.
 *
 * This type defines a function that can filter document snapshots during iteration,
 * allowing for custom filtering logic to be applied to checkpoints beyond what
 * Firestore query constraints can achieve.
 *
 * @param snapshot - Array of document snapshots to filter
 * @returns Filtered array of document snapshots
 */
export type IterateFirestoreDocumentSnapshotCheckpointsFilterCheckpointSnapshotsFunction<T> = (snapshot: QueryDocumentSnapshot<T>[]) => PromiseOrValue<QueryDocumentSnapshot<T>[]>;

/**
 * Creates a IterateFirestoreDocumentSnapshotCheckpointsFilterCheckpointSnapshotsFunction that filters out any repeat documents.
 *
 * Repeat documents can occur in cases where the document is updated and the query matches it again for a different reason.
 * This utility function creates a filter that prevents processing the same document multiple times.
 *
 * @param readKeyFunction - Function that extracts a unique key from a document snapshot, defaults to document ID
 * @returns A filter function that prevents duplicate document processing
 */
export function filterRepeatCheckpointSnapshots<T>(readKeyFunction: ReadKeyFunction<QueryDocumentSnapshot<T>> = (x) => x.id): IterateFirestoreDocumentSnapshotCheckpointsFilterCheckpointSnapshotsFunction<T> {
  const allowOnceFilter = allowValueOnceFilter(readKeyFunction);
  return async (snapshots: QueryDocumentSnapshot<T>[]) => snapshots.filter(allowOnceFilter);
}

/**
 * Result of processing a single pagination checkpoint during the iteration process.
 *
 * This interface contains all data related to one checkpoint/batch in the pagination
 * sequence, including the documents retrieved, the cursor position, and processing results.
 *
 * @template T - The document data type
 * @template R - The result type from processing this checkpoint
 */
export interface IterateFirestoreDocumentSnapshotCheckpointsIterationResult<T, R> extends IndexRef {
  /***
   * Checkpoint index number
   *
   * Zero-based index of this checkpoint within the iteration sequence.
   */
  readonly i: IndexNumber;
  /**
   * The cursor document used in this query.
   *
   * This is typically the last document in the current batch, which will be used
   * as the starting point for the next query. May be undefined for the last batch
   * or if the batch is empty.
   */
  readonly cursorDocument?: Maybe<QueryDocumentSnapshot<T>>;
  /**
   * Results returned from each checkpoint.
   *
   * These are the values returned by the checkpoint processing function for
   * this specific batch of documents.
   */
  readonly results: R[];
  /**
   * All non-filtered document snapshots in this checkpoint.
   *
   * If filterCheckpointSnapshot is configured, this does not include the filtered snapshots.
   * These are the raw document snapshots as retrieved from Firestore that passed any
   * configured filtering.
   */
  readonly docSnapshots: QueryDocumentSnapshot<T>[];
  /**
   * The query snapshot for this checkpoint.
   *
   * Contains the raw query result, including metadata like query time and
   * whether the query includes data from local cache.
   */
  readonly docQuerySnapshot: QuerySnapshot<T>;
}

/**
 * Summary results of a complete paginated iteration through Firestore query results.
 *
 * This interface provides statistics about the query execution, including the number
 * of pagination checkpoints processed and the total number of documents visited.
 */
export interface IterateFirestoreDocumentSnapshotCheckpointsResult {
  /**
   * The total number of batches visited.
   *
   * Each checkpoint represents one Firestore query execution as part of the
   * paginated iteration process. The number of checkpoints depends on the
   * number of documents matching the query and the limit per checkpoint.
   */
  readonly totalCheckpoints: number;
  /**
   * The total number of snapshots that were visited.
   *
   * This represents the total number of documents that matched the query constraints
   * and were processed during the iteration, subject to any total limit applied.
   */
  readonly totalSnapshotsVisited: number;
  /**
   * Whether or not the total snapshots limit was reached.
   *
   * When true, this indicates that the query potentially had more matching documents
   * than were processed, but the iteration stopped after reaching the configured limit.
   * When false, all matching documents were processed.
   */
  readonly totalSnapshotsLimitReached: boolean;
}

/**
 * Iterates through the results of a Firestore query in several batches.
 *
 * This is the core pagination function that handles cursor-based iteration through
 * potentially large Firestore query results. It manages cursor documents, checkpoint
 * processing, parallel execution, and various limit controls.
 *
 * @template T - The document data type
 * @template R - The result type of the iteration
 * @param config - Complete configuration for the pagination and processing behavior
 * @returns Promise resolving to statistics about the iteration
 */
export async function iterateFirestoreDocumentSnapshotCheckpoints<T, R>(config: IterateFirestoreDocumentSnapshotCheckpointsConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateCheckpoint, filterCheckpointSnapshots: inputFilterCheckpointSnapshot, handleRepeatCursor: inputHandleRepeatCursor, waitBetweenCheckpoints, useCheckpointResult, constraintsFactory: inputConstraintsFactory, dynamicConstraints: inputDynamicConstraints, queryFactory, maxParallelCheckpoints = 1, limitPerCheckpoint: inputLimitPerCheckpoint, totalSnapshotsLimit: inputTotalSnapshotsLimit } = config;
  const constraintsInputIsFactory = typeof inputConstraintsFactory === 'function';
  const constraintsFactory = constraintsInputIsFactory && inputDynamicConstraints !== false ? inputConstraintsFactory : asGetter(getValueFromGetter(inputConstraintsFactory));

  /**
   * Default to the input total snapshots limit if no limit is provided, otherwise there will be no limit.
   */
  const limitPerCheckpoint = inputLimitPerCheckpoint ?? inputTotalSnapshotsLimit;
  const totalSnapshotsLimit = inputTotalSnapshotsLimit ?? Number.MAX_SAFE_INTEGER;

  let currentIndex = 0;
  let hasReachedEnd = false;
  let totalSnapshotsLimitReached = false;
  let totalSnapshotsVisited: number = 0;
  let cursorDocument: Maybe<QueryDocumentSnapshot<T>>;

  const visitedCursorPaths = new Set<FirestoreModelKey>();
  const handleRepeatCursor = typeof inputHandleRepeatCursor === 'function' ? inputHandleRepeatCursor : () => inputHandleRepeatCursor;
  const filterCheckpointSnapshot = inputFilterCheckpointSnapshot ?? mapIdentityFunction();

  async function taskInputFactory() {
    // Perform another query, then pass the results to the task factory.
    if (hasReachedEnd) {
      return null; // issue no more tasks
    }

    const constraints = constraintsFactory();
    const startAfterFilter = cursorDocument ? startAfter(cursorDocument) : undefined;

    if (startAfterFilter) {
      constraints.push(startAfterFilter);
    }

    if (limitPerCheckpoint != null) {
      const totalPossibleNumberOfItemsLeftToLoad = Math.max(0, totalSnapshotsLimit - totalSnapshotsVisited);
      const nextLimit = Math.min(limitPerCheckpoint, totalPossibleNumberOfItemsLeftToLoad);

      if (nextLimit === 0) {
        // we're at the end
        cursorDocument = null;
        hasReachedEnd = true;
        totalSnapshotsLimitReached = true; // should have already been reached, but flag again just incase
        return null; // exit immediately
      } else {
        constraints.push(limit(nextLimit));
      }
    }

    const query = queryFactory.query(constraints);
    const docQuerySnapshot = await query.getDocs();
    const docSnapshots = docQuerySnapshot.docs;

    // check for repeat cursor
    const nextCursorDocument: Maybe<QueryDocumentSnapshot<T>> = lastValue(docSnapshots);

    if (nextCursorDocument != null) {
      const cursorPath = readFirestoreModelKeyFromDocumentSnapshot(nextCursorDocument);

      if (visitedCursorPaths.has(cursorPath)) {
        const shouldContinue = await handleRepeatCursor(nextCursorDocument);

        if (shouldContinue === false) {
          cursorDocument = null;
          hasReachedEnd = true;
          return null; // exit immediately
        }
      } else {
        visitedCursorPaths.add(cursorPath);
      }
    }

    cursorDocument = nextCursorDocument; // set the next cursor document

    // update state
    const newSnapshotsVisited = docSnapshots.length;
    totalSnapshotsVisited += newSnapshotsVisited;

    if (!cursorDocument || totalSnapshotsVisited > totalSnapshotsLimit) {
      hasReachedEnd = true; // mark as having reached the end
      totalSnapshotsLimitReached = true; // mark as having reached the limit
    }

    const i = currentIndex;
    currentIndex += 1; // increase our current index

    return {
      i,
      docQuerySnapshot
    };
  }

  const performTaskFn = performTasksFromFactoryInParallelFunction({
    maxParallelTasks: maxParallelCheckpoints,
    waitBetweenTasks: waitBetweenCheckpoints,
    taskFactory: async ({ i, docQuerySnapshot }: { i: IndexNumber; docQuerySnapshot: QuerySnapshot<T> }) => {
      const docSnapshots = await filterCheckpointSnapshot(docQuerySnapshot.docs);
      const results = await iterateCheckpoint(docSnapshots, docQuerySnapshot);
      const checkpointResults: IterateFirestoreDocumentSnapshotCheckpointsIterationResult<T, R> = {
        i,
        cursorDocument,
        results,
        docSnapshots,
        docQuerySnapshot
      };

      await useCheckpointResult?.(checkpointResults);
    }
  });

  await performTaskFn(taskInputFactory);

  const result: IterateFirestoreDocumentSnapshotCheckpointsResult = {
    totalCheckpoints: currentIndex,
    totalSnapshotsVisited,
    totalSnapshotsLimitReached
  };

  return result;
}

// MARK: Utility
/**
 * Creates a filter that allows each document snapshot to be processed only once based on its path.
 *
 * This utility helps prevent duplicate processing of documents by tracking which ones have
 * already been seen based on their path.
 *
 * @template T - The document snapshot type
 * @returns A filter function that only allows each unique document to pass once
 */
export function allowDocumentSnapshotWithPathOnceFilter<T extends DocumentSnapshot>(): AllowValueOnceFilter<T, FirestoreModelKey> {
  return allowValueOnceFilter(readFirestoreModelKeyFromDocumentSnapshot);
}
