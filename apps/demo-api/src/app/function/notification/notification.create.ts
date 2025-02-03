import { CreateNotificationParams, onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { DemoCreateModelFunction } from '../function';

export const notificationCreate: DemoCreateModelFunction<CreateNotificationParams> = async (request) => {
  const { nest, data, auth } = request;
  const dataWithUid = { ...data, cb: auth.uid };

  const createNotification = await nest.notificationActions.createNotification(dataWithUid);
  const notificationBoxDocument = await nest.useModel('notificationBox', {
    request,
    key: data.key,
    roles: 'createNotification',
    use: (x) => x.document
  });

  const result = await createNotification(notificationBoxDocument);
  return onCallCreateModelResultWithDocs(result);
};
