import { type InsertGuestbookEntryParams, type LikeGuestbookEntryParams, insertGuestbookEntryParamsType, likeGuestbookEntryParamsType } from 'demo-firebase';
import { type DemoUpdateModelFunction } from '../function.context';
import { guestbookEntryForUser } from './guestbook.util';
import { withApiDetails } from '@dereekb/firebase-server';

export const guestbookEntryInsert: DemoUpdateModelFunction<InsertGuestbookEntryParams> = withApiDetails({
  inputType: insertGuestbookEntryParamsType,
  fn: async (request) => {
    const { nest, auth, data } = request;
    const guestbookEntryInsertEntry = await nest.guestbookActions.insertGuestbookEntry(data);

    const uid = auth.uid;
    const { guestbook: guestbookId } = guestbookEntryInsertEntry.params;

    const guestbookEntryDocument = guestbookEntryForUser(nest, guestbookId, uid);
    await guestbookEntryInsertEntry(guestbookEntryDocument);
  }
});

export const guestbookEntryLike: DemoUpdateModelFunction<LikeGuestbookEntryParams> = withApiDetails({
  inputType: likeGuestbookEntryParamsType,
  fn: async (request) => {
    const { nest, data } = request;
    const likeFn = await nest.guestbookActions.likeGuestbookEntry(data);

    const guestbookEntryDocument = await nest.useModel('guestbookEntry', {
      request,
      key: data.key,
      roles: 'read',
      use: (x) => x.document
    });

    await likeFn(guestbookEntryDocument);
  }
});
