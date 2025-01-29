import { type NotificationMessageFunctionFactory, type NotificationTemplateType, type CreateNotificationTemplate, createNotificationTemplate, type FirebaseAuthUserId } from '@dereekb/firebase';
import { ProfileDocument } from './profile';

// MARK: Test Notifications
export const TEST_NOTIFICATIONS_TEMPLATE_TYPE: NotificationTemplateType = 'TEST';

export const EXAMPLE_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'EXAMPLE_NOTIFICATION';

export interface ExampleNotificationInput extends ExampleNotificationData {
  readonly profileDocument: ProfileDocument;
}

export interface ExampleNotificationData {
  readonly uid: FirebaseAuthUserId; // user id to store in the notification
}

export function exampleNotification(input: ExampleNotificationInput): CreateNotificationTemplate {
  const { profileDocument } = input;
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
      uid
    }
  });
}

// MARK: All Notifications
export const DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_FACTORY_RECORD: Record<NotificationTemplateType, NotificationMessageFunctionFactory> = {};
