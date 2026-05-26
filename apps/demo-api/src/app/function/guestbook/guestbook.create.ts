import { type CreateGuestbookParams, createGuestbookParamsType } from 'demo-firebase';
import { onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoCreateModelFunction } from '../function.context';

export const guestbookCreate: DemoCreateModelFunction<CreateGuestbookParams> = withApiDetails({
  inputType: createGuestbookParamsType,
  analytics: {
    onTriggered: (analytics) => {
      analytics.sendEventType('Guestbook Create Triggered');
    },
    onSuccess: (analytics, request, result) => {
      analytics.sendEvent('Guestbook Created', { modelKeys: result?.modelKeys });
    },
    onError: (analytics) => {
      analytics.sendEventType('Guestbook Create Failed');
    },
    onComplete: (analytics) => {
      analytics.sendEventType('Guestbook Create Complete');
    }
  },
  fn: async (request) => {
    const { nest, auth, data: inputData } = request;

    const data: CreateGuestbookParams = {
      ...inputData,
      cby: auth.uid
    };

    const createGuestbook = await nest.guestbookActions.createGuestbook(data);
    const guestbook = await createGuestbook();
    return onCallCreateModelResultWithDocs(guestbook);
  }
});
