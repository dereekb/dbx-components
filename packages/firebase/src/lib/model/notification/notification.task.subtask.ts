import { Maybe, MS_IN_HOUR } from '@dereekb/util';
import { NotificationTaskCheckpointString } from './notification';
import { NotificationItemMetadata } from './notification.item';
import { notificationTaskPartiallyComplete, NotificationTaskServiceHandleNotificationTaskResult } from './notification.task';

/**
 * Used as a descriminator to determine which processing configuration to run for the input value.
 */
export type NotificationTaskSubtaskTarget = string;

/**
 * A subtask checkpoint.
 *
 * It is similar to NotificationTaskCheckpointString, but is stored within the subtask data.
 */
export type NotificationTaskSubtaskCheckpointString = NotificationTaskCheckpointString;

/**
 * Metadata for a subtask.
 *
 * It is similar to NotificationItemMetadata, but is stored within the subtask data.
 */
export type NotificationTaskSubtaskMetadata = NotificationItemMetadata;

/**
 * A base NotificationTask's subtask data structure.
 */
export interface NotificationTaskSubtaskData<M extends NotificationTaskSubtaskMetadata = NotificationTaskSubtaskMetadata, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> {
  /**
   * The steps of the underlying subtask that have already been completed.
   */
  readonly sfps?: Maybe<S[]>;
  /**
   * Arbitrary metadata that is stored by the underlying subtask.
   */
  readonly sd?: Maybe<M>;
}

// MARK: Notification Task Subtask Checkpoints
export const NOTIFICATION_TASK_SUBTASK_CHECKPOINT_PROCESSING: NotificationTaskCheckpointString = 'processing';
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
 * Returned by a subtask to complete the processing step and schedule the cleanup step.
 */
export function completeSubtaskProcessingAndScheduleCleanupTaskResult<D extends NotificationTaskSubtaskData>(): NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint> {
  return notificationTaskPartiallyComplete(['processing']);
}
