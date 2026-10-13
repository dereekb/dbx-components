import { type GuestbookDocument, type GuestbookEntryDocument, type GuestbookId, type GuestbookKey } from 'demo-firebase';
import { type FirebaseAuthUserId, loadDocumentForIdOrKey } from '@dereekb/firebase';
import { type DemoApiNestContext } from '../function.context';

/**
 * Loads the GuestbookDocument a `guestbook` param refers to, whether it is a guestbook id or a full guestbook key.
 *
 * Every handler with a `guestbook` param resolves it here, so the two forms work the same everywhere.
 *
 * @param nest - The NestJS context providing Firestore collection accessors.
 * @param guestbook - The guestbook's id (`abc123`) or its full key (`gb/abc123`).
 * @returns The GuestbookDocument the param refers to.
 * @throws {Error} When `guestbook` is a key of another collection.
 */
export function guestbookDocumentForParam(nest: DemoApiNestContext, guestbook: GuestbookId | GuestbookKey): GuestbookDocument {
  return loadDocumentForIdOrKey(nest.demoFirestoreCollections.guestbookCollection.documentAccessor(), guestbook);
}

/**
 * Loads the GuestbookEntryDocument for a specific user within a guestbook.
 * The entry document ID matches the user's UID, so each user has at most one entry per guestbook.
 *
 * @param nest - The NestJS context providing Firestore collection accessors.
 * @param guestbook - The parent guestbook's id (`abc123`) or its full key (`gb/abc123`).
 * @param uid - The Firebase Auth UID identifying both the user and their entry document.
 * @returns The GuestbookEntryDocument for the given user in the specified guestbook.
 */
export function guestbookEntryForUser(nest: DemoApiNestContext, guestbook: GuestbookId | GuestbookKey, uid: FirebaseAuthUserId): GuestbookEntryDocument {
  const guestbookDocument = guestbookDocumentForParam(nest, guestbook);
  return nest.demoFirestoreCollections.guestbookEntryCollectionFactory(guestbookDocument).documentAccessor().loadDocumentForId(uid);
}
