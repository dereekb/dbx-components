import { type GuestbookEntryParams } from 'demo-firebase';
import { type DemoDeleteModelFunction } from '../function.context';

export const guestbookEntryDelete: DemoDeleteModelFunction<GuestbookEntryParams> = async (request) => {
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
};
