import { type FirestoreQueryConstraint, where } from '@dereekb/firebase';

/**
 * Creates a Firestore query constraint that filters guestbooks by their published status.
 *
 * @param published - Whether to match published or unpublished guestbooks. Defaults to true.
 * @returns A FirestoreQueryConstraint filtering on the 'published' field.
 */
export function publishedGuestbook(published = true): FirestoreQueryConstraint {
  return where('published', '==', published);
}

/**
 * Creates a Firestore query constraint that filters guestbook entries by their published status.
 *
 * @param published - Whether to match published or unpublished entries. Defaults to true.
 * @returns A FirestoreQueryConstraint filtering on the 'published' field.
 */
export function publishedGuestbookEntry(published = true): FirestoreQueryConstraint {
  return where('published', '==', published);
}
