import { type NotificationTemplateType, type CreateNotificationTemplate, createNotificationTemplate, type FirebaseAuthUserId, ReadFirestoreModelKeyInput, firestoreModelKey, NotificationTemplateTypeInfo, notificationTemplateTypeDetailsRecord, readFirestoreModelKey, firestoreModelKeyParentKey, firestoreModelId, NotificationSummaryIdForUidFunction, twoWayFlatFirestoreModelKey, notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity } from '@dereekb/firebase';
import { ProfileDocument, profileIdentity } from './profile';
import { Guestbook, GuestbookEntry, GuestbookEntryKey, GuestbookKey, guestbookEntryIdentity, guestbookIdentity } from './guestbook';

// MARK: Test Notification
export const TEST_NOTIFICATIONS_TEMPLATE_TYPE: NotificationTemplateType = 'TEST';

export const TEST_NOTIFICATIONS_TEMPLATE_TYPE_DETAILS: NotificationTemplateTypeInfo = {
  type: TEST_NOTIFICATIONS_TEMPLATE_TYPE,
  name: 'Test Type',
  description: 'A test notification for profiles.',
  notificationModelIdentity: profileIdentity
};

// MARK: Example Notification
export const EXAMPLE_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'E';

export const EXAMPLE_NOTIFICATION_TEMPLATE_TYPE_DETAILS: NotificationTemplateTypeInfo = {
  type: EXAMPLE_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Example Notification',
  description: 'An example notification.',
  notificationModelIdentity: profileIdentity
};

export interface ExampleNotificationInput {
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
export const GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'GBE_C';

export const GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_DETAILS: NotificationTemplateTypeInfo = {
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

// MARK: Guestbook Entry Notifications
export const GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'GBE_L';

export const GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE_DETAILS: NotificationTemplateTypeInfo = {
  type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Guestbook Entry Liked',
  description: 'A guestbook entry has been liked.',
  notificationModelIdentity: guestbookIdentity, // occurs in guestbooks
  targetModelIdentity: guestbookEntryIdentity // targets guestbook entries
};

export interface GuestbookEntryLikedNotificationData {}

export interface GuestbookEntryLikedNotificationInput {
  readonly guestbookEntryKey: ReadFirestoreModelKeyInput<GuestbookEntry>;
}

export function guestbookEntryLikedNotificationTemplate(input: GuestbookEntryLikedNotificationInput): CreateNotificationTemplate {
  const { guestbookEntryKey } = input;
  const guestbookEntryModelKey = readFirestoreModelKey(guestbookEntryKey) as GuestbookEntryKey;
  const guestbookKey = firestoreModelKeyParentKey(guestbookEntryModelKey, 1) as GuestbookKey;
  const creatorUid = firestoreModelId(guestbookEntryModelKey);

  return createNotificationTemplate({
    type: GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE,
    notificationModel: guestbookKey,
    targetModel: guestbookEntryModelKey,
    r: [
      {
        uid: creatorUid,
        // only send to notification summary by default
        sn: true,
        // by default, don't send to email/text
        se: false,
        st: false
      }
    ]
  });
}

// MARK: All Notifications
export const DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_DETAILS_RECORD = notificationTemplateTypeDetailsRecord([TEST_NOTIFICATIONS_TEMPLATE_TYPE_DETAILS, EXAMPLE_NOTIFICATION_TEMPLATE_TYPE_DETAILS, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_DETAILS, GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE_DETAILS]);

export const DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID: NotificationSummaryIdForUidFunction = notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity(profileIdentity);
