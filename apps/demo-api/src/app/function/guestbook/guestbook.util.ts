import { type GuestbookEntryDocument } from 'demo-firebase';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { type ModelKey } from '@dereekb/util';
import { type DemoApiNestContext } from '../function';

export function guestbookEntryForUser(nest: DemoApiNestContext, guestbookId: ModelKey, uid: FirebaseAuthUserId): GuestbookEntryDocument {
  const guestbookFirestoreCollection = nest.demoFirestoreCollections.guestbookCollection;
  const guestbookEntryFirestoreCollectionFactory = nest.demoFirestoreCollections.guestbookEntryCollectionFactory;
  const guestbookDocument = guestbookFirestoreCollection.documentAccessor().loadDocumentForId(guestbookId);
  const guestbookEntryDocument = guestbookEntryFirestoreCollectionFactory(guestbookDocument).documentAccessor().loadDocumentForId(uid);
  return guestbookEntryDocument;
}
