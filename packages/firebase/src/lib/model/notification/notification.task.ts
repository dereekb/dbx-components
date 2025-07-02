import { NotificationItem, NotificationItemMetadata } from './notification.item';
import { NotificationTaskType } from './notification.id';
import { NotificationTaskCheckpointString } from './notification';
import { ArrayOrValue } from '@dereekb/util';

/**
 * A NotificationTask is the final result of the expanded notification with a task type.
 */
export interface NotificationTask<D extends NotificationItemMetadata = {}> {
  /**
   * Task type identifier of the notification, which is used to pass this task to the appropriate handler.
   *
   * Ideally type values are shorter to reduce database size impact.
   */
  readonly taskType: NotificationTaskType;
  /**
   * Notification item
   */
  readonly item: NotificationItem<D>;
  /**
   * Current checkpoints for the notification task.
   */
  readonly checkpoints: NotificationTaskCheckpointString[];
}

/**
 * Result of a NotificationTaskServiceTaskHandler.handleNotificationTask() call.
 *
 * true: The task was completed successfully and can now be discarded.
 * false: The task was not completed successfully and should be retried again in the future.
 * NotificationTaskCheckpointString(s): The task has successfully completed this/these particular checkpoint(s) but is not complete and should be continued again in the future.
 */
export type NotificationTaskServiceTaskHandlerCompletionType = true | false | ArrayOrValue<NotificationTaskCheckpointString>;
