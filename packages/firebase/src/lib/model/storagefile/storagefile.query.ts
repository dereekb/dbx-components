import { type Maybe } from '@dereekb/util';
import { whereDateIsBefore } from '../../common/firestore/query/constraint.template';
import { type FirestoreQueryConstraint, where } from '../../common/firestore/query/constraint';
import { type StorageFile, type StorageFileGroup, StorageFileProcessingState } from './storagefile';
import { type StorageFilePurposeSubgroup, type StorageFilePurpose } from './storagefile.id';
import { type FirebaseAuthUserId } from '../../common/auth/auth';

// MARK: StorageFile
/**
 * Returns query constraints for StorageFiles with `ps == QUEUED_FOR_PROCESSING`.
 *
 * Used by the server action service to find files awaiting processing task creation.
 *
 * @returns Firestore query constraints for StorageFiles queued for processing.
 *
 * @example
 * ```ts
 * const constraints = storageFilesQueuedForProcessingQuery();
 * const results = await collection.query(constraints);
 * ```
 */
export function storageFilesQueuedForProcessingQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFile>('ps', '==', StorageFileProcessingState.QUEUED_FOR_PROCESSING)];
}

/**
 * Returns query constraints for StorageFiles whose scheduled delete date (`sdat`) has passed.
 *
 * Used by the cleanup service to find files ready for permanent deletion.
 *
 * @param now - Reference time for comparison; defaults to current time.
 * @returns Firestore query constraints for StorageFiles whose scheduled delete date has passed.
 *
 * @example
 * ```ts
 * const constraints = storageFilesQueuedForDeleteQuery();
 * ```
 */
export function storageFilesQueuedForDeleteQuery(now?: Maybe<Date>): FirestoreQueryConstraint[] {
  return [whereDateIsBefore<StorageFile>('sdat', now ?? new Date())];
}

/**
 * Input for querying StorageFiles by purpose and owning user, with optional subgroup filtering.
 */
export interface StorageFilePurposeAndUserQueryInput {
  readonly user: FirebaseAuthUserId;
  readonly purpose: StorageFilePurpose;
  /**
   * Target a specific subgroup
   */
  readonly purposeSubgroup?: Maybe<StorageFilePurposeSubgroup>;
}

/**
 * Returns query constraints for StorageFiles matching a specific purpose and user,
 * with optional subgroup filtering.
 *
 * @param input - The user, purpose, and optional subgroup to filter by.
 * @returns Firestore query constraints for the given purpose and user.
 *
 * @example
 * @example
 * ```ts
 * const constraints = storageFilePurposeAndUserQuery({
 *   user: 'user123',
 *   purpose: 'avatar'
 * });
 * ```
 */
export function storageFilePurposeAndUserQuery(input: StorageFilePurposeAndUserQueryInput): FirestoreQueryConstraint[] {
  const constraints: FirestoreQueryConstraint[] = [where<StorageFile>('p', '==', input.purpose), where<StorageFile>('u', '==', input.user)];

  if (input.purposeSubgroup) {
    constraints.push(where<StorageFile>('pg', '==', input.purposeSubgroup));
  }

  return constraints;
}

/**
 * Returns query constraints for StorageFiles flagged for group synchronization (`gs == true`).
 *
 * Used by the sync service to find files whose group memberships need to be propagated.
 *
 * @returns Firestore query constraints for StorageFiles flagged for group synchronization.
 *
 * @example
 * @example
 * ```ts
 * const constraints = storageFileFlaggedForSyncWithGroupsQuery();
 * ```
 */
export function storageFileFlaggedForSyncWithGroupsQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFile>('gs', '==', true)];
}

// MARK: StorageFileGroup
/**
 * Returns query constraints for StorageFileGroups that need initialization (`s == true`).
 *
 * Used by the initialization service to find newly-created groups that haven't been synced yet.
 *
 * @returns Firestore query constraints for StorageFileGroups needing initialization.
 *
 * @example
 * @example
 * ```ts
 * const constraints = storageFileGroupsFlaggedForNeedsInitializationQuery();
 * ```
 */
export function storageFileGroupsFlaggedForNeedsInitializationQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFileGroup>('s', '==', true)];
}

/**
 * Returns query constraints for StorageFileGroups flagged for content regeneration (`re == true`).
 *
 * @returns Firestore query constraints for StorageFileGroups flagged for content regeneration.
 *
 * @example
 * @example
 * ```ts
 * const constraints = storageFileGroupsFlaggedForContentRegenerationQuery();
 * ```
 */
export function storageFileGroupsFlaggedForContentRegenerationQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFileGroup>('re', '==', true)];
}

/**
 * Returns query constraints for StorageFileGroups flagged as invalid (`fi == true`).
 *
 * Invalid groups are typically cleaned up (deleted along with their associated files).
 *
 * @returns Firestore query constraints for StorageFileGroups flagged as invalid.
 *
 * @example
 * @example
 * ```ts
 * const constraints = storageFileGroupsFlaggedInvalidQuery();
 * ```
 */
export function storageFileGroupsFlaggedInvalidQuery(): FirestoreQueryConstraint[] {
  return [where<StorageFileGroup>('fi', '==', true)];
}
