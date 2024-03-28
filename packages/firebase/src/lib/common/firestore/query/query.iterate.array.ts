import { flattenArray } from '@dereekb/util';
import { type QueryDocumentSnapshot, type QuerySnapshot } from '../types';
import { type IterateFirestoreDocumentSnapshotCheckpointsConfig, type IterateFirestoreDocumentSnapshotCheckpointsResult, type IterateFirestoreDocumentSnapshotPairBatchesConfig, iterateFirestoreDocumentSnapshotCheckpoints, iterateFirestoreDocumentSnapshotPairBatches } from './query.iterate';
import { type FirestoreDocument } from '../accessor/document';
import { type FirestoreDocumentSnapshotDataPairWithData } from '../accessor/document.utility';

// MARK: Iterate Document Snapshot Pairs
/**
 * Configuration for loadAllFirestoreDocumentSnapshot()
 */
export interface LoadAllFirestoreDocumentSnapshotPairsConfig<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Pick<IterateFirestoreDocumentSnapshotPairBatchesConfig<T, unknown, D>, 'documentAccessor' | 'queryFactory' | 'constraintsFactory' | 'dynamicConstraints' | 'totalSnapshotsLimit' | 'handleRepeatCursor' | 'filterCheckpointSnapshots' | 'limitPerCheckpoint'> {
  /**
   * Optional iterate function. Returns no value.
   */
  iterateSnapshotPairsBatch?(snapshotDataPairs: FirestoreDocumentSnapshotDataPairWithData<D>[], batchIndex: number): Promise<void>;
}

export interface LoadAllFirestoreDocumentSnapshotPairsResult<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> extends Pick<IterateFirestoreDocumentSnapshotCheckpointsResult, 'totalCheckpoints' | 'totalSnapshotsVisited' | 'totalSnapshotsLimitReached'> {
  readonly snapshotPairs: FirestoreDocumentSnapshotDataPairWithData<D>[];
}

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
 * Configuration for loadAllFirestoreDocumentSnapshot()
 */
export interface LoadAllFirestoreDocumentSnapshotsConfig<T> extends Pick<IterateFirestoreDocumentSnapshotCheckpointsConfig<T, unknown>, 'queryFactory' | 'constraintsFactory' | 'dynamicConstraints' | 'totalSnapshotsLimit' | 'handleRepeatCursor' | 'filterCheckpointSnapshots' | 'limitPerCheckpoint'> {
  /**
   * Optional iterate function. Returns no value.
   *
   * @param snapshots
   * @param query
   */
  iterateSnapshotsForCheckpoint?(snapshots: QueryDocumentSnapshot<T>[], query: QuerySnapshot<T>): Promise<void>;
}

export interface LoadAllFirestoreDocumentSnapshotsResult<T> extends Pick<IterateFirestoreDocumentSnapshotCheckpointsResult, 'totalCheckpoints' | 'totalSnapshotsVisited' | 'totalSnapshotsLimitReached'> {
  readonly snapshots: QueryDocumentSnapshot<T>[];
}

/**
 * Iterates all documents that match the configuration and puts them into an array.
 *
 * @param config
 * @returns
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
