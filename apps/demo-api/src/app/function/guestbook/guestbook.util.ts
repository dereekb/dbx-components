import { GuestbookEntryDocument } from '@dereekb/demo-firebase';
import { FirebaseAuthUserId } from '@dereekb/firebase';
import { ModelKey } from '@dereekb/util';
import { DemoApiNestContext } from '../function';

export function guestbookEntryForUser(nest: DemoApiNestContext, guestbookId: ModelKey, uid: FirebaseAuthUserId): GuestbookEntryDocument {
  const guestbookFirestoreCollection = nest.demoFirestoreCollections.guestbookCollection;
  const guestbookEntryFirestoreCollectionFactory = nest.demoFirestoreCollections.guestbookEntryCollectionFactory;
  const guestbookDocument = guestbookFirestoreCollection.documentAccessor().loadDocumentForId(guestbookId);
  const guestbookEntryDocument = guestbookEntryFirestoreCollectionFactory(guestbookDocument).documentAccessor().loadDocumentForId(uid);
  return guestbookEntryDocument;
}
