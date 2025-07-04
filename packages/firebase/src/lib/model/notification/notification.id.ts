import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type FirestoreModelId, type FirestoreModelKey, type FlatFirestoreModelKey, twoWayFlatFirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey, type FirebaseAuthUserId, firestoreModelKey, type RootFirestoreModelIdentity, FirestoreModelIdInput, firestoreModelId } from '../../common';

/**
 * The NotificationBox's id is the two way flat firestore model key of the object that it represents.
 */
export type NotificationBoxId = FlatFirestoreModelKey;
export type NotificationBoxKey = FirestoreModelKey;

/**
 * Creates a NotificationBoxId from the input FirestoreModelKey.
 *
 * @param modelKey
 * @returns
 */
export const notificationBoxIdForModel = twoWayFlatFirestoreModelKey;
export const inferNotificationBoxRelatedModelKey = inferKeyFromTwoWayFlatFirestoreModelKey;

export type NotificationUserId = FlatFirestoreModelKey;
export type NotificationUserKey = FirestoreModelKey;

export type NotificationSummaryId = FlatFirestoreModelKey;
export type NotificationSummaryKey = FirestoreModelKey;

/**
 * Creates a NotificationSummaryId from the input FirestoreModelKey.
 *
 * @param modelKey
 * @returns
 */
export const notificationSummaryIdForModel = twoWayFlatFirestoreModelKey;

/**
 * Function used to retrieve a NotificationSummaryId given the input FirestoreAuthUserId.
 */
export type NotificationSummaryIdForUidFunction = FactoryWithRequiredInput<NotificationSummaryId, FirebaseAuthUserId>;

export function notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity(userModelIdentity: RootFirestoreModelIdentity): NotificationSummaryIdForUidFunction {
  return (uid) => twoWayFlatFirestoreModelKey(firestoreModelKey(userModelIdentity, uid));
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
 *
 * Ideally type values are shorter to reduce database size impact.
 */
export type NotificationTemplateType = string;

/**
 * Task type identifier of the notification, which is used to pass this task to the appropriate handler.
 *
 * Ideally type values are shorter to reduce database size impact.
 */
export type NotificationTaskType = string;

/**
 * Unique key for a notification task.
 *
 * Used as the notification task's id, so it must follow Firestore model id rules.
 *
 * Using a unique key for a notification task ensures that only one of this type of task can exist at a single time.
 *
 * If a unique key is reused, the new task will replace the old task.
 */
export type NotificationTaskUniqueId = FirestoreModelId;

/**
 * Creates a NotificationTaskUniqueId from the input model id and task type.
 *
 * @param input model id input
 * @param taskType task type
 * @returns NotificationTaskUniqueId
 */
export function notificationTaskUniqueId(input: FirestoreModelIdInput, taskType: NotificationTaskType): NotificationTaskUniqueId {
  return `${firestoreModelId(input)}_${taskType}`; // combineation of model id and template type
}
