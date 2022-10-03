import { UpdateGuestbookEntryParams } from '@dereekb/demo-firebase';
import { DemoUpdateModelFunction } from '../function';
import { guestbookEntryForUser } from './guestbook.util';

export const updateGuestbookEntry: DemoUpdateModelFunction<UpdateGuestbookEntryParams> = async (request) => {
  const { nest, auth, data } = request;
  const guestbookEntryUpdateEntry = await nest.guestbookActions.updateGuestbookEntry(data);

  const uid = auth.uid;
  const { guestbook: guestbookId } = guestbookEntryUpdateEntry.params;

  const guestbookEntryDocument = guestbookEntryForUser(nest, guestbookId, uid);
  await guestbookEntryUpdateEntry(guestbookEntryDocument);
};
