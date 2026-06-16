import { type UpdateNotificationBoxParams, type UpdateNotificationBoxRecipientParams } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type APP_CODE_PREFIXUpdateModelFunction } from '../function';

export const updateNotificationBox: APP_CODE_PREFIXUpdateModelFunction<UpdateNotificationBoxParams> = withApiDetails({
  fn: async (request) => {
    const { nest, auth, data } = request;

    const updateNotificationBox = await nest.notificationActions.updateNotificationBox(data);
    const notificationBoxDocument = await nest.useModel('notificationBox', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    await updateNotificationBox(notificationBoxDocument);
  }
});

export const updateNotificationBoxRecipient: APP_CODE_PREFIXUpdateModelFunction<UpdateNotificationBoxRecipientParams> = withApiDetails({
  fn: async (request) => {
    const { nest, auth, data } = request;

    const updateNotificationBoxRecipient = await nest.notificationActions.updateNotificationBoxRecipient(data);
    const notificationBoxDocument = await nest.useModel('notificationBox', {
      request,
      key: data.key,
      roles: 'manageRecipients',
      use: (x) => x.document
    });

    await updateNotificationBoxRecipient(notificationBoxDocument);
  }
});
