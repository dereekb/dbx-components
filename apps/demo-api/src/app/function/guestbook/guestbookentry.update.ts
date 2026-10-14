import { type InsertGuestbookEntryParams, type InsertGuestbookEntryResult, type LikeGuestbookEntryParams, insertGuestbookEntryParamsType, likeGuestbookEntryParamsType } from 'demo-firebase';
import { type DemoUpdateModelFunction } from '../function.context';
import { guestbookEntryForUser } from './guestbook.util';
import { withApiDetails } from '@dereekb/firebase-server';

export const guestbookEntryInsert: DemoUpdateModelFunction<InsertGuestbookEntryParams, InsertGuestbookEntryResult> = withApiDetails({
  inputType: insertGuestbookEntryParamsType,
  mcp: {
    // Additive: upserts the caller's own entry.
    destructive: false
  },
  fn: async (request) => {
    const { nest, auth, data } = request;
    const insertGuestbookEntry = await nest.guestbookActions.insertGuestbookEntry(data);

    const guestbookEntryDocument = guestbookEntryForUser(nest, insertGuestbookEntry.params.guestbook, auth.uid);
    await insertGuestbookEntry(guestbookEntryDocument);

    return { modelKeys: [guestbookEntryDocument.key] };
  }
});

export const guestbookEntryLike: DemoUpdateModelFunction<LikeGuestbookEntryParams> = withApiDetails({
  inputType: likeGuestbookEntryParamsType,
  mcp: {
    // Additive: increments a like counter.
    destructive: false
  },
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
