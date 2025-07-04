import { NotificationItem, NotificationItemMetadata } from './notification.item';
import { NotificationTaskType } from './notification.id';
import { NotificationTaskCheckpointString } from './notification';
import { ArrayOrValue, Maybe, Milliseconds } from '@dereekb/util';

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
   * Notification item data, if applicable.
   */
  readonly data?: Maybe<D>;
  /**
   * Current checkpoints for the notification task.
   */
  readonly checkpoints: NotificationTaskCheckpointString[];
}

/**
 * Returns an empty array, which is used to signal that the task did not fail but has not complete the current checkpoint.
 */
export function delayCompletion(): NotificationTaskServiceTaskHandlerCompletionType {
  return [];
}

/**
 * Result of a NotificationTaskServiceTaskHandler.handleNotificationTask() call.
 *
 * true: The task was completed successfully and can now be discarded.
 * false: The task was not completed successfully and should be retried again in the future. Note there are a maximum number of retry attempts before the task is deleted. Use delayCompletion() to avoid increasing the attempt count.
 * NotificationTaskCheckpointString(s): The task has successfully completed this/these particular checkpoint(s) but is not complete and should be continued again in the future. Return an empty array to signal that the task did not fail but has not reached the next checkpoint.
 */
export type NotificationTaskServiceTaskHandlerCompletionType = true | false | ArrayOrValue<NotificationTaskCheckpointString>;

// MARK: Server
/**
 * Result of a NotificationTaskServiceTaskHandler.handleNotificationTask() call.
 */
export interface NotificationTaskServiceHandleNotificationTaskResult<D extends NotificationItemMetadata = {}> {
  /**
   * Completion type for the task result.
   */
  readonly completion: NotificationTaskServiceTaskHandlerCompletionType;
  /**
   * Updates the metadata for the notification item if the task is successful but not yet marked done.
   *
   * Does not update the metadata if the completion type is true or false.
   */
  readonly updateMetadata?: Partial<D>;
  /**
   * Delays the next run of the task by the specified amount of time or until the given date.
   */
  readonly delayUntil?: Maybe<Date | Milliseconds>;
}
