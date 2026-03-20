/**
 * @module notification.task
 *
 * Checkpoint-based async task system built on top of the notification infrastructure.
 *
 * Task notifications use `NotificationSendType.TASK_NOTIFICATION` and run server-side async workflows
 * with progress tracked via checkpoint strings. Each task handler returns a {@link NotificationTaskServiceHandleNotificationTaskResult}
 * that tells the server whether the task is complete, partially done, failed, or should be delayed.
 *
 * Task lifecycle:
 * 1. Task notification is created with a task type and optional checkpoint strings
 * 2. Server picks it up via the send queue and routes to the registered handler
 * 3. Handler returns a result indicating completion, partial progress, delay, or failure
 * 4. Server updates the notification document accordingly and re-queues if not done
 * 5. On completion (`true`), the notification document is deleted
 */
import { type NotificationItem, type NotificationItemMetadata } from './notification.item';
import { type NotificationTaskType } from './notification.id';
import { type NotificationDocument, type NotificationTaskCheckpointString } from './notification';
import { type ArrayOrValue, type Maybe, type Milliseconds } from '@dereekb/util';

/**
 * Expanded task context passed to a task handler. Provides the notification document, item,
 * and current checkpoint progress for the handler to make decisions.
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
 * Returns an empty checkpoint array, signaling the task is not done but hasn't failed.
 *
 * Use this when the handler needs more time but doesn't want to increment the failure counter.
 * The task will be re-queued without counting as an error attempt.
 *
 * @returns an empty checkpoint array signaling in-progress without failure
 *
 * @example
 * ```ts
 * // Waiting for an external process — delay without failing
 * return { completion: delayCompletion(), delayUntil: 60000 };
 * ```
 */
export function delayCompletion<S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString>(): NotificationTaskServiceTaskHandlerCompletionType<S> {
  return [];
}

/**
 * Returns a result that re-queues the task after a delay without incrementing the error counter.
 *
 * Use when the task needs to wait (e.g., for an external API to complete) but hasn't failed.
 *
 * @param delayUntil - absolute date or relative milliseconds from the task's run start time
 * @param updateMetadata - optional metadata updates to merge into the notification item
 * @returns a task result that re-queues the task after the specified delay without marking it failed
 *
 * @example
 * ```ts
 * // Poll again in 30 seconds
 * return notificationTaskDelayRetry(30000, { pollCount: task.data?.pollCount + 1 });
 * ```
 */
export function notificationTaskDelayRetry<D extends NotificationItemMetadata = {}, S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString>(delayUntil: Date | Milliseconds, updateMetadata?: Maybe<Partial<D>>): NotificationTaskServiceHandleNotificationTaskResult<D, S> {
  return {
    completion: delayCompletion(),
    delayUntil,
    updateMetadata
  };
}

/**
 * Returns a result indicating one or more checkpoints completed, with more work remaining.
 *
 * The completed checkpoint strings are added to the notification's `tpr` set. The task is re-queued
 * for the next checkpoint.
 *
 * @param completedParts - checkpoint string(s) that were just completed
 * @param updateMetadata - optional metadata updates to merge into the notification item
 * @returns a task result marking the given checkpoints complete while keeping the task running
 *
 * @example
 * ```ts
 * // Mark 'validate' checkpoint done, continue to 'process'
 * return notificationTaskPartiallyComplete('validate');
 * ```
 */
export function notificationTaskPartiallyComplete<D extends NotificationItemMetadata = {}, S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString>(completedParts: ArrayOrValue<S>, updateMetadata?: Maybe<Partial<D>>): NotificationTaskServiceHandleNotificationTaskResult<D, S> {
  return {
    completion: completedParts,
    updateMetadata
  };
}

/**
 * Returns a result indicating the task completed successfully. The notification document will be deleted.
 *
 * @param updateMetadata - optional final metadata update (applied before deletion if subtasks need it)
 * @returns a task result signaling successful completion; the notification document will be deleted
 *
 * @example
 * ```ts
 * // All done
 * return notificationTaskComplete();
 * ```
 */
export function notificationTaskComplete<D extends NotificationItemMetadata = {}, S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString>(updateMetadata?: Maybe<Partial<D>>): NotificationTaskServiceHandleNotificationTaskResult<D, S> {
  return {
    completion: true,
    updateMetadata
  };
}

/**
 * Returns a result indicating the task failed. Increments the error attempt counter.
 *
 * After exceeding the maximum retry attempts, the task will be permanently deleted.
 *
 * @param updateMetadata - optional metadata updates
 * @param removeFromCompletedCheckpoints - checkpoint(s) to remove from the completed set (e.g., to retry a checkpoint)
 * @returns a task result signaling failure; the error attempt counter is incremented
 *
 * @example
 * ```ts
 * // Task failed, retry with rolled-back checkpoint
 * return notificationTaskFailed(undefined, 'process');
 * ```
 */
export function notificationTaskFailed<D extends NotificationItemMetadata = {}, S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString>(updateMetadata?: Maybe<Partial<D>>, removeFromCompletedCheckpoints?: Maybe<ArrayOrValue<S>>): NotificationTaskServiceHandleNotificationTaskResult<D, S> {
  return {
    completion: false,
    updateMetadata,
    removeFromCompletedCheckpoints
  };
}

/**
 * Wraps a task result to allow immediate execution of the next checkpoint within the same run.
 *
 * By default, only sets `canRunNextCheckpoint` if it isn't already defined.
 * Use `force: true` to override an existing value.
 *
 * @param result - the task result to wrap
 * @param force - when true, overrides any existing `canRunNextCheckpoint` value
 * @returns a copy of the result with `canRunNextCheckpoint` set to true
 */
export function notificationTaskCanRunNextCheckpoint<D extends NotificationItemMetadata = {}, S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString>(result: NotificationTaskServiceHandleNotificationTaskResult<D, S>, force?: Maybe<boolean>): NotificationTaskServiceHandleNotificationTaskResult<D, S> {
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
 * Completion status returned by a task handler:
 *
 * - `true` — task completed successfully; notification document will be deleted
 * - `false` — task failed; error counter incremented, re-queued for retry (up to max attempts)
 * - `string | string[]` — checkpoint(s) completed; added to `tpr` set, task continues
 * - `[]` (empty array) — task is in progress but no checkpoint reached; re-queued without error increment
 */
export type NotificationTaskServiceTaskHandlerCompletionType<S extends NotificationTaskCheckpointString = NotificationTaskCheckpointString> = true | false | NotificationTaskServiceTaskHandlerCompletionTypeCheckpoint<S>;

// MARK: Server
/**
 * Full result object returned by a task handler to the server-side task runner.
 *
 * Combines the completion status with optional metadata updates, delay scheduling, and checkpoint management.
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
   * Is merged with the existing metadata.
   *
   * Does not update the metadata if the completion type is true or false.
   */
  readonly updateMetadata?: Maybe<Partial<D>>;
  /**
   * Delays the next run of the task by the specified amount of time or until the given date.
   *
   * If milliseconds are provided, it is the amount of time relative from when the notification started this run, not from "now".
   */
  readonly delayUntil?: Maybe<Date | Milliseconds>;
  /**
   * If true, can run the next part of the task immediately.
   *
   * Ignored if delayUntil is set or if the completion is true/false/empty array.
   */
  readonly canRunNextCheckpoint?: Maybe<boolean>;
  /**
   * This value is only returned by tasks that have "subtasks", and this is the result of a subtask being run.
   *
   * These subtasks are used in place of the completion value when making decisions about continuing the loop or not.
   */
  readonly allCompletedSubTasks?: Maybe<NotificationTaskServiceTaskHandlerCompletionType>;
}
