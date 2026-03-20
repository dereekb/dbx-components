/**
 * @module notification.task.subtask
 *
 * Subtask system for breaking complex notification tasks into "processing" and "cleanup" phases.
 *
 * A subtask wraps a notification task with two ordered checkpoints:
 * 1. `'processing'` — the main work (e.g., external API calls, file generation)
 * 2. `'cleanup'` — post-processing cleanup (e.g., updating related documents, deleting temporary files)
 *
 * Each subtask maintains its own checkpoint progress and metadata within the parent task's data payload.
 */
import { type Maybe, MS_IN_HOUR } from '@dereekb/util';
import { type NotificationTaskCheckpointString } from './notification';
import { type NotificationItemMetadata } from './notification.item';
import { notificationTaskComplete, notificationTaskPartiallyComplete, type NotificationTaskServiceHandleNotificationTaskResult } from './notification.task';

/**
 * Discriminator string that routes the subtask to the correct processing configuration.
 */
export type NotificationTaskSubtaskTarget = string;

/**
 * Checkpoint string for subtask-level progress, stored within the {@link NotificationTaskSubtaskData}.
 */
export type NotificationTaskSubtaskCheckpointString = NotificationTaskCheckpointString;

/**
 * Metadata type for subtask-level state, stored within the {@link NotificationTaskSubtaskData}.
 */
export type NotificationTaskSubtaskMetadata = NotificationItemMetadata;

/**
 * Data structure embedded in the parent task's {@link NotificationItem} metadata to track subtask progress.
 *
 * Field abbreviations:
 * - `sfps` — subtask finished processing steps (completed checkpoint strings)
 * - `sd` — subtask data (arbitrary metadata for the subtask handler)
 */
export interface NotificationTaskSubtaskData<M extends NotificationTaskSubtaskMetadata = NotificationTaskSubtaskMetadata, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> {
  /**
   * Completed subtask checkpoint strings.
   */
  readonly sfps?: Maybe<S[]>;
  /**
   * Arbitrary metadata managed by the subtask handler.
   */
  readonly sd?: Maybe<M>;
}

// MARK: Notification Task Subtask Checkpoints
/**
 * Checkpoint string for the main processing phase of a subtask.
 */
export const NOTIFICATION_TASK_SUBTASK_CHECKPOINT_PROCESSING: NotificationTaskCheckpointString = 'processing';

/**
 * Checkpoint string for the cleanup phase that runs after processing completes.
 */
export const NOTIFICATION_TASK_SUBTASK_CHECKPOINT_CLEANUP: NotificationTaskCheckpointString = 'cleanup';

/**
 * The maximum number of times to delay the cleanup step of a StorageFileProcessingNotificationTask.
 */
export const DEFAULT_NOTIFICATION_TASK_SUBTASK_CLEANUP_RETRY_ATTEMPTS = 4;

/**
 * The default amount of time to delay the cleanup step of a StorageFileProcessingNotificationTask that failed to cleanup successfully.
 */
export const DEFAULT_NOTIFICATION_TASK_SUBTASK_CLEANUP_RETRY_DELAY = MS_IN_HOUR;

/**
 * There are two task checkpoints, "processing" and "cleanup".
 *
 * Processing includes all of the subtask processing, while cleanup is scheduled for after the subtasks are complete, and
 * is used for updating/deleting the StorageFile depending on the final processing outcome.
 *
 * Not to be confused with the NotificationTaskSubtaskCheckpointString, which is configured for the each subtask's processing checkpoint.
 */
export type NotificationTaskSubtaskCheckpoint = typeof NOTIFICATION_TASK_SUBTASK_CHECKPOINT_PROCESSING | typeof NOTIFICATION_TASK_SUBTASK_CHECKPOINT_CLEANUP;

/**
 * Internal helper that marks the `'processing'` checkpoint complete and schedules the `'cleanup'` phase.
 *
 * Prefer using {@link notificationSubtaskComplete} in subtask handlers instead of calling this directly.
 *
 * @returns a partially-complete task result with the processing checkpoint marked done
 */
export function completeSubtaskProcessingAndScheduleCleanupTaskResult<D extends NotificationTaskSubtaskData>(): NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint> {
  return notificationTaskPartiallyComplete(['processing']);
}

/**
 * Returns a completion result for a subtask that has finished its processing.
 *
 * Unlike {@link notificationTaskComplete}, this signals that the cleanup checkpoint should still run.
 * Use `canRunNextCheckpoint: true` in options to run cleanup immediately in the same execution.
 *
 * @param options - optional metadata updates and flag to run cleanup immediately in the same execution
 * @returns a task result marking the subtask as complete while allowing cleanup to proceed
 *
 * @example
 * ```ts
 * // Processing done, schedule cleanup for next run
 * return notificationSubtaskComplete();
 *
 * // Processing done, run cleanup immediately
 * return notificationSubtaskComplete({ canRunNextCheckpoint: true });
 * ```
 */
export function notificationSubtaskComplete<D extends NotificationTaskSubtaskData>(options?: Maybe<Pick<NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint>, 'updateMetadata' | 'canRunNextCheckpoint'>>): NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint> {
  return {
    ...notificationTaskComplete(options?.updateMetadata),
    canRunNextCheckpoint: options?.canRunNextCheckpoint
  };
}
