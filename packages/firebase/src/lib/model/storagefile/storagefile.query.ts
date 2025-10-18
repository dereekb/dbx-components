import { type Maybe } from '@dereekb/util';
import { whereDateIsBefore } from '../../common/firestore/query/constraint.template';
import { type FirestoreQueryConstraint, where } from '../../common/firestore/query/constraint';
import { type StorageFile, StorageFileProcessingState } from './storagefile';
import { type StorageFilePurpose } from './storagefile.id';
import { type FirebaseAuthUserId } from '../../common/auth/auth';

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

export interface StorageFilePurposeAndUserQueryInput {
  readonly purpose: StorageFilePurpose;
  readonly user: FirebaseAuthUserId;
}

export function storageFilePurposeAndUserQuery(input: StorageFilePurposeAndUserQueryInput): FirestoreQueryConstraint[] {
  return [where<StorageFile>('p', '==', input.purpose), where<StorageFile>('u', '==', input.user)];
}
