import { CreateNotificationTaskTemplate, createNotificationTaskTemplate, FirebaseAuthUserId, NotificationTaskServiceHandleNotificationTaskResult, NotificationTaskType } from '@dereekb/firebase';
import { ProfileDocument } from '../profile';
import { Maybe } from '@dereekb/util';

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
}

export const EXAMPLE_NOTIFICATION_TASK_PART_A_COMPLETE_VALUE = 100;
export const EXAMPLE_NOTIFICATION_TASK_PART_B_COMPLETE_VALUE = 200;

export interface ExampleNotificationTaskInput extends Omit<ExampleNotificationTaskData, 'uid'> {
  readonly profileDocument: ProfileDocument;
  readonly completedCheckpoints?: Maybe<ExampleNotificationTaskCheckpoint[]>;
}

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

// MARK: All Tasks
export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE, EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE];
