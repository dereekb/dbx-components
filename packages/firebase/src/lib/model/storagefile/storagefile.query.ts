import { Maybe } from '@dereekb/util';
import { whereDateIsBefore } from '../../common/firestore/query/constraint.template';
import { FirestoreQueryConstraint, where } from '../../common/firestore/query/constraint';
import { StorageFile, StorageFileProcessingState } from './storagefile';

// MARK: StorageFile
/**
 * Returns a query constraint for StorageFiles that are queued for processing.
 */
export function storageFilesQueuedForProcessingQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFile>('ps', '==', StorageFileProcessingState.QUEUED_FOR_PROCESSING)];
}

/**
 * Returns a query constraint for StorageFiles that are queued for deletion and are past their scheduled delete date.
 */
export function storageFilesQueuedForDeleteQuery(now?: Maybe<Date>): FirestoreQueryConstraint[] {
  return [whereDateIsBefore<StorageFile>('sdat', now ?? new Date())];
}
