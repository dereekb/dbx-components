import { CreateGuestbookParams } from '@dereekb/demo-firebase';
import { onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { DemoCreateModelfunction } from '../function';

export const createGuestbook: DemoCreateModelfunction<CreateGuestbookParams> = async (nest, data, context) => {
  const createGuestbook = await nest.guestbookActions.createGuestbook(data);
  const guestbook = await createGuestbook();
  return onCallCreateModelResultWithDocs(guestbook);
};
