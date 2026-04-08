import { type NotificationTemplateType, type CreateNotificationTemplate, createNotificationTemplate, type FirebaseAuthUserId, type NotificationTemplateTypeInfo, notificationTemplateTypeInfoRecord, type NotificationSummaryIdForUidFunction, notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity, firestoreModelId, firestoreModelKeyParentKey, readFirestoreModelKey, type ReadFirestoreModelKeyInput } from '@dereekb/firebase';
import { type ProfileDocument, profileIdentity } from '../profile';
import { type Guestbook, type GuestbookEntry, type GuestbookEntryKey, type GuestbookKey, guestbookEntryIdentity, guestbookIdentity } from '../guestbook';
import { type Maybe } from '@dereekb/util';

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

export const EXAMPLE_NOTIFICATION_TEMPLATE_ON_SEND_ATTEMPTED_RESULT = 1;
export const EXAMPLE_NOTIFICATION_TEMPLATE_ON_SEND_SUCCESS_RESULT = 2;

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

/**
 * Creates a notification template for the example notification type.
 *
 * The template targets the given profile for both the notification model
 * (where the notification box is resolved) and the target model.
 *
 * @param input - Configuration containing the profile document and optional skipSend flag.
 * @returns A CreateNotificationTemplate ready for submission to the notification service.
 */
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

// MARK: Guestbook Notifications
export const GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'GBE_C';

export const GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
  type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Guestbook Entry Created',
  description: 'A new guestbook entry has been created.',
  notificationModelIdentity: guestbookIdentity
};

export interface GuestbookEntryCreatedNotificationData {}

export interface GuestbookEntryCreatedNotificationInput {
  readonly guestbookKey: ReadFirestoreModelKeyInput<Guestbook>;
}

/**
 * Creates a notification template for when a new guestbook entry is created.
 *
 * The notification is scoped to the parent guestbook, so all users
 * subscribed to that guestbook's notification box will be notified.
 *
 * @param input - Configuration containing the guestbook key.
 * @returns A CreateNotificationTemplate for the guestbook entry creation event.
 */
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

export const GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
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

/**
 * Creates a notification template for when a guestbook entry is liked.
 *
 * Derives the parent guestbook key and entry creator UID from the entry key.
 * The notification is scoped to the parent guestbook, targets the liked entry,
 * and opts the entry creator into summary notifications by default.
 *
 * @param input - Configuration containing the guestbook entry key.
 * @returns A CreateNotificationTemplate for the guestbook entry liked event.
 */
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
        // opt-in to send to notification summary by default
        sn: true,
        // by default, don't send to email/text
        se: false,
        st: false
      }
    ]
  });
}

// MARK: All Notifications
export const DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD = notificationTemplateTypeInfoRecord([TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO, EXAMPLE_NOTIFICATION_TEMPLATE_TYPE_INFO, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_INFO, GUESTBOOK_ENTRY_LIKED_NOTIFICATION_TEMPLATE_TYPE_INFO]);

export const DEMO_API_NOTIFICATION_SUMMARY_ID_FOR_UID: NotificationSummaryIdForUidFunction = notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity(profileIdentity);
