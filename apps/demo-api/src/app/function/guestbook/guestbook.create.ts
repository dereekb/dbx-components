import { type CreateGuestbookParams } from 'demo-firebase';
import { onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { type DemoCreateModelFunction } from '../function';

export const createGuestbook: DemoCreateModelFunction<CreateGuestbookParams> = async (request) => {
  const { nest, auth, data } = request;
  const createGuestbook = await nest.guestbookActions.createGuestbook(data);
  const guestbook = await createGuestbook();
  return onCallCreateModelResultWithDocs(guestbook);
};
