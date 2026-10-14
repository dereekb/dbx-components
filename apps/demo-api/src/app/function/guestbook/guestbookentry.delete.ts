import { type GuestbookEntryParams, guestbookEntryParamsType } from 'demo-firebase';
import { type DemoDeleteModelFunction } from '../function.context';
import { assertValidParams, withApiDetails } from '@dereekb/firebase-server';
import { guestbookDocumentForParam } from './guestbook.util';

export const guestbookEntryDelete: DemoDeleteModelFunction<GuestbookEntryParams> = withApiDetails({
  inputType: guestbookEntryParamsType,
  fn: async (request) => {
    const { nest, auth } = request;
    const params = assertValidParams(guestbookEntryParamsType, request.data);

    // the caller must be able to read the guestbook their entry is in
    const guestbookDocument = await nest.useModel('guestbook', {
      request,
      key: guestbookDocumentForParam(nest, params.guestbook).key,
      roles: 'read',
      use: (x) => x.document
    });

    // a GuestbookEntry's document id is its author's uid, so this is always the caller's own entry
    const entryDocument = nest.demoFirestoreCollections.guestbookEntryCollectionFactory(guestbookDocument).documentAccessor().loadDocumentForId(auth.uid);
    await entryDocument.accessor.delete();
  }
});
