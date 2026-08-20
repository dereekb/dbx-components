import { type FirestoreQueryConstraint, where } from '@dereekb/firebase';
import { type Guestbook, type GuestbookEntry } from './guestbook';

/**
 * Params for {@link publishedGuestbooksQuery}.
 */
export interface PublishedGuestbooksQueryParams {
  /**
   * Whether to match published or unpublished guestbooks.
   */
  readonly published: boolean;
}

/**
 * Query for the guestbooks in the given published state.
 *
 * @param params - The published state to match.
 * @returns Firestore query constraints for guestbooks in that state.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Guestbook
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory listing
 */
export function publishedGuestbooksQuery(params: PublishedGuestbooksQueryParams): FirestoreQueryConstraint[] {
  return [where<Guestbook>('published', '==', params.published)];
}

/**
 * Params for {@link publishedGuestbookEntriesQuery}.
 */
export interface PublishedGuestbookEntriesQueryParams {
  /**
   * Whether to match published or unpublished entries.
   */
  readonly published: boolean;
}

/**
 * Query for the guestbook entries in the given published state.
 *
 * Declared at `COLLECTION_GROUP` scope because it is used both within a single guestbook's `gbe`
 * subcollection and across the `gbe` collection group. Firestore auto-indexes single fields at
 * COLLECTION scope only, so the group-scoped use needs the explicit `fieldOverrides` entry this
 * scope tag emits — without it the group query fails `FAILED_PRECONDITION` against a real project
 * (the emulator does not enforce indexes, so it passes locally either way).
 *
 * @param params - The published state to match.
 * @returns Firestore query constraints for entries in that state.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel GuestbookEntry
 * @dbxModelFirebaseIndexScope COLLECTION_GROUP
 * @dbxModelFirebaseIndexCategory listing
 */
export function publishedGuestbookEntriesQuery(params: PublishedGuestbookEntriesQueryParams): FirestoreQueryConstraint[] {
  return [where<GuestbookEntry>('published', '==', params.published)];
}
