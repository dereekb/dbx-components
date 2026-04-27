/**
 * @module notification.id
 *
 * ID types and generation functions for notification model documents.
 *
 * Notification documents use "two-way flat keys" as their document IDs. A two-way flat key
 * encodes a hierarchical Firestore model key (e.g., `'collection/id'`) into a flat string
 * (e.g., `'collection_id'`) that can be used as a document ID while remaining reversible
 * back to the original key via {@link inferNotificationBoxRelatedModelKey}.
 *
 * This pattern allows {@link NotificationBox} and {@link NotificationSummary} documents
 * to be stored in top-level collections while maintaining a bidirectional link to the
 * model they represent.
 */
import { type FactoryWithRequiredInput } from '@dereekb/util';
import { type FirestoreModelId, type FirestoreModelKey, type FlatFirestoreModelKey, twoWayFlatFirestoreModelKey, inferKeyFromTwoWayFlatFirestoreModelKey, type FirebaseAuthUserId, firestoreModelKey, type RootFirestoreModelIdentity, type FirestoreModelIdInput, firestoreModelId, type FirestoreCollectionName } from '../../common';

/**
 * Document ID for a {@link NotificationBox}. Encoded as a two-way flat key of the model it represents.
 *
 * @example
 * ```ts
 * const boxId: NotificationBoxId = notificationBoxIdForModel('project/abc123');
 * // boxId === 'project_abc123'
 * ```
 */
export type NotificationBoxId = FlatFirestoreModelKey;

/**
 * Full Firestore model key path for a {@link NotificationBox} document (e.g., `'notificationBox/project_abc123'`).
 */
export type NotificationBoxKey = FirestoreModelKey;

/**
 * A box ID or collection name prefix used to exclude a user from receiving notifications.
 *
 * Supports prefix matching: excluding `'ab_123'` also excludes child boxes like `'ab_123_cd_456'`.
 * Used when a user temporarily loses access to a resource and should stop receiving its notifications.
 *
 * @see {@link NotificationUser.x} where exclusions are stored
 */
export type NotificationBoxSendExclusion = FirestoreCollectionName | NotificationBoxId;

/**
 * List of {@link NotificationBoxSendExclusion} entries for a user.
 */
export type NotificationBoxSendExclusionList = NotificationBoxSendExclusion[];

/**
 * Converts a Firestore model key to a {@link NotificationBoxId} using two-way flat key encoding.
 *
 * @example
 * ```ts
 * const boxId = notificationBoxIdForModel('project/abc123');
 * // boxId === 'project_abc123'
 * ```
 */
export const notificationBoxIdForModel = twoWayFlatFirestoreModelKey;

/**
 * Reverses a {@link NotificationBoxId} back to the original Firestore model key.
 *
 * @example
 * ```ts
 * const modelKey = inferNotificationBoxRelatedModelKey('project_abc123');
 * // modelKey === 'project/abc123'
 * ```
 */
export const inferNotificationBoxRelatedModelKey = inferKeyFromTwoWayFlatFirestoreModelKey;

/**
 * Document ID for a {@link NotificationUser}. Encoded as a flat key derived from the user's auth identity.
 */
export type NotificationUserId = FlatFirestoreModelKey;

/**
 * Full Firestore model key path for a {@link NotificationUser} document.
 */
export type NotificationUserKey = FirestoreModelKey;

/**
 * Document ID for a {@link NotificationSummary}. Encoded as a two-way flat key of the model it represents.
 */
export type NotificationSummaryId = FlatFirestoreModelKey;

/**
 * Full Firestore model key path for a {@link NotificationSummary} document.
 */
export type NotificationSummaryKey = FirestoreModelKey;

/**
 * Converts a Firestore model key to a {@link NotificationSummaryId} using two-way flat key encoding.
 *
 * @example
 * ```ts
 * const summaryId = notificationSummaryIdForModel('project/abc123');
 * // summaryId === 'project_abc123'
 * ```
 */
export const notificationSummaryIdForModel = twoWayFlatFirestoreModelKey;

/**
 * Factory function that produces a {@link NotificationSummaryId} from a user's auth UID.
 *
 * Used to find the notification summary for a specific user's model identity.
 */
export type NotificationSummaryIdForUidFunction = FactoryWithRequiredInput<NotificationSummaryId, FirebaseAuthUserId>;

/**
 * Creates a {@link NotificationSummaryIdForUidFunction} that generates summary IDs
 * by combining the given user model identity with the provided UID.
 *
 * @param userModelIdentity - the root identity for user models (e.g., `profileIdentity`)
 * @returns a function that generates a {@link NotificationSummaryId} for a given user UID
 *
 * @example
 * ```ts
 * const summaryIdForUid = notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity(profileIdentity);
 * const summaryId = summaryIdForUid('user-uid-123');
 * // summaryId === 'profile_user-uid-123'
 * ```
 */
export function notificationSummaryIdForUidFunctionForRootFirestoreModelIdentity(userModelIdentity: RootFirestoreModelIdentity): NotificationSummaryIdForUidFunction {
  return (uid) => twoWayFlatFirestoreModelKey(firestoreModelKey(userModelIdentity, uid));
}

/**
 * Document ID for a {@link NotificationWeek} (a {@link YearWeekCode} string).
 */
export type NotificationWeekId = FirestoreModelId;

/**
 * Full Firestore model key path for a {@link NotificationWeek} document.
 */
export type NotificationWeekKey = FirestoreModelKey;

/**
 * Document ID for a {@link Notification}.
 */
export type NotificationId = FirestoreModelId;

/**
 * Full Firestore model key path for a {@link Notification} document.
 */
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
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
 */
export type NotificationTemplateType = string;

/**
 * Task type identifier of the notification, which is used to pass this task to the appropriate handler.
 *
 * Ideally type values are shorter to reduce database size impact.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
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
 * @param input - model id input
 * @param taskType - task type
 * @returns the unique notification task id combining the model id and task type
 */
export function notificationTaskUniqueId(input: FirestoreModelIdInput, taskType: NotificationTaskType): NotificationTaskUniqueId {
  return `${firestoreModelId(input)}_${taskType}`; // combineation of model id and template type
}
