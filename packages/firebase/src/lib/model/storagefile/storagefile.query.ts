import { type Maybe } from '@dereekb/util';
import { whereDateIsBefore } from '../../common/firestore/query/constraint.template';
import { type FirestoreQueryConstraint, where } from '../../common/firestore/query/constraint';
import { type StorageFile, type StorageFileGroup, StorageFileProcessingState } from './storagefile';
import { type StorageFilePurposeSubgroup, type StorageFilePurpose } from './storagefile.id';
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
  readonly user: FirebaseAuthUserId;
  readonly purpose: StorageFilePurpose;
  /**
   * Target a specific subgroup
   */
  readonly purposeSubgroup?: Maybe<StorageFilePurposeSubgroup>;
}

export function storageFilePurposeAndUserQuery(input: StorageFilePurposeAndUserQueryInput): FirestoreQueryConstraint[] {
  const constraints: FirestoreQueryConstraint[] = [where<StorageFile>('p', '==', input.purpose), where<StorageFile>('u', '==', input.user)];

  if (input.purposeSubgroup) {
    constraints.push(where<StorageFile>('pg', '==', input.purposeSubgroup));
  }

  return constraints;
}

export function storageFileFlaggedForSyncWithGroupsQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFile>('gs', '==', true)];
}

// MARK: StorageFileGroup
/**
 * Query for storageFileGroups that are flagged for initialization.
 *
 * @param now
 * @returns
 */
export function storageFileGroupsFlaggedForNeedsInitializationQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFileGroup>('s', '==', true)];
}

/**
 * Query for storageFileGroups that are flagged for content regeneration.
 *
 * @param now
 * @returns
 */
export function storageFileGroupsFlaggedForContentRegenerationQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFileGroup>('re', '==', true)];
}

/**
 * Query for storageFileGroups that are flagged as invalid.
 *
 * @param now
 * @returns
 */
export function storageFileGroupsFlaggedInvalidQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFileGroup>('fi', '==', true)];
}
