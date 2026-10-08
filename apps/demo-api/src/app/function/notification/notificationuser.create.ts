import { type CreateNotificationUserParams, createNotificationUserParamsType, onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { assertIsAdminOrTargetUserInRequestData, withApiDetails } from '@dereekb/firebase-server';
import { type DemoCreateModelFunction } from '../function.context';

/**
 * Creates the NotificationUser for a user so they can manage their notification settings before they are
 * added to any NotificationBox.
 *
 * A user may create their own; creating one for another user requires admin. Idempotent: an existing
 * NotificationUser is returned unchanged.
 */
export const notificationUserCreate: DemoCreateModelFunction<CreateNotificationUserParams> = withApiDetails({
  inputType: createNotificationUserParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminOrTargetUserInRequestData(request, true);

    const createNotificationUser = await nest.notificationActions.createNotificationUser(data);
    const notificationUserDocument = await createNotificationUser();

    return onCallCreateModelResultWithDocs(notificationUserDocument);
  }
});
