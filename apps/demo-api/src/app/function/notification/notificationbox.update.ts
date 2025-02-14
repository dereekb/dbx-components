import { UpdateNotificationBoxParams, UpdateNotificationBoxRecipientParams } from '@dereekb/firebase';
import { DemoUpdateModelFunction } from '../function';

export const updateNotificationBox: DemoUpdateModelFunction<UpdateNotificationBoxParams> = async (request) => {
  const { nest, auth, data } = request;

  const updateNotificationBox = await nest.notificationActions.updateNotificationBox(data);
  const notificationBoxDocument = await nest.useModel('notificationBox', {
    request,
    key: data.key,
    roles: 'update',
    use: (x) => x.document
  });

  await updateNotificationBox(notificationBoxDocument);
};

export const updateNotificationBoxRecipient: DemoUpdateModelFunction<UpdateNotificationBoxRecipientParams> = async (request) => {
  const { nest, auth, data } = request;

  const updateNotificationBoxRecipient = await nest.notificationActions.updateNotificationBoxRecipient(data);
  const notificationBoxDocument = await nest.useModel('notificationBox', {
    request,
    key: data.key,
    roles: 'manageRecipients',
    use: (x) => x.document
  });

  await updateNotificationBoxRecipient(notificationBoxDocument);
};
