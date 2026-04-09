import { type UpdateNotificationBoxParams, type UpdateNotificationBoxRecipientParams, updateNotificationBoxParamsType, updateNotificationBoxRecipientParamsType } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoUpdateModelFunction } from '../function.context';

export const updateNotificationBox: DemoUpdateModelFunction<UpdateNotificationBoxParams> = withApiDetails({
  inputType: updateNotificationBoxParamsType,
  fn: async (request) => {
    const { nest, auth: _auth, data } = request;

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

export const updateNotificationBoxRecipient: DemoUpdateModelFunction<UpdateNotificationBoxRecipientParams> = withApiDetails({
  inputType: updateNotificationBoxRecipientParamsType,
  fn: async (request) => {
    const { nest, auth: _auth, data } = request;

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
