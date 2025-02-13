import { ResyncNotificationUserParams, UpdateNotificationUserParams } from '@dereekb/firebase';
import { DemoUpdateModelFunction } from '../function';
import { AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE } from '@dereekb/util';

export const updateNotificationUser: DemoUpdateModelFunction<UpdateNotificationUserParams> = async (request) => {
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

export const resyncNotificationUser: DemoUpdateModelFunction<ResyncNotificationUserParams> = async (request) => {
  const { nest, auth, data } = request;

  const resyncNotificationUser = await nest.notificationActions.resyncNotificationUser(data);
  const notificationUserDocument = await nest.useModel('notificationUser', {
    request,
    key: data.key,
    roles: 'sync',
    use: (x) => x.document
  });

  await resyncNotificationUser(notificationUserDocument);
};
