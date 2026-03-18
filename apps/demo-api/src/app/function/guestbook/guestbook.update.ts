import { type SubscribeToGuestbookNotificationsParams } from 'demo-firebase';
import { type DemoUpdateModelFunction } from '../function.context';
import { hasAuthRolesInRequest, withApiDetails } from '@dereekb/firebase-server';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';

export const guestbookSubscribeToNotifications: DemoUpdateModelFunction<SubscribeToGuestbookNotificationsParams> = withApiDetails({
  analytics: {
    onError: (analytics, request, error) => {
      analytics.sendEvent('Guestbook Subscribe To Notifications Failed', {
        errorCode: (error as any)?.code
      });
    }
  },
  fn: async (request) => {
    const { nest, auth, data: inputData } = request;

    let data = inputData;

    if (!data.uid || (data.uid !== auth.uid && !hasAuthRolesInRequest(request, AUTH_ADMIN_ROLE))) {
      data = {
        ...data,
        uid: auth.uid
      };
    }

    const guestbookDocument = await nest.useModel('guestbook', {
      request,
      key: data.key,
      roles: 'subscribeToNotifications',
      use: (x) => x.document
    });

    const subscribeToGuestbookNotifications = await nest.guestbookActions.subscribeToGuestbookNotifications(data);
    await subscribeToGuestbookNotifications(guestbookDocument);
  }
});
