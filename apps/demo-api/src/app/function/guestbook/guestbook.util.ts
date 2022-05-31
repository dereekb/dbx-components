import { GuestbookEntryDocument } from '@dereekb/demo-firebase';
import { FirebaseAuthUserId } from '@dereekb/firebase';
import { ModelKey } from '@dereekb/util';
import { DemoApiNestContext } from '../function';

export function guestbookEntryForUser(nest: DemoApiNestContext, guestbookId: ModelKey, uid: FirebaseAuthUserId): GuestbookEntryDocument {
  const guestbookFirestoreCollection = nest.demoFirestoreCollections.guestbookCollection;
  const guestbookEntryFirestoreCollectionFactory = nest.demoFirestoreCollections.guestbookEntryCollectionFactory;
  const guestbookDocument = guestbookFirestoreCollection.documentAccessor().loadDocumentForPath(guestbookId);
  const guestbookEntryDocument = guestbookEntryFirestoreCollectionFactory(guestbookDocument).documentAccessor().loadDocumentForPath(uid);
  return guestbookEntryDocument;
}
