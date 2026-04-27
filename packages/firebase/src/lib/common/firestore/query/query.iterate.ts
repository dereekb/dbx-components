/**
 * @module Firestore Query Iteration
 *
 * Provides a layered system for iterating through Firestore query results using
 * cursor-based pagination ("checkpoints"). Each layer adds convenience on top of the
 * one below:
 *
 * 1. **Checkpoints** ({@link iterateFirestoreDocumentSnapshotCheckpoints}) — core pagination engine
 * 2. **Batches** ({@link iterateFirestoreDocumentSnapshotBatches}) — subdivides checkpoints into fixed-size batches
 * 3. **Snapshots** ({@link iterateFirestoreDocumentSnapshots}) — processes individual snapshots
 * 4. **Pairs** ({@link iterateFirestoreDocumentSnapshotPairs}) — loads typed document wrappers per snapshot
 *
 * Batch variants with document pairs are also available:
 * - {@link iterateFirestoreDocumentSnapshotPairBatches} — batch processing with typed document access
 *
 * All functions support configurable limits (`limitPerCheckpoint`, `totalSnapshotsLimit`),
 * concurrency (`maxParallelCheckpoints`), rate limiting (`waitBetweenCheckpoints`),
 * snapshot filtering, and repeat cursor detection.
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
 * Configuration for {@link iterateFirestoreDocumentSnapshotPairs}.
 *
 * Extends per-snapshot iteration by automatically loading each snapshot's
 * {@link FirestoreDocumentSnapshotDataPairWithData} via a document accessor,
 * providing the callback with both the snapshot and its typed document wrapper.
 */
export interface IterateFirestoreDocumentSnapshotPairsConfig<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Omit<IterateFirestoreDocumentSnapshotsConfig<T, R>, 'iterateSnapshot'> {
  /**
   * Accessor used to load {@link FirestoreDocument} instances for each snapshot reference.
   * Each snapshot is resolved through this accessor to produce a document-snapshot pair.
   */
  readonly documentAccessor: LimitedFirestoreDocumentAccessor<T, D>;
  /**
   * Callback invoked for each document-snapshot pair.
   *
   * Receives a pair containing both the {@link FirestoreDocument} wrapper and its
   * snapshot data, enabling operations that need typed document access (e.g., updates, deletes).
   *
   * @param snapshot - The document-snapshot pair with guaranteed data
   */
  iterateSnapshotPair(snapshot: FirestoreDocumentSnapshotDataPairWithData<D>): Promise<R>;
}

/**
 * Iterates through Firestore query results, loading each snapshot as a
 * {@link FirestoreDocumentSnapshotDataPairWithData} before processing.
 *
 * Built on {@link iterateFirestoreDocumentSnapshots}, this adds an automatic document
 * loading step: each raw snapshot is resolved through the `documentAccessor` to produce
 * a pair containing both the typed {@link FirestoreDocument} and its snapshot data.
 * This is the highest-level iteration function — use it when your callback needs
 * document-level operations (updates, deletes) alongside the snapshot data.
 *
 * @param config - Iteration config including the document accessor and per-pair callback
 * @returns Checkpoint-level statistics (total checkpoints, snapshots visited, limit status)
 *
 * @example
 * ```typescript
 * const result = await iterateFirestoreDocumentSnapshotPairs({
 *   queryFactory,
 *   constraintsFactory: [where('status', '==', 'pending')],
 *   limitPerCheckpoint: 100,
 *   documentAccessor: collection.documentAccessor(),
 *   iterateSnapshotPair: async (pair) => {
 *     await pair.document.accessor.set({ ...pair.data, status: 'processed' });
 *   }
 * });
 * ```
 */
export async function iterateFirestoreDocumentSnapshotPairs<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: IterateFirestoreDocumentSnapshotPairsConfig<T, R, D>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshotPair, documentAccessor } = config;
  const loadPairForSnapshot = firestoreDocumentSnapshotPairsLoaderInstance<T, D>(documentAccessor);

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
 * Iterates through Firestore query results, processing each document snapshot individually.
 *
 * Built on {@link iterateFirestoreDocumentSnapshotBatches} with `maxParallelCheckpoints: 1`,
 * this unwraps each checkpoint's snapshots and processes them one-by-one via
 * {@link performAsyncTasks} (sequential by default). Use `snapshotsPerformTasksConfig`
 * to enable parallel snapshot processing within each checkpoint.
 *
 * For document-level operations (needing the typed {@link FirestoreDocument} wrapper),
 * use {@link iterateFirestoreDocumentSnapshotPairs} instead.
 *
 * @param config - Iteration config including the per-snapshot callback
 * @returns Checkpoint-level statistics (total checkpoints, snapshots visited, limit status)
 *
 * @example
 * ```typescript
 * const result = await iterateFirestoreDocumentSnapshots({
 *   queryFactory,
 *   constraintsFactory: [where('active', '==', true)],
 *   limitPerCheckpoint: 200,
 *   totalSnapshotsLimit: 1000,
 *   iterateSnapshot: async (snapshot) => {
 *     const data = snapshot.data();
 *     await externalApi.sync(data);
 *   }
 * });
 * ```
 */
export async function iterateFirestoreDocumentSnapshots<T, R>(config: IterateFirestoreDocumentSnapshotsConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshot, performTasksConfig, snapshotsPerformTasksConfig } = config;
  return iterateFirestoreDocumentSnapshotBatches<T, IterateFirestoreDocumentSnapshotsResult<T, R>>({
    ...config,
    maxParallelCheckpoints: 1,
    iterateSnapshotBatch: async (docSnapshots) => {
      return performAsyncTasks(docSnapshots, iterateSnapshot, {
        sequential: true, // sequential by default
        ...(snapshotsPerformTasksConfig ?? { ...performTasksConfig, nonConcurrentTaskKeyFactory: undefined, beforeRetry: undefined }) // don't pass the nonConcurrentTaskKeyFactory
      });
    }
  });
}

// MARK: Iterate Snapshot Pair Batches
/**
 * Configuration for {@link iterateFirestoreDocumentSnapshotPairBatches}.
 *
 * Extends batch-level iteration by automatically resolving each snapshot batch into
 * {@link FirestoreDocumentSnapshotDataPairWithData} instances via a document accessor.
 * The callback receives fully typed document-snapshot pairs rather than raw snapshots,
 * enabling batch operations that need document-level access.
 */
export interface IterateFirestoreDocumentSnapshotPairBatchesConfig<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Omit<IterateFirestoreDocumentSnapshotBatchesConfig<T, R>, 'iterateSnapshotBatch'> {
  /**
   * Accessor used to load {@link FirestoreDocument} instances for each snapshot reference.
   * All snapshots in a batch are resolved through this accessor before being passed to the callback.
   */
  readonly documentAccessor: LimitedFirestoreDocumentAccessor<T, D>;
  /**
   * Callback invoked for each batch of document-snapshot pairs.
   *
   * @param snapshotDataPairs - Array of pairs, each containing a typed document and its snapshot data
   * @param batchIndex - Zero-based index of this batch within the current checkpoint
   */
  iterateSnapshotPairsBatch(snapshotDataPairs: FirestoreDocumentSnapshotDataPairWithData<D>[], batchIndex: number): Promise<R>;
}

/**
 * Iterates through Firestore query results in batches, loading each batch as
 * {@link FirestoreDocumentSnapshotDataPairWithData} instances before processing.
 *
 * Built on {@link iterateFirestoreDocumentSnapshotBatches} with `maxParallelCheckpoints: 1`.
 * Each batch of raw snapshots is resolved through the `documentAccessor` to produce
 * typed document-snapshot pairs. Use this when you need batch-level operations with
 * typed document access (e.g., bulk updates, batch writes).
 *
 * @param config - Iteration config including the document accessor and per-batch callback
 * @returns Checkpoint-level statistics (total checkpoints, snapshots visited, limit status)
 *
 * @example
 * ```typescript
 * const result = await iterateFirestoreDocumentSnapshotPairBatches({
 *   queryFactory,
 *   constraintsFactory: [where('needsMigration', '==', true)],
 *   limitPerCheckpoint: 500,
 *   batchSize: 50,
 *   documentAccessor: collection.documentAccessor(),
 *   iterateSnapshotPairsBatch: async (pairs, batchIndex) => {
 *     const writeBatch = firestore.batch();
 *     pairs.forEach((pair) => writeBatch.update(pair.document.documentRef, { migrated: true }));
 *     await writeBatch.commit();
 *   }
 * });
 * ```
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
 * Configuration for {@link iterateFirestoreDocumentSnapshotBatches}.
 *
 * Extends checkpoint-level iteration by subdividing each checkpoint's snapshots into
 * smaller batches before processing. This is useful for operations that have size
 * constraints (e.g., Firestore batch writes limited to 500 operations) or that
 * benefit from smaller working sets for memory efficiency.
 */
export interface IterateFirestoreDocumentSnapshotBatchesConfig<T, R> extends Omit<IterateFirestoreDocumentSnapshotCheckpointsConfig<T, IterateFirestoreDocumentSnapshotBatchesResult<T, R>>, 'iterateCheckpoint'> {
  /**
   * Maximum number of document snapshots per batch.
   *
   * Defaults to {@link DEFAULT_ITERATE_FIRESTORE_DOCUMENT_SNAPSHOT_BATCHES_BATCH_SIZE} (25).
   * Pass `null` to process all snapshots from a checkpoint in a single batch.
   */
  readonly batchSize?: Maybe<number>;
  /**
   * Dynamic batch size factory that can vary batch size based on the checkpoint's snapshots.
   *
   * Called once per checkpoint with all snapshots from that checkpoint. If it returns `null`,
   * all snapshots are processed in a single batch. Takes precedence over `batchSize` when provided.
   */
  readonly batchSizeForSnapshots?: Maybe<FactoryWithRequiredInput<number | null, QueryDocumentSnapshot<T>[]>>;
  /**
   * Callback invoked for each batch of document snapshots within a checkpoint.
   *
   * Each batch is guaranteed to contain at least one item. Batches within a checkpoint
   * are processed via {@link performAsyncTasks} (sequential by default, configurable
   * via `performTasksConfig`).
   *
   * @param snapshotBatch - Non-empty array of document snapshots in this batch
   * @param batchIndex - Zero-based index of this batch within the current checkpoint
   */
  iterateSnapshotBatch(snapshotBatch: QueryDocumentSnapshot<T>[], batchIndex: number): Promise<R>;
  /**
   * Optional configuration for the {@link performAsyncTasks} call that processes batches
   * within each checkpoint.
   *
   * Defaults: `sequential: true`, `retriesAllowed: 0`, `throwError: true`.
   * Override to enable parallel batch processing, add retries for transient failures,
   * or customize error handling.
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
 * Iterates through Firestore query results by subdividing each checkpoint into smaller batches.
 *
 * Built on {@link iterateFirestoreDocumentSnapshotCheckpoints}, this function takes each
 * checkpoint's snapshots and splits them into batches (default size: 25). Batches are
 * processed via {@link performAsyncTasks}, sequential by default. Use this when operations
 * have size limits (e.g., Firestore batch writes) or benefit from controlled chunk sizes.
 *
 * For per-snapshot processing, use {@link iterateFirestoreDocumentSnapshots}.
 * For batch processing with typed document pairs, use {@link iterateFirestoreDocumentSnapshotPairBatches}.
 *
 * @param config - Iteration config including batch size and per-batch callback
 * @returns Checkpoint-level statistics (total checkpoints, snapshots visited, limit status)
 *
 * @example
 * ```typescript
 * const result = await iterateFirestoreDocumentSnapshotBatches({
 *   queryFactory,
 *   constraintsFactory: [where('type', '==', 'order')],
 *   limitPerCheckpoint: 500,
 *   batchSize: 100,
 *   iterateSnapshotBatch: async (snapshots, batchIndex) => {
 *     const data = snapshots.map((s) => s.data());
 *     await analytics.trackBatch(data);
 *   }
 * });
 * ```
 */
export async function iterateFirestoreDocumentSnapshotBatches<T, R>(config: IterateFirestoreDocumentSnapshotBatchesConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshotBatch, batchSizeForSnapshots: inputBatchSizeForSnapshots, performTasksConfig, batchSize: inputBatchSize } = config;
  const batchSize = inputBatchSize === null ? null : (inputBatchSize ?? DEFAULT_ITERATE_FIRESTORE_DOCUMENT_SNAPSHOT_BATCHES_BATCH_SIZE);
  const batchSizeForSnapshots = inputBatchSizeForSnapshots ?? (() => batchSize);

  return iterateFirestoreDocumentSnapshotCheckpoints({
    ...config,
    iterateCheckpoint: async (docSnapshots) => {
      if (docSnapshots.length === 0) {
        return [];
      }

      const batchSizeForSnapshotsResult = batchSizeForSnapshots(docSnapshots);
      const batches = batchSizeForSnapshotsResult === null ? [docSnapshots] : batch(docSnapshots, batchSizeForSnapshotsResult);
      let i = 0;

      const performTasksResult = await performAsyncTasks(batches, (x) => iterateSnapshotBatch(x, i++), {
        sequential: true, // sequential by default
        ...performTasksConfig
      });

      return performTasksResult.results.map(([snapshots, result], i) => ({ snapshots, result, i }));
    }
  });
}

// MARK: Iterate Checkpoints
/**
 * Configuration for {@link iterateFirestoreDocumentSnapshotCheckpoints}.
 *
 * This is the lowest-level configuration in the iteration hierarchy. It controls
 * cursor-based pagination through Firestore query results, where each "checkpoint"
 * represents one query execution that fetches a page of documents. Higher-level
 * functions ({@link iterateFirestoreDocumentSnapshotBatches}, {@link iterateFirestoreDocumentSnapshots},
 * {@link iterateFirestoreDocumentSnapshotPairs}) build on this.
 */
export interface IterateFirestoreDocumentSnapshotCheckpointsConfig<T, R> {
  /**
   * Factory used to create Firestore queries. The query is rebuilt for each checkpoint
   * with the current constraints (including the cursor `startAfter` and `limit`).
   */
  readonly queryFactory: FirestoreQueryFactory<T>;
  /**
   * Base query constraints applied to every checkpoint query.
   *
   * When a function (getter), it is called for each checkpoint by default, enabling
   * dynamic constraints that change between pages. When a static array, the same
   * constraints are reused. Override this behavior with `dynamicConstraints`.
   *
   * The cursor (`startAfter`) and page limit are appended automatically — do not
   * include them here.
   */
  readonly constraintsFactory: GetterOrValue<FirestoreQueryConstraint[]>;
  /**
   * Controls whether `constraintsFactory` is re-evaluated for each checkpoint.
   *
   * Defaults to `true` when `constraintsFactory` is a function, `false` when it is a static array.
   * Set explicitly to override the default — e.g., `false` to cache a function's result,
   * or `true` to force re-evaluation of a memoized getter.
   */
  readonly dynamicConstraints?: boolean;
  /**
   * Maximum number of documents to fetch per checkpoint (Firestore query `limit`).
   *
   * The effective limit is the minimum of this value and the remaining documents
   * allowed by `totalSnapshotsLimit`. Defaults to `totalSnapshotsLimit` if not set.
   *
   * A value of `0` causes immediate termination with no documents loaded — it is NOT
   * treated as "unlimited".
   */
  readonly limitPerCheckpoint?: Maybe<number>;
  /**
   * Maximum total number of document snapshots to load across all checkpoints.
   *
   * Iteration stops after the checkpoint that causes this limit to be reached or exceeded.
   * When omitted, there is no snapshot count limit (pagination continues until results
   * are exhausted or `maxPage`/`endEarly` terminates it).
   */
  readonly totalSnapshotsLimit?: Maybe<number>;
  /**
   * Maximum number of checkpoints to process concurrently.
   *
   * Defaults to 1 (serial execution). When set higher, checkpoint *processing*
   * (via `iterateCheckpoint`) can overlap, though checkpoint *fetching* remains
   * sequential since each query depends on the previous checkpoint's cursor.
   */
  readonly maxParallelCheckpoints?: number;
  /**
   * Minimum delay in milliseconds between initiating consecutive checkpoint queries.
   *
   * Useful for Firestore rate limiting or quota management. When running checkpoints
   * in parallel, this ensures at least this much time passes between starting each
   * new query.
   */
  readonly waitBetweenCheckpoints?: Milliseconds;
  /**
   * Strategy for handling repeat cursor documents, which can indicate an infinite loop.
   *
   * A repeat cursor occurs when the last document of a checkpoint has already been
   * seen as a cursor in a previous checkpoint — often caused by document updates
   * during iteration that re-match the query.
   *
   * - `false` or `undefined`: Immediately stop iteration when a repeat is detected
   * - `async (cursor) => boolean`: Custom handler — return `true` to continue iteration
   *   despite the repeat, or `false` to stop
   */
  readonly handleRepeatCursor?: Maybe<false | ((cursor: QueryDocumentSnapshot<T>) => Promise<boolean>)>;
  /**
   * Optional filter applied to each checkpoint's snapshots before they reach `iterateCheckpoint`.
   *
   * Filtering does not affect pagination decisions — the cursor for the next checkpoint
   * is always based on the last *unfiltered* document. If all documents in a checkpoint
   * are filtered out, iteration continues to the next checkpoint.
   *
   * Use {@link filterRepeatCheckpointSnapshots} to deduplicate documents that appear
   * in multiple checkpoints. Combine with `handleRepeatCursor` to properly terminate
   * iteration when filtering causes repeated cursors.
   */
  readonly filterCheckpointSnapshots?: IterateFirestoreDocumentSnapshotCheckpointsFilterCheckpointSnapshotsFunction<T>;
  /**
   * Core callback invoked once per checkpoint with the (optionally filtered) document snapshots.
   *
   * Receives all snapshots for this checkpoint and the raw query snapshot for metadata access.
   * Returns an array of results — one per logical unit processed (could be per-document,
   * per-batch, or any grouping the implementation chooses).
   *
   * @param snapshots - Document snapshots for this checkpoint (post-filter)
   * @param query - The raw Firestore query snapshot for this checkpoint
   */
  iterateCheckpoint(snapshots: QueryDocumentSnapshot<T>[], query: QuerySnapshot<T>): Promise<R[]>;
  /**
   * Optional side-effect callback invoked after each checkpoint is fully processed.
   *
   * Called after `iterateCheckpoint` completes, receiving the full iteration result
   * including checkpoint index, cursor state, results, and raw snapshots. Useful for
   * progress logging, metrics, or external state accumulation.
   *
   * @param checkpointResults - Complete iteration result for this checkpoint
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
 * Creates a checkpoint filter that deduplicates documents across checkpoints.
 *
 * Repeat documents can appear when a document is updated during iteration and
 * re-matches the query in a subsequent checkpoint. This factory returns a stateful
 * filter that tracks seen document keys and removes duplicates.
 *
 * The filter maintains state across checkpoints — use a single instance for the
 * entire iteration run. Pair with `handleRepeatCursor: false` to also terminate
 * iteration when cursor-level repeats are detected.
 *
 * @param readKeyFunction - Extracts a unique key from each snapshot; defaults to `snapshot.id`
 * @returns A stateful filter function suitable for `filterCheckpointSnapshots`
 *
 * @example
 * ```typescript
 * const result = await iterateFirestoreDocumentSnapshotCheckpoints({
 *   queryFactory,
 *   constraintsFactory: [orderBy('updatedAt')],
 *   limitPerCheckpoint: 100,
 *   filterCheckpointSnapshots: filterRepeatCheckpointSnapshots(),
 *   handleRepeatCursor: false,
 *   iterateCheckpoint: async (snapshots) => {
 *     return snapshots.map((s) => s.data());
 *   }
 * });
 * ```
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
 * Core cursor-based pagination engine for iterating through Firestore query results.
 *
 * This is the foundational function in the Firestore iteration hierarchy. It drives
 * sequential cursor-based pagination: each "checkpoint" executes a Firestore query,
 * uses the last document as a `startAfter` cursor for the next query, and passes
 * results to the `iterateCheckpoint` callback.
 *
 * The iteration loop continues until one of these conditions is met:
 * - A query returns no results (no more matching documents)
 * - The `totalSnapshotsLimit` is reached
 * - A repeat cursor is detected and `handleRepeatCursor` returns `false`
 * - The effective `limitPerCheckpoint` calculates to 0 remaining
 *
 * Higher-level functions build on this:
 * - {@link iterateFirestoreDocumentSnapshotBatches} — subdivides checkpoints into smaller batches
 * - {@link iterateFirestoreDocumentSnapshots} — processes one snapshot at a time
 * - {@link iterateFirestoreDocumentSnapshotPairs} — loads typed document wrappers per snapshot
 *
 * @param config - Complete configuration for pagination, processing, and termination behavior
 * @returns Statistics including total checkpoints executed, snapshots visited, and whether the limit was hit
 *
 * @example
 * ```typescript
 * const result = await iterateFirestoreDocumentSnapshotCheckpoints({
 *   queryFactory,
 *   constraintsFactory: [where('createdAt', '<=', cutoffDate), orderBy('createdAt')],
 *   limitPerCheckpoint: 200,
 *   totalSnapshotsLimit: 5000,
 *   handleRepeatCursor: false,
 *   iterateCheckpoint: async (snapshots, querySnapshot) => {
 *     return snapshots.map((s) => ({ id: s.id, data: s.data() }));
 *   },
 *   useCheckpointResult: (result) => {
 *     console.log(`Checkpoint ${result.i}: processed ${result.docSnapshots.length} docs`);
 *   }
 * });
 * ```
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

  // eslint-disable-next-line sonarjs/cognitive-complexity -- cursor-based pagination logic with repeat detection is inherently complex
  async function taskInputFactory() {
    // Perform another query, then pass the results to the task factory.
    let result: { i: IndexNumber; docQuerySnapshot: QuerySnapshot<T> } | null = null;

    if (!hasReachedEnd) {
      const constraints = constraintsFactory();
      const startAfterFilter = cursorDocument ? startAfter(cursorDocument) : undefined;

      if (startAfterFilter) {
        constraints.push(startAfterFilter);
      }

      let shouldContinue = true;

      if (limitPerCheckpoint != null) {
        const totalPossibleNumberOfItemsLeftToLoad = Math.max(0, totalSnapshotsLimit - totalSnapshotsVisited);
        const nextLimit = Math.min(limitPerCheckpoint, totalPossibleNumberOfItemsLeftToLoad);

        if (nextLimit === 0) {
          // we're at the end
          cursorDocument = null;
          hasReachedEnd = true;
          totalSnapshotsLimitReached = true; // should have already been reached, but flag again just incase
          shouldContinue = false;
        } else {
          constraints.push(limit(nextLimit));
        }
      }

      if (shouldContinue) {
        const query = queryFactory.query(constraints);
        const docQuerySnapshot = await query.getDocs();
        const docSnapshots = docQuerySnapshot.docs;

        // check for repeat cursor
        const nextCursorDocument: Maybe<QueryDocumentSnapshot<T>> = lastValue(docSnapshots);

        if (nextCursorDocument != null) {
          const cursorPath = readFirestoreModelKeyFromDocumentSnapshot(nextCursorDocument);

          if (visitedCursorPaths.has(cursorPath)) {
            const repeatResult = await handleRepeatCursor(nextCursorDocument);

            if (repeatResult === false) {
              cursorDocument = null;
              hasReachedEnd = true;
              shouldContinue = false;
            }
          } else {
            visitedCursorPaths.add(cursorPath);
          }
        }

        if (shouldContinue) {
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

          result = { i, docQuerySnapshot };
        }
      }
    }

    return result;
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
 * Creates a stateful filter that allows each document snapshot through only once,
 * keyed by its full Firestore model path.
 *
 * Unlike {@link filterRepeatCheckpointSnapshots} which uses document ID by default,
 * this filter uses the full document path ({@link readFirestoreModelKeyFromDocumentSnapshot}),
 * making it suitable for cross-collection iteration where document IDs alone may collide.
 *
 * @returns A reusable filter function that passes each unique document path exactly once
 *
 * @example
 * ```typescript
 * const onceFilter = allowDocumentSnapshotWithPathOnceFilter();
 * const uniqueSnapshots = allSnapshots.filter(onceFilter);
 * ```
 */
export function allowDocumentSnapshotWithPathOnceFilter<T extends DocumentSnapshot>(): AllowValueOnceFilter<T, FirestoreModelKey> {
  return allowValueOnceFilter(readFirestoreModelKeyFromDocumentSnapshot);
}
