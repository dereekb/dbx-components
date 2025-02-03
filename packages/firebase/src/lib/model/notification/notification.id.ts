import { FirestoreModelId, type FirestoreModelKey, FlatFirestoreModelKey, twoWayFlatFirestoreModelKey } from '../../common';

/**
 * The NotificationBox's id is the flat firestore model key of the object that it represents.
 */
export type NotificationBoxId = FlatFirestoreModelKey;
export type NotificationBoxKey = FirestoreModelKey;

/**
 * Creates a NotificationBoxId from the input FirestoreModelKey.
 *
 * @param modelKey
 * @returns
 */
export function notificationBoxIdForModel(modelKey: FirestoreModelKey): NotificationBoxId {
  const flatModelKey = twoWayFlatFirestoreModelKey(modelKey);
  return flatModelKey;
}

export type NotificationWeekId = FirestoreModelId;
export type NotificationWeekKey = FirestoreModelKey;

export type NotificationId = FirestoreModelId;
export type NotificationKey = FirestoreModelKey;

/**
 * The default notification template type that can be provided to subscribe to notifications not specified in the configurations.
 */
export const DEFAULT_NOTIFICATION_TEMPLATE_TYPE = 'D';

/**
 * Template type identifier of the notification.
 *
 * Provides default information for the notification.
 *
 * Types are generally intended to be handled case-insensitively by notification services.
 */
export type NotificationTemplateType = string;
