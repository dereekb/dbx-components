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
   *
   * Corresponds to the "a" field in the notification task document.
   */
  readonly totalSendAttempts: number;
  /**
   * The sum of failures and checkpoint delays that have occurred for this task's current checkpoint.
   *
   * Corresponds to the "at" field in the notification task document.
   */
  readonly currentCheckpointSendAttempts: number;
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
   *
   * Corresponds to the "tsr" field in the notification task document.
   */
  readonly checkpoints: NotificationTaskCheckpointString[];
  /**
   * Date the task was originally created at
   *
   * Corresponds to the "cat" field in the notification task document.
   */
  readonly createdAt: Date;
  /**
   * True if the task is flagged as unique.
   *
   * Corresponds to the "ut" field in the notification task document.
   */
  readonly unique: boolean;
}

/**
 * Returns an empty array, which is used to signal that the task did not fail but has not complete the current checkpoint.
 */
export function delayCompletion<S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString>(): NotificationTaskServiceTaskHandlerCompletionType<S> {
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
export function notificationTaskPartiallyComplete<D extends NotificationItemMetadata = {}, S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString>(completedParts: ArrayOrValue<S>, updateMetadata?: Maybe<Partial<D>>): NotificationTaskServiceHandleNotificationTaskResult<D, S> {
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
 * Wraps an existing NotificationTaskServiceHandleNotificationTaskResult<D> and sets canRunNextCheckpoint to true if it is undefined.
 *
 * @param result The result to use as a template.
 * @param force If true, then canRunNextCheckpoint will be set to true even if it is already defined.
 * @returns A new result.
 */
export function notificationTaskCanRunNextCheckpoint<D extends NotificationItemMetadata = {}>(result: NotificationTaskServiceHandleNotificationTaskResult<D>, force?: Maybe<boolean>): NotificationTaskServiceHandleNotificationTaskResult<D> {
  if (force || result.canRunNextCheckpoint == null) {
    result = {
      ...result,
      canRunNextCheckpoint: true
    };
  }

  return result;
}

/**
 * One or more NotificationTaskCheckpointString values that are considered complete.
 */
export type NotificationTaskServiceTaskHandlerCompletionTypeCheckpoint<S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString> = ArrayOrValue<S>;

/**
 * Result type of a NotificationTaskServiceTaskHandler.handleNotificationTask() call.
 *
 * true: The task was completed successfully and can now be discarded.
 * false: The task was not completed successfully and should be retried again in the future. Note there are a maximum number of retry attempts before the task is deleted. Use delayCompletion() to avoid increasing the attempt count.
 * NotificationTaskCheckpointString(s): The task has successfully completed this/these particular checkpoint(s) but is not complete and should be continued again in the future. Return an empty array to signal that the task did not fail but has not reached the next checkpoint.
 */
export type NotificationTaskServiceTaskHandlerCompletionType<S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString> = true | false | NotificationTaskServiceTaskHandlerCompletionTypeCheckpoint<S>;

// MARK: Server
/**
 * Result of a NotificationTaskServiceTaskHandler.handleNotificationTask() call.
 */
export interface NotificationTaskServiceHandleNotificationTaskResult<D extends NotificationItemMetadata = {}, S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString> {
  /**
   * Completion type for the task result.
   */
  readonly completion: NotificationTaskServiceTaskHandlerCompletionType<S>;
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
  readonly removeFromCompletedCheckpoints?: Maybe<ArrayOrValue<S>>;
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
  /**
   * If true, can run the next part of the task immediately.
   *
   * Ignored if delayUntil is set or if the completion is true/false/empty array.
   */
  readonly canRunNextCheckpoint?: Maybe<boolean>;
}
