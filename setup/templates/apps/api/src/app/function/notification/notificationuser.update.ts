import { ResyncNotificationUserParams, ResyncNotificationUserResult, UpdateNotificationUserParams } from '@dereekb/firebase';
import { APP_CODE_PREFIXUpdateModelFunction } from '../function';

export const updateNotificationUser: APP_CODE_PREFIXUpdateModelFunction<UpdateNotificationUserParams> = async (request) => {
  const { nest, auth, data } = request;

  const updateNotificationUser = await nest.notificationActions.updateNotificationUser(data);
  const notificationUserDocument = await nest.useModel('notificationUser', {
    request,
    key: data.key,
    roles: 'update',
    use: (x) => x.document
  });

  await updateNotificationUser(notificationUserDocument);
};

export const resyncNotificationUser: APP_CODE_PREFIXUpdateModelFunction<ResyncNotificationUserParams, ResyncNotificationUserResult> = async (request) => {
  const { nest, auth, data } = request;

  const resyncNotificationUser = await nest.notificationActions.resyncNotificationUser(data);
  const notificationUserDocument = await nest.useModel('notificationUser', {
    request,
    key: data.key,
    roles: 'sync',
    use: (x) => x.document
  });

  return resyncNotificationUser(notificationUserDocument);
};
