import { type NotificationTemplateType, type CreateNotificationTemplate, createNotificationTemplate, type FirebaseAuthUserId, NotificationTemplateTypeInfo, notificationTemplateTypeInfoRecord, NotificationSummaryIdForUidFunction, notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity } from '@dereekb/firebase';
import { ProfileDocument, profileIdentity } from '../profile';
import { Maybe } from '@dereekb/util';

// MARK: Test Notification
export const TEST_NOTIFICATIONS_TEMPLATE_TYPE: NotificationTemplateType = 'TEST';

export const TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
  type: TEST_NOTIFICATIONS_TEMPLATE_TYPE,
  name: 'Test Type',
  description: 'A test notification for profiles.',
  notificationModelIdentity: profileIdentity
};

// MARK: Example Notification
export const EXAMPLE_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'E';

export const EXAMPLE_NOTIFICATION_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
  type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Example Notification',
  description: 'An example notification.',
  notificationModelIdentity: profileIdentity
};

export interface ExampleNotificationData {
  readonly uid: FirebaseAuthUserId; // user id to store in the notification
  readonly skipSend?: Maybe<boolean>;
}

export interface ExampleNotificationInput extends Omit<ExampleNotificationData, 'uid'> {
  readonly profileDocument: ProfileDocument;
}

export function exampleNotificationTemplate(input: ExampleNotificationInput): CreateNotificationTemplate {
  const { profileDocument, skipSend } = input;
  const uid = profileDocument.id;

  return createNotificationTemplate({
    type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
    /**
     * The notification model is the model to which this notification should be created on/delivered to when looking for a NotificationBox.
     */
    notificationModel: profileDocument,
    /**
     * The target model is the used to populate the "m" value of a Notification.
     */
    targetModel: profileDocument,
    data: {
      uid,
      skipSend
    }
  });
}

// MARK: All Notifications
export const DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD = notificationTemplateTypeInfoRecord([TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO, EXAMPLE_NOTIFICATION_TEMPLATE_TYPE_INFO]);

export const DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID: NotificationSummaryIdForUidFunction = notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity(profileIdentity);
