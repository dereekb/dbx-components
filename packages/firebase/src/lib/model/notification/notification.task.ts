import { NotificationItem, NotificationItemMetadata } from './notification.item';
import { NotificationTaskType } from './notification.id';
import { NotificationDocument, NotificationTaskCheckpointString } from './notification';
import { ArrayOrValue, Maybe, Milliseconds } from '@dereekb/util';

/**
 * A NotificationTask is the final result of the expanded notification with a task type.
 */
export interface NotificationTask<D extends NotificationItemMetadata = {}> {
  /**
   * Notification document for this task
   */
  readonly notificationDocument: NotificationDocument;
  /**
   * The number of attempts that have occurred for this task.
   */
  readonly sendingAttempts: number;
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
  /**
   * Date the task was originally created at
   */
  readonly createdAt: Date;
  /**
   * True if the task is flagged as unique.
   */
  readonly unique: boolean;
}

/**
 * Returns an empty array, which is used to signal that the task did not fail but has not complete the current checkpoint.
 */
export function delayCompletion(): NotificationTaskServiceTaskHandlerCompletionType {
  return [];
}

/**
 * Convenience function for returning a NotificationTaskServiceHandleNotificationTaskResult that says the task should be retried after the specified delay.
 *
 * This does not affect the failure/retry count for a notification task.
 */
export function notificationTaskDelayRetry<D extends NotificationItemMetadata = {}>(delayUntil: Date | Milliseconds, updateMetadata?: Maybe<Partial<D>>): NotificationTaskServiceHandleNotificationTaskResult<D> {
  return {
    completion: delayCompletion(),
    delayUntil,
    updateMetadata
  };
}

/**
 * Convenience function for returning a NotificationTaskServiceHandleNotificationTaskResult that says the task was partially completed, and to process the next part in the future.
 */
export function notificationTaskPartiallyComplete<D extends NotificationItemMetadata = {}>(completedParts: ArrayOrValue<NotificationTaskCheckpointString>, updateMetadata?: Maybe<Partial<D>>): NotificationTaskServiceHandleNotificationTaskResult<D> {
  return {
    completion: completedParts,
    updateMetadata
  };
}

/**
 * Convenience function for returning a NotificationTaskServiceHandleNotificationTaskResult that says the task was completed successfully.
 */
export function notificationTaskComplete<D extends NotificationItemMetadata = {}>(updateMetadata?: Maybe<Partial<D>>): NotificationTaskServiceHandleNotificationTaskResult<D> {
  return {
    completion: true,
    updateMetadata
  };
}

/**
 * Convenience function for returning a NotificationTaskServiceHandleNotificationTaskResult that says the task failed.
 */
export function notificationTaskFailed<D extends NotificationItemMetadata = {}>(updateMetadata?: Maybe<Partial<D>>, removeFromCompletedCheckpoints?: Maybe<ArrayOrValue<NotificationTaskCheckpointString>>): NotificationTaskServiceHandleNotificationTaskResult<D> {
  return {
    completion: false,
    updateMetadata,
    removeFromCompletedCheckpoints
  };
}

/**
 * One or more NotificationTaskCheckpointString values that are considered complete.
 */
export type NotificationTaskServiceTaskHandlerCompletionTypeCheckpoint = ArrayOrValue<NotificationTaskCheckpointString>;

/**
 * Result of a NotificationTaskServiceTaskHandler.handleNotificationTask() call.
 *
 * true: The task was completed successfully and can now be discarded.
 * false: The task was not completed successfully and should be retried again in the future. Note there are a maximum number of retry attempts before the task is deleted. Use delayCompletion() to avoid increasing the attempt count.
 * NotificationTaskCheckpointString(s): The task has successfully completed this/these particular checkpoint(s) but is not complete and should be continued again in the future. Return an empty array to signal that the task did not fail but has not reached the next checkpoint.
 */
export type NotificationTaskServiceTaskHandlerCompletionType = true | false | NotificationTaskServiceTaskHandlerCompletionTypeCheckpoint;

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
   * If true, clears all completed checkpoints.
   */
  readonly removeAllCompletedCheckpoints?: boolean;
  /**
   * Removes the specified completions from the notification task.
   *
   * This is applied before the returned completion result, so it only removes from the current completion array.
   *
   * Only used if the completion type is NotificationTaskServiceTaskHandlerCompletionTypeCheckpoint.
   *
   * Ignored if removeAllCompletedCheckpoints is true.
   */
  readonly removeFromCompletedCheckpoints?: Maybe<ArrayOrValue<NotificationTaskCheckpointString>>;
  /**
   * Updates the metadata for the notification item if the task is successful but not yet marked done.
   *
   * Does not update the metadata if the completion type is true or false.
   */
  readonly updateMetadata?: Maybe<Partial<D>>;
  /**
   * Delays the next run of the task by the specified amount of time or until the given date.
   */
  readonly delayUntil?: Maybe<Date | Milliseconds>;
}
