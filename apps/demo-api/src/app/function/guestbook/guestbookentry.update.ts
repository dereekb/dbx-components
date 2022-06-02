import { UpdateGuestbookEntryParams } from '@dereekb/demo-firebase';
import { DemoUpdateModelfunction } from '../function';
import { guestbookEntryForUser } from './guestbook.util';

export const updateGuestbookEntry: DemoUpdateModelfunction<UpdateGuestbookEntryParams> = async (nest, data, context) => {
  const guestbookEntryUpdateEntry = await nest.guestbookActions.updateGuestbookEntry(data);

  const uid = context.auth.uid;
  const { guestbook: guestbookId } = guestbookEntryUpdateEntry.params;

  const guestbookEntryDocument = guestbookEntryForUser(nest, guestbookId, uid);
  await guestbookEntryUpdateEntry(guestbookEntryDocument);
};
