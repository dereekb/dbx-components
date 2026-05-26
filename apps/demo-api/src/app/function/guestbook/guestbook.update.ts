import { type SubscribeToGuestbookNotificationsParams, subscribeToGuestbookNotificationsParamsType, type PublishGuestbookParams, publishGuestbookParamsType } from 'demo-firebase';
import { type DemoUpdateModelFunction } from '../function.context';
import { hasAuthRolesInRequest, withApiDetails } from '@dereekb/firebase-server';
import { AUTH_ADMIN_ROLE } from '@dereekb/util';

export const guestbookSubscribeToNotifications: DemoUpdateModelFunction<SubscribeToGuestbookNotificationsParams> = withApiDetails({
  inputType: subscribeToGuestbookNotificationsParamsType,
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

export const guestbookPublish: DemoUpdateModelFunction<PublishGuestbookParams> = withApiDetails({
  inputType: publishGuestbookParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const guestbookDocument = await nest.useModel('guestbook', {
      request,
      key: data.key,
      roles: 'publish',
      use: (x) => x.document
    });

    const publishGuestbook = await nest.guestbookActions.publishGuestbook(data);
    await publishGuestbook(guestbookDocument);
  }
});
