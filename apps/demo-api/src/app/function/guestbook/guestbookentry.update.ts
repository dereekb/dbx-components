import { InsertGuestbookEntryParams } from '@dereekb/demo-firebase';
import { DemoUpdateModelFunction } from '../function';
import { guestbookEntryForUser } from './guestbook.util';

export const insertGuestbookEntry: DemoUpdateModelFunction<InsertGuestbookEntryParams> = async (request) => {
  const { nest, auth, data } = request;
  const guestbookEntryInsertEntry = await nest.guestbookActions.insertGuestbookEntry(data);

  const uid = auth.uid;
  const { guestbook: guestbookId } = guestbookEntryInsertEntry.params;

  const guestbookEntryDocument = guestbookEntryForUser(nest, guestbookId, uid);
  await guestbookEntryInsertEntry(guestbookEntryDocument);
};
