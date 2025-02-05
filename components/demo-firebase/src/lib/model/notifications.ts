import { type NotificationMessageFunctionFactory, type NotificationTemplateType, type CreateNotificationTemplate, createNotificationTemplate, type FirebaseAuthUserId, ReadFirestoreModelKeyInput, firestoreModelKey, NotificationTemplateTypeDetails, notificationTemplateTypeDetailsRecord } from '@dereekb/firebase';
import { ProfileDocument, ProfileId, profileIdentity } from './profile';
import { Guestbook, guestbookIdentity } from './guestbook';

// MARK: Test Notification
export const TEST_NOTIFICATIONS_TEMPLATE_TYPE: NotificationTemplateType = 'TEST';

// MARK: Example Notification
export const EXAMPLE_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'EXAMPLE_NOTIFICATION';

export const EXAMPLE_NOTIFICATION_TEMPLATE_TYPE_DETAILS: NotificationTemplateTypeDetails = {
  type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Example Notification',
  description: 'An example notification.',
  notificationModelIdentity: profileIdentity
};

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

// MARK: Guestbook Notifications
export const GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'GUESTBOOK_ENTRY_CREATED';

export const GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_DETAILS: NotificationTemplateTypeDetails = {
  type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Guestbook Entry Created',
  description: 'A new guestbook entry has been created.',
  notificationModelIdentity: guestbookIdentity
};

export interface GuestbookEntryCreatedNotificationData {}

export interface GuestbookEntryCreatedNotificationInput {
  readonly guestbookKey: ReadFirestoreModelKeyInput<Guestbook>;
}

export function guestbookEntryCreatedNotificationTemplate(input: GuestbookEntryCreatedNotificationInput): CreateNotificationTemplate {
  const { guestbookKey } = input;

  return createNotificationTemplate({
    type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
    notificationModel: guestbookKey,
    targetModel: guestbookKey
  });
}

// MARK: All Notifications
export const DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_DETAILS_RECORD = notificationTemplateTypeDetailsRecord([EXAMPLE_NOTIFICATION_TEMPLATE_TYPE_DETAILS, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_DETAILS]);
