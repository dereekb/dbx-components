import { GetterOrValue, PromiseOrValue, IndexRef, Maybe, asGetter, lastValue, PerformAsyncTasksConfig, performAsyncTasks, batch, IndexNumber, PerformAsyncTasksResult } from '@dereekb/util';
import { FirestoreDocument, FirestoreDocumentSnapshotDataPair, documentDataWithIdAndKey, LimitedFirestoreDocumentAccessor } from '../accessor';
import { QueryDocumentSnapshot, QuerySnapshot, DocumentSnapshot } from '../types';
import { FirestoreQueryConstraint, startAfter, limit } from './constraint';
import { FirestoreQueryFactory } from './query';

// MARK: Iterate Snapshot Pairs
/**
 * Config for iterateFirestoreDocumentSnapshots().
 */
export interface IterateFirestoreDocumentSnapshotPairsConfig<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Omit<IterateFirestoreDocumentSnapshotsConfig<T, R>, 'iterateSnapshot'> {
  /**
   * Document accessor to retrieve the documents for the references.
   */
  readonly documentAccessor: LimitedFirestoreDocumentAccessor<T, D>;
  /**
   * The iterate function per each snapshot.
   */
  iterateSnapshotPair(snapshot: FirestoreDocumentSnapshotDataPair<D>): Promise<R>;
}

/**
 * Iterates through the results of a Firestore query by each FirestoreDocumentSnapshotDataPair.
 *
 * @param config
 * @returns
 */
export async function iterateFirestoreDocumentSnapshotPairs<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: IterateFirestoreDocumentSnapshotPairsConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshotPair, documentAccessor } = config;
  return iterateFirestoreDocumentSnapshots({
    ...config,
    iterateSnapshot: async (snapshot) => {
      const document = documentAccessor.loadDocument(snapshot.ref) as D;
      const data = documentDataWithIdAndKey(snapshot);
      const pair = {
        document,
        snapshot,
        data
      };

      return iterateSnapshotPair(pair);
    }
  });
}

// MARK: Iterate Snapshots
/**
 * Config for iterateFirestoreDocumentSnapshots().
 */
export interface IterateFirestoreDocumentSnapshotsConfig<T, R> extends Omit<IterateFirestoreDocumentSnapshotBatchesConfig<T, IterateFirestoreDocumentSnapshotsResult<T, R>>, 'iterateSnapshotBatch'> {
  /**
   * The iterate function per each snapshot individually
   */
  iterateSnapshot(snapshot: QueryDocumentSnapshot<T>): Promise<R>;
  /**
   * (Optional) Additional config for the snapshot's PerformAsyncTasks call. By default user the performTasksConfig value.
   */
  readonly snapshotsPerformTasksConfig?: Partial<PerformAsyncTasksConfig>;
}

export type IterateFirestoreDocumentSnapshotsResult<T, R> = PerformAsyncTasksResult<QueryDocumentSnapshot<T>, R>;

/**
 * Iterates through the results of a Firestore query by each document snapshot by itself.
 *
 * @param config
 * @returns
 */
export async function iterateFirestoreDocumentSnapshots<T, R>(config: IterateFirestoreDocumentSnapshotsConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshot, performTasksConfig, snapshotsPerformTasksConfig } = config;
  return iterateFirestoreDocumentSnapshotBatches<T, IterateFirestoreDocumentSnapshotsResult<T, R>>({
    ...config,
    iterateSnapshotBatch: async (docSnapshots) => {
      const performTasksResult = await performAsyncTasks(docSnapshots, iterateSnapshot, {
        sequential: true, // sequential by default
        ...(snapshotsPerformTasksConfig ?? performTasksConfig)
      });

      return performTasksResult;
    }
  });
}

// MARK: Iterate Snapshot Pair Batches
/**
 * Config for iterateFirestoreDocumentSnapshots().
 */
export interface IterateFirestoreDocumentSnapshotPairBatchesConfig<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Omit<IterateFirestoreDocumentSnapshotBatchesConfig<T, R>, 'iterateSnapshotBatch'> {
  /**
   * Document accessor to retrieve the documents for the references.
   */
  readonly documentAccessor: LimitedFirestoreDocumentAccessor<T, D>;
  /**
   * The iterate function per each snapshot batch.
   */
  iterateSnapshotPairsBatch(snapshotDataPairs: FirestoreDocumentSnapshotDataPair<D>[]): Promise<R>;
}

/**
 * Iterates through the results of a Firestore query by each FirestoreDocumentSnapshotDataPair.
 *
 * @param config
 * @returns
 */
export async function iterateFirestoreDocumentSnapshotPairBatches<T, R, D extends FirestoreDocument<T> = FirestoreDocument<T>>(config: IterateFirestoreDocumentSnapshotPairBatchesConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateSnapshotPairsBatch, documentAccessor } = config;
  return iterateFirestoreDocumentSnapshotBatches({
    ...config,
    iterateSnapshotBatch: async (snapshots) => {
      const pairs = snapshots.map((snapshot) => {
        const document = documentAccessor.loadDocument(snapshot.ref) as D;
        const data = documentDataWithIdAndKey(snapshot);
        const pair = {
          document,
          snapshot,
          data
        };

        return pair;
      });

      return iterateSnapshotPairsBatch(pairs);
    }
  });
}

// MARK: Iterate Snapshot Batches
/**
 * Single batch result from iterateFirestoreDocumentSnapshotBatches().
 *
 * Contains the batch index, the snapshots, and the final result for this batch.
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
   */
  readonly batchSize?: Maybe<number>;
  /**
   * The iterate function per each snapshot.
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
  readonly performTasksConfig?: Partial<PerformAsyncTasksConfig>;
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
  const { iterateSnapshotBatch, performTasksConfig, batchSize: inputBatchSize } = config;
  const batchSize = inputBatchSize ?? DEFAULT_ITERATE_FIRESTORE_DOCUMENT_SNAPSHOT_BATCHES_BATCH_SIZE;

  return iterateFirestoreDocumentSnapshotCheckpoints({
    ...config,
    iterateCheckpoint: async (docSnapshots) => {
      const batches = batch(docSnapshots, batchSize);
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
 * Config for iterateFirestoreDocumentSnapshotCheckpoints().
 */
export interface IterateFirestoreDocumentSnapshotCheckpointsConfig<T, R> {
  readonly queryFactory: FirestoreQueryFactory<T>;
  readonly constraintsFactory: GetterOrValue<FirestoreQueryConstraint[]>;
  /**
   * Convenience paramenter to add a limit constraint to the query.
   */
  readonly limitPerCheckpoint?: number;
  /**
   * The total number of snapshots allowed. Ends on the checkpoint that
   */
  readonly totalSnapshotsLimit?: number;
  /**
   * The iterate function per each snapshot.
   */
  iterateCheckpoint(snapshot: QueryDocumentSnapshot<T>[], query: QuerySnapshot<T>): Promise<R[]>;
  /**
   * (Optional) Called at the end of each checkpoint.
   */
  useCheckpointResult?(checkpointResults: IterateFirestoreDocumentSnapshotCheckpointsIterationResult<T, R>): PromiseOrValue<void>;
}

export interface IterateFirestoreDocumentSnapshotCheckpointsIterationResult<T, R> extends IndexRef {
  /***
   * Checkpoint index number
   */
  readonly i: IndexNumber;
  /**
   * The cursor document used in this query.
   */
  readonly cursorDocument?: Maybe<DocumentSnapshot<T>>;
  /**
   * Results returned from each checkpoint.
   */
  readonly results: R[];
  /**
   * All document snapshots in this checkpoint.
   */
  readonly docSnapshots: QueryDocumentSnapshot<T>[];
}

export interface IterateFirestoreDocumentSnapshotCheckpointsResult {
  /**
   * The total number of batches visited.
   */
  readonly totalCheckpoints: number;
  /**
   * The total number of snapshots that were visited.
   */
  readonly totalSnapshotsVisited: number;
}

/**
 * Iterates through the results of a Firestore query in several batches.
 *
 * @param config
 * @returns
 */
export async function iterateFirestoreDocumentSnapshotCheckpoints<T, R>(config: IterateFirestoreDocumentSnapshotCheckpointsConfig<T, R>): Promise<IterateFirestoreDocumentSnapshotCheckpointsResult> {
  const { iterateCheckpoint, useCheckpointResult, constraintsFactory: inputConstraintsFactory, queryFactory, limitPerCheckpoint, totalSnapshotsLimit = Number.MAX_SAFE_INTEGER } = config;
  const constraintsFactory = asGetter(inputConstraintsFactory);

  let i = 0;

  async function iterateFromCursor(cursorDocument?: Maybe<DocumentSnapshot<T>>) {
    const constraints = constraintsFactory();
    const startAfterFilter = cursorDocument ? startAfter(cursorDocument) : undefined;

    if (startAfterFilter) {
      constraints.push(startAfterFilter);
    }

    if (limitPerCheckpoint) {
      constraints.push(limit(limitPerCheckpoint));
    }

    const query = queryFactory.query(constraints);
    const docQuerySnapshot = await query.getDocs();
    const docSnapshots = docQuerySnapshot.docs;

    const results = await iterateCheckpoint(docSnapshots, docQuerySnapshot);
    const checkpointResults: IterateFirestoreDocumentSnapshotCheckpointsIterationResult<T, R> = {
      i,
      cursorDocument,
      results,
      docSnapshots
    };

    return checkpointResults;
  }

  let cursorDocument: Maybe<DocumentSnapshot<T>>;
  let totalSnapshotsVisited: number = 0;

  while (true) {
    const iterateResults = await iterateFromCursor(cursorDocument);
    await useCheckpointResult?.(iterateResults);

    const newSnapshotsVisited = iterateResults.docSnapshots.length;
    const hasResults = newSnapshotsVisited > 0;

    if (hasResults) {
      cursorDocument = hasResults ? lastValue(iterateResults.docSnapshots) : undefined;

      i += 1;
      totalSnapshotsVisited += newSnapshotsVisited;

      // if at the limit, bail out
      if (totalSnapshotsVisited > totalSnapshotsLimit) {
        break;
      }
    } else {
      break;
    }
  }

  const result: IterateFirestoreDocumentSnapshotCheckpointsResult = {
    totalCheckpoints: i,
    totalSnapshotsVisited
  };

  return result;
}
