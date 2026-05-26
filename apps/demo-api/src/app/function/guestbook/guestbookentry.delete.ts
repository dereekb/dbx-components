import { type GuestbookEntryParams, guestbookEntryParamsType } from 'demo-firebase';
import { type DemoDeleteModelFunction } from '../function.context';
import { withApiDetails } from '@dereekb/firebase-server';

export const guestbookEntryDelete: DemoDeleteModelFunction<GuestbookEntryParams> = withApiDetails({
  inputType: guestbookEntryParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const guestbookDocument = await nest.useModel('guestbook', {
      request,
      key: data.guestbook,
      roles: 'read',
      use: (x) => x.document
    });

    const entryCollection = nest.demoFirestoreCollections.guestbookEntryCollectionFactory(guestbookDocument);
    const accessor = entryCollection.documentAccessor();
    const entryDocument = accessor.loadDocumentForKey(request.auth.uid);

    await entryDocument.accessor.delete();
  }
});
