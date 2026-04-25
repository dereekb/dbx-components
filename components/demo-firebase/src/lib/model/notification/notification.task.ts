import { type CreateNotificationTaskTemplate, createNotificationTaskTemplate, type FirebaseAuthUserId, type NotificationTaskServiceHandleNotificationTaskResult, type NotificationTaskType } from '@dereekb/firebase';
import { type ProfileDocument } from '../profile';
import { type Maybe } from '@dereekb/util';

// MARK: Example Notification
export const EXAMPLE_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'E';

export type ExampleNotificationTaskCheckpoint = 'part_a' | 'part_b' | 'part_c';

export interface ExampleNotificationTaskData {
  readonly uid: FirebaseAuthUserId; // user id to store in the notification
  readonly value?: Maybe<number>;
  /**
   * If this value is defined, the task handler will return whatever value is present here.
   */
  readonly result?: Maybe<NotificationTaskServiceHandleNotificationTaskResult<ExampleNotificationTaskData>>;
  /**
   * If true, the "result" value will be merged with the default result.
   *
   * The "result" values will take priority over the default results.
   */
  readonly mergeResultWithDefaultResult?: boolean;
}

export const EXAMPLE_NOTIFICATION_TASK_PART_A_COMPLETE_VALUE = 100;
export const EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE = 200;

export interface ExampleNotificationTaskInput extends Omit<ExampleNotificationTaskData, 'uid'> {
  readonly profileDocument: ProfileDocument;
  readonly completedCheckpoints?: Maybe<ExampleNotificationTaskCheckpoint[]>;
}

/**
 * Creates a notification task template for the example notification type.
 *
 * The template targets the given profile for both the notification model
 * (where the notification box is resolved) and the target model.
 *
 * @param input - Configuration containing the profile document and optional completed checkpoints.
 * @returns A CreateNotificationTaskTemplate ready for submission to the notification task service.
 */
export function exampleNotificationTaskTemplate(input: ExampleNotificationTaskInput): CreateNotificationTaskTemplate {
  const { profileDocument } = input;
  const uid = profileDocument.id;

  return createNotificationTaskTemplate({
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
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
    },
    completedCheckpoints: input.completedCheckpoints
  });
}

export interface ExampleNotificationTaskWithNoModelInput extends Pick<ExampleNotificationTaskData, 'uid'> {
  readonly completedCheckpoints?: Maybe<ExampleNotificationTaskCheckpoint[]>;
}

/**
 * Same as exampleNotificationTaskTemplate but the created template has no notification model.
 *
 * @param input Same
 * @returns
 */
export function exampleNotificationTaskWithNoModelTemplate(input: ExampleNotificationTaskWithNoModelInput): CreateNotificationTaskTemplate {
  const { uid } = input;

  return createNotificationTaskTemplate({
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    data: {
      uid
    },
    completedCheckpoints: input.completedCheckpoints
  });
}

// MARK: Example Unique Notification
export const EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'EU';

export type ExampleUniqueNotificationTaskCheckpoint = 'part_a' | 'part_b';

export interface ExampleUniqueNotificationTaskData {
  readonly uid: FirebaseAuthUserId; // user id to store in the notification
}

export interface ExampleUniqueNotificationTaskInput extends Omit<ExampleUniqueNotificationTaskData, 'uid'> {
  readonly profileDocument: ProfileDocument;
  readonly completedCheckpoints?: Maybe<ExampleUniqueNotificationTaskCheckpoint[]>;
  readonly overrideExistingTask?: boolean;
}

/**
 * Creates a unique notification task template for the example unique notification type.
 *
 * Unique tasks ensure only one active task of this type exists per target.
 * The template targets the given profile for both the notification model
 * and the target model.
 *
 * @param input - Configuration containing the profile document, optional checkpoints, and override flag.
 * @returns A CreateNotificationTaskTemplate configured as unique.
 */
export function exampleUniqueNotificationTaskTemplate(input: ExampleUniqueNotificationTaskInput): CreateNotificationTaskTemplate {
  const { profileDocument, overrideExistingTask } = input;
  const uid = profileDocument.id;

  return createNotificationTaskTemplate({
    type: EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE,
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
    },
    completedCheckpoints: input.completedCheckpoints,
    unique: true,
    overrideExistingTask
  });
}

// MARK: Example Handled Notification (handler lives under handlers/)
/**
 * Demo task type whose handler ships in the API's `notification/handlers/`
 * subfolder rather than inline in `notification.task.service.ts`. Exists
 * to exercise the multi-file split convention used by larger downstream
 * apps and to provide a real-tree fixture for the
 * `dbx_validate_notification_folder` validator.
 */
export const EXAMPLE_HANDLED_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'EH';

export const EXAMPLE_HANDLED_NOTIFICATION_TASK_PING_CHECKPOINT = 'ping';

export type ExampleHandledNotificationTaskCheckpoint = typeof EXAMPLE_HANDLED_NOTIFICATION_TASK_PING_CHECKPOINT;

export interface ExampleHandledNotificationTaskData {
  readonly uid: FirebaseAuthUserId;
  readonly message?: Maybe<string>;
}

export interface ExampleHandledNotificationTaskInput extends Omit<ExampleHandledNotificationTaskData, 'uid'> {
  readonly profileDocument: ProfileDocument;
}

/**
 * Creates a notification task template for the example handled task type.
 *
 * The handler lives in `apps/demo-api/.../notification/handlers/`,
 * demonstrating the split convention where handler logic moves out of
 * `notification.task.service.ts` once the file would otherwise grow
 * unwieldy.
 *
 * @param input - Configuration containing the profile document and an optional message.
 * @returns A CreateNotificationTaskTemplate ready for submission to the notification task service.
 */
export function exampleHandledNotificationTaskTemplate(input: ExampleHandledNotificationTaskInput): CreateNotificationTaskTemplate {
  const { profileDocument, message } = input;
  const uid = profileDocument.id;

  return createNotificationTaskTemplate({
    type: EXAMPLE_HANDLED_NOTIFICATION_TASK_TYPE,
    notificationModel: profileDocument,
    targetModel: profileDocument,
    data: {
      uid,
      message
    }
  });
}

// MARK: All Tasks
export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE, EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE, EXAMPLE_HANDLED_NOTIFICATION_TASK_TYPE];
