import { type ResyncNotificationUserParams, type ResyncNotificationUserResult, type UpdateNotificationUserParams, updateNotificationUserParamsType, resyncNotificationUserParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoUpdateModelFunction } from '../function.context';

export const updateNotificationUser: DemoUpdateModelFunction<UpdateNotificationUserParams> = withApiDetails({
  inputType: updateNotificationUserParamsType,
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

export const resyncNotificationUser: DemoUpdateModelFunction<ResyncNotificationUserParams, ResyncNotificationUserResult> = withApiDetails({
  inputType: resyncNotificationUserParamsType,
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
