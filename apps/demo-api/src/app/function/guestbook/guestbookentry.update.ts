import { UpdateGuestbookEntryParams } from '@dereekb/demo-firebase';
import { inAuthContext } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from '../function';

export const guestbookEntryUpdateEntry = onCallWithDemoNestContext(inAuthContext(async (nest, data: UpdateGuestbookEntryParams, context) => {
  const guestbookEntryUpdateEntry = await nest.guestbookActions.guestbookEntryUpdateEntry(data);
  const params = guestbookEntryUpdateEntry.params;

  const guestbookFirestoreCollection = nest.demoFirestoreCollections.guestbookFirestoreCollection;
  const guestbookEntryFirestoreCollectionFactory = nest.demoFirestoreCollections.guestbookEntryCollectionFactory;

  const guestbookId = params.guestbook;
  const guestbookDocument = guestbookFirestoreCollection.documentAccessor().loadDocumentForPath(guestbookId);

  const uid = context.auth.uid;
  const guestbookEntryDocument = guestbookEntryFirestoreCollectionFactory(guestbookDocument).documentAccessor().loadDocumentForPath(uid);

  await guestbookEntryUpdateEntry(guestbookEntryDocument);
  return { success: true };
}));
