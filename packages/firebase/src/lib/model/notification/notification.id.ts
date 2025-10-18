import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type FirestoreModelId, type FirestoreModelKey, type FlatFirestoreModelKey, twoWayFlatFirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey, type FirebaseAuthUserId, firestoreModelKey, type RootFirestoreModelIdentity, type FirestoreModelIdInput, firestoreModelId, type FirestoreCollectionName } from '../../common';

/**
 * The NotificationBox's id is the two way flat firestore model key of the object that it represents.
 */
export type NotificationBoxId = FlatFirestoreModelKey;
export type NotificationBoxKey = FirestoreModelKey;

/**
 * A notification box id (or firestore collection name) that is used to exclude a user from receiving notifications from that box or any notification boxes that start with the same prefix.
 *
 * This is used in cases where a user might be removed from access temporarily and should not recieve any notifications from that box or any child boxes.
 *
 * For example, if a box with id ab_123 is excluded, then any notifications to child boxes that start with ab_123 (e.g. ab_123_cd_456) will also be excluded.
 */
export type NotificationBoxSendExclusion = FirestoreCollectionName | NotificationBoxId;

/**
 * List of notification box exclusions.
 */
export type NotificationBoxSendExclusionList = NotificationBoxSendExclusion[];

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
 * Equivalent to NotificationId, but can be used to more specifically refer to a Notification with a task type.
 */
export type NotificationTaskId = NotificationId;

/**
 * Equivalent to NotificationKey, but can be used to more specifically refer to a Notification with a task type.
 */
export type NotificationTaskKey = NotificationKey;

/**
 * The default notification template type that can be provided to subscribe to notifications not specified in the configurations.
 */
export const DEFAULT_NOTIFICATION_TEMPLATE_TYPE = 'D';

/**
 * The default notification model to use for a task notification.
 *
 * Task notifications are not required to specify a notification model since notification tasks do not interact with NotificationBoxes.
 */
export const DEFAULT_NOTIFICATION_TASK_NOTIFICATION_MODEL_KEY: FirestoreModelKey = 'not/not';

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
 * Reference to a notification task key
 */
export interface NotificationTaskKeyRef {
  readonly taskKey: NotificationTaskKey;
}

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
