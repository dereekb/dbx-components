import { type ResyncNotificationUserParams, type ResyncNotificationUserResult, type UpdateNotificationUserParams } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXUpdateModelFunction } from '../function';

export const updateNotificationUser: APP_CODE_PREFIXUpdateModelFunction<UpdateNotificationUserParams> = withApiDetails({
  fn: async (request) => {
    const { nest, auth, data } = request;

    const updateNotificationUser = await nest.notificationActions.updateNotificationUser(data);
    const notificationUserDocument = await nest.useModel('notificationUser', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    await updateNotificationUser(notificationUserDocument);
  }
});

export const resyncNotificationUser: APP_CODE_PREFIXUpdateModelFunction<ResyncNotificationUserParams, ResyncNotificationUserResult> = withApiDetails({
  fn: async (request) => {
    const { nest, auth, data } = request;

    const resyncNotificationUser = await nest.notificationActions.resyncNotificationUser(data);
    const notificationUserDocument = await nest.useModel('notificationUser', {
      request,
      key: data.key,
      roles: 'sync',
      use: (x) => x.document
    });

    return resyncNotificationUser(notificationUserDocument);
  }
});
