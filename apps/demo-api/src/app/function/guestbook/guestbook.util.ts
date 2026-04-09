import { type GuestbookEntryDocument } from 'demo-firebase';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { type ModelKey } from '@dereekb/util';
import { type DemoApiNestContext } from '../function.context';

/**
 * Loads the GuestbookEntryDocument for a specific user within a guestbook.
 * The entry document ID matches the user's UID, so each user has at most one entry per guestbook.
 *
 * @param nest - the NestJS context providing Firestore collection accessors
 * @param guestbookId - the ID of the parent guestbook
 * @param uid - the Firebase Auth UID identifying both the user and their entry document
 * @returns the GuestbookEntryDocument for the given user in the specified guestbook
 */
export function guestbookEntryForUser(nest: DemoApiNestContext, guestbookId: ModelKey, uid: FirebaseAuthUserId): GuestbookEntryDocument {
  const guestbookFirestoreCollection = nest.demoFirestoreCollections.guestbookCollection;
  const guestbookEntryFirestoreCollectionFactory = nest.demoFirestoreCollections.guestbookEntryCollectionFactory;
  const guestbookDocument = guestbookFirestoreCollection.documentAccessor().loadDocumentForId(guestbookId);
  return guestbookEntryFirestoreCollectionFactory(guestbookDocument).documentAccessor().loadDocumentForId(uid);
}
