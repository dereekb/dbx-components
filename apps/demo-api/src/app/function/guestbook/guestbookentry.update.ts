import { UpdateGuestbookEntryParams } from '@dereekb/demo-firebase';
import { inAuthContext } from '@dereekb/firebase-server';
import { onCallWithDemoNestContext } from '../function';
import { guestbookEntryForUser } from './guestbook.util';

export const guestbookEntryUpdateEntry = onCallWithDemoNestContext(inAuthContext(async (nest, data: UpdateGuestbookEntryParams, context) => {
  const guestbookEntryUpdateEntry = await nest.guestbookActions.guestbookEntryUpdateEntry(data);

  const uid = context.auth.uid;
  const { guestbook: guestbookId } = guestbookEntryUpdateEntry.params;

  const guestbookEntryDocument = guestbookEntryForUser(nest, guestbookId, uid);

  await guestbookEntryUpdateEntry(guestbookEntryDocument);
  return { success: true };
}));
