import { CreateNotificationTaskTemplate, createNotificationTaskTemplate, FirebaseAuthUserId, NotificationTaskType } from '@dereekb/firebase';
import { ProfileDocument } from '../profile';
import { Maybe } from '@dereekb/util';

// MARK: Example Notification
export const EXAMPLE_NOTIFICATION_TASK_TEMPLATE_TYPE: NotificationTaskType = 'E';

export type ExampleNotificationTaskCheckpoint = 'part_a' | 'part_b';

export interface ExampleNotificationTaskData {
  readonly uid: FirebaseAuthUserId; // user id to store in the notification
}

export interface ExampleNotificationTaskInput extends Omit<ExampleNotificationTaskData, 'uid'> {
  readonly profileDocument: ProfileDocument;
  readonly completedCheckpoints?: Maybe<ExampleNotificationTaskCheckpoint[]>;
}

export function exampleNotificationTaskTemplate(input: ExampleNotificationTaskInput): CreateNotificationTaskTemplate {
  const { profileDocument } = input;
  const uid = profileDocument.id;

  return createNotificationTaskTemplate({
    type: EXAMPLE_NOTIFICATION_TASK_TEMPLATE_TYPE,
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
export const EXAMPLE_UNIQUE_NOTIFICATION_TASK_TEMPLATE_TYPE: NotificationTaskType = 'EU';

export type ExampleUniqueNotificationTaskCheckpoint = 'part_a' | 'part_b';

export interface ExampleUniqueNotificationTaskData {
  readonly uid: FirebaseAuthUserId; // user id to store in the notification
}

export interface ExampleUniqueNotificationTaskInput extends Omit<ExampleUniqueNotificationTaskData, 'uid'> {
  readonly profileDocument: ProfileDocument;
  readonly completedCheckpoints?: Maybe<ExampleUniqueNotificationTaskCheckpoint[]>;
}

export function exampleUniqueNotificationTaskTemplate(input: ExampleUniqueNotificationTaskInput): CreateNotificationTaskTemplate {
  const { profileDocument } = input;
  const uid = profileDocument.id;

  return createNotificationTaskTemplate({
    type: EXAMPLE_UNIQUE_NOTIFICATION_TASK_TEMPLATE_TYPE,
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
    unique: true
  });
}
