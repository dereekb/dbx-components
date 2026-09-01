import { type Maybe } from '@dereekb/util';
import { whereDateIsOnOrBefore } from '../../common/firestore/query/constraint.template';
import { type FirestoreQueryConstraint, orderBy, where, limit } from '../../common/firestore/query/constraint';
import { type FirebaseAuthOwnershipKey } from '../../common/auth/auth';
import { type StorageFile } from '../storagefile/storagefile';
import { type FormSpace, FormSpaceProcessingState } from './formspace';
import { type FormSpaceKey } from './formspace.id';
import { formSpaceStorageFileGroupId } from './formspace.util';

/**
 * @module formspace.query
 *
 * SINGLE-FIELD BY CONSTRUCTION. `firestore.indexes.json` is generated from downstream `-firebase`
 * components and cannot resolve an identity declared upstream here, so a FormSpace query that needed a
 * composite index would have no way to declare one. Every query below is therefore one field plus an
 * optional sort on that same field, which Firestore serves from its automatic single-field indexes.
 */

/**
 * Returns query constraints for FormSpaces awaiting a processing task (`ps == QUEUED_FOR_PROCESSING`).
 *
 * This is the backstop sweep: submission normally creates the task inline, so a space that is still sitting
 * here is one whose task creation was lost.
 *
 * @param limitCount - Maximum number of results. Omit for unbounded.
 * @returns Firestore query constraints for FormSpaces queued for processing.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel FormSpace
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory sweep
 *
 * @example
 * ```ts
 * const constraints = formSpacesQueuedForProcessingQuery(100);
 * ```
 */
export function formSpacesQueuedForProcessingQuery(limitCount?: Maybe<number>): FirestoreQueryConstraint[] {
  const constraints: FirestoreQueryConstraint[] = [where<FormSpace>('ps', '==', FormSpaceProcessingState.QUEUED_FOR_PROCESSING)];

  if (limitCount != null) {
    constraints.push(limit(limitCount));
  }

  return constraints;
}

/**
 * Input for {@link formSpacesDueForExpirationQuery}.
 */
export interface FormSpacesDueForExpirationQueryInput {
  /**
   * FormSpaces whose `eat` is at or before this instant are due.
   *
   * PIN THIS for the whole sweep rather than re-deriving it per page — a cutoff that advances with the
   * clock lets a space that ages mid-sweep join a page not yet reached, making the pass unbounded.
   */
  readonly before: Date;
  /**
   * Maximum number of results per page.
   */
  readonly limit?: Maybe<number>;
}

/**
 * Returns query constraints for FormSpaces whose expiration instant has arrived.
 *
 * NOTE: a Firestore inequality skips documents where the field is absent, so a space with no `eat` — one
 * whose type does not expire, or one that has already been submitted or expired and had `eat` cleared — is
 * not matched. That absence IS the exclusion mechanism; there is no second flag to keep in step.
 *
 * @param input - The pinned cutoff and page size.
 * @returns Firestore query constraints for FormSpaces due for expiration.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel FormSpace
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory cleanup
 *
 * @example
 * ```ts
 * const constraints = formSpacesDueForExpirationQuery({ before: new Date(), limit: 50 });
 * ```
 */
export function formSpacesDueForExpirationQuery(input: FormSpacesDueForExpirationQueryInput): FirestoreQueryConstraint[] {
  const constraints: FirestoreQueryConstraint[] = [orderBy<FormSpace>('eat', 'asc'), whereDateIsOnOrBefore<FormSpace>('eat', input.before)];

  if (input.limit != null) {
    constraints.push(limit(input.limit));
  }

  return constraints;
}

/**
 * Returns query constraints for every StorageFile that belongs to a FormSpace.
 *
 * A single `array-contains` on the group id, which Firestore serves from its automatic array index — the
 * FormSpace's own group id is the only handle needed, so nothing here requires a composite index.
 *
 * @param formSpaceKey - The FormSpace whose files to select.
 * @returns Firestore query constraints for the space's StorageFiles.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel StorageFile
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory lookup
 * @dbxModelFirebaseIndexSkip true
 *
 * @example
 * ```ts
 * const constraints = storageFilesForFormSpaceQuery('fsp/abc123');
 * ```
 */
export function storageFilesForFormSpaceQuery(formSpaceKey: FormSpaceKey): FirestoreQueryConstraint[] {
  return [where<StorageFile>('g', 'array-contains', formSpaceStorageFileGroupId(formSpaceKey))];
}

/**
 * Returns query constraints for every FormSpace carrying the given ownership key.
 *
 * Ordering is deliberately left to the caller/client: a second field here would need a composite index this
 * package has no way to declare.
 *
 * @param ownerKey - The ownership key to filter by.
 * @returns Firestore query constraints for the owner's FormSpaces.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel FormSpace
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory lookup
 *
 * @example
 * ```ts
 * const constraints = formSpacesForOwnerQuery('pr/abc123');
 * ```
 */
export function formSpacesForOwnerQuery(ownerKey: FirebaseAuthOwnershipKey): FirestoreQueryConstraint[] {
  return [where<FormSpace>('o', '==', ownerKey)];
}
