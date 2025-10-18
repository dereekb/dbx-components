import { type SendNotificationParams, type SendNotificationResult } from '@dereekb/firebase';
import { type DemoUpdateModelFunction } from '../function';

export const notificationSend: DemoUpdateModelFunction<SendNotificationParams, SendNotificationResult> = async (request) => {
  const { nest, data } = request;

  const sendNotification = await nest.notificationActions.sendNotification(data);
  const notificationDocument = await nest.useModel('notification', {
    request,
    key: data.key,
    roles: 'send',
    use: (x) => x.document
  });

  return sendNotification(notificationDocument);
};
