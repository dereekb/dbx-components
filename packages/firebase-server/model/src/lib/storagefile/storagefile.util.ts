import { type FirestoreQueryConstraint, iterateFirestoreDocumentSnapshotPairs, type StorageFile, type StorageFileFirestoreCollection, type StorageFileKey, StorageFileState } from '@dereekb/firebase';
import { dateFromDateOrTimeNumber, type Maybe, type Milliseconds, type ArrayOrValue, asArray } from '@dereekb/util';

/**
 * Describes when a StorageFile should be queued for deletion.
 *
 * If true, the StorageFile will be queued for deletion immediately.
 * If a number, the StorageFile will be queued for deletion after the specified number of milliseconds.
 * If a Date, the StorageFile will be queued for deletion at the specified date.
 */
export type StorageFileQueueForDeleteTime = true | Milliseconds | Date;

export interface QueryAndFlagStorageFilesForDeleteInput {
  readonly storageFileCollection: StorageFileFirestoreCollection;
  readonly constraints: FirestoreQueryConstraint[];
  readonly queuedForDeleteTime?: Maybe<StorageFileQueueForDeleteTime>;
  /**
   * Array of document keys that should be ignored/skipped while flagging.
   */
  readonly skipDeleteForKeys?: ArrayOrValue<StorageFileKey>;
}

export interface QueryAndFlagStorageFilesForDeleteResult {
  readonly visitedCount: number;
  readonly queuedForDeleteCount: number;
}

/**
 * Performs a query and flags the matching StorageFiles for deletion.
 *
 * @param input The input for the query and flagging.
 * @returns The result of the query and flagging.
 */
export async function queryAndFlagStorageFilesForDelete(input: QueryAndFlagStorageFilesForDeleteInput): Promise<QueryAndFlagStorageFilesForDeleteResult> {
  const { storageFileCollection, constraints, queuedForDeleteTime: inputQueueForDeleteTime, skipDeleteForKeys } = input;
  const queuedForDeleteTime = inputQueueForDeleteTime ?? true;
  const skipDeleteSet = new Set(asArray(skipDeleteForKeys));

  let visitedCount = 0;
  let queuedForDeleteCount = 0;

  await iterateFirestoreDocumentSnapshotPairs({
    documentAccessor: storageFileCollection.documentAccessor(),
    iterateSnapshotPair: async (snapshotPair) => {
      const { document, data: storageFile } = snapshotPair;

      if (!storageFile.sdat && !skipDeleteSet.has(storageFile.key)) {
        await document.update(markStorageFileForDeleteTemplate(queuedForDeleteTime));
        queuedForDeleteCount++;
      }

      visitedCount++;
    },
    queryFactory: storageFileCollection,
    constraintsFactory: () => constraints,
    batchSize: undefined,
    performTasksConfig: {
      maxParallelTasks: 20
    }
  });

  return {
    visitedCount,
    queuedForDeleteCount
  };
}

/**
 * Creates a template for updating a StorageFile to be queued for deletion at the input time.
 *
 * @param queueForDeleteTime When to delete the StorageFile. If true or unset, the StorageFile will be flagged to be deleted immediately.
 * @returns The update template for the StorageFile.
 */
export function markStorageFileForDeleteTemplate(queueForDeleteTime?: Maybe<StorageFileQueueForDeleteTime>): Pick<StorageFile, 'sdat' | 'fs'> {
  const updateTemplate: Pick<StorageFile, 'sdat' | 'fs'> = {
    sdat: queueForDeleteTime === true || queueForDeleteTime == null ? new Date() : dateFromDateOrTimeNumber(queueForDeleteTime),
    fs: StorageFileState.QUEUED_FOR_DELETE
  };

  return updateTemplate;
}
