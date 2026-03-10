import { type Maybe } from '@dereekb/util';
import { createNotificationTaskTemplate, type CreateNotificationTaskTemplate } from '../notification/notification.create.task';
import { type NotificationTaskSubtaskCheckpointString, type NotificationTaskSubtaskData, type NotificationTaskSubtaskMetadata } from '../notification/notification.task.subtask';
import { type NotificationTaskType } from '../notification/notification.id';
import { type StorageFileDocument } from './storagefile';
import { type StorageFileId, type StorageFilePurpose } from './storagefile.id';
import { type StoragePath } from '../../common';

// MARK: Storage File Processing Notification
/**
 * NotificationTask type identifier for StorageFile processing tasks.
 *
 * Tasks with this type drive the StorageFile processing lifecycle, executing
 * purpose-specific processing logic through the subtask checkpoint system.
 */
export const STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'SFP';

/**
 * Checkpoint string for a StorageFile processing subtask.
 *
 * Subtasks within a StorageFile processing task use these checkpoints to track
 * multi-step progress (e.g., zip creation, file conversion).
 */
export type StorageFileProcessingSubtask = NotificationTaskSubtaskCheckpointString;

/**
 * Arbitrary metadata passed to StorageFile processing subtasks.
 *
 * Stored within {@link StorageFileProcessingNotificationTaskData} and made available
 * to each subtask handler during execution.
 */
export type StorageFileProcessingSubtaskMetadata = NotificationTaskSubtaskMetadata;

/**
 * Data payload for a StorageFile processing NotificationTask.
 *
 * Extends the subtask data model with StorageFile-specific fields (file ID, storage path, purpose).
 * The storage path and purpose are populated from the StorageFile on first task execution.
 *
 * @template M - subtask metadata type
 * @template S - subtask checkpoint string type
 */
export interface StorageFileProcessingNotificationTaskData<M extends StorageFileProcessingSubtaskMetadata = StorageFileProcessingSubtaskMetadata, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> extends NotificationTaskSubtaskData<M, S> {
  /**
   * The StorageFileDocument id.
   */
  readonly storageFile: StorageFileId;
  /**
   * The storage path of the file.
   *
   * It is retrieved from the StorageFile the first time the task is run.
   */
  readonly storagePath?: Maybe<StoragePath>;
  /**
   * The StorageFile's purpose.
   *
   * Is retrieved from the StorageFile the first time the task is run.
   */
  readonly p?: Maybe<StorageFilePurpose>;
}

/**
 * Input for creating a StorageFile processing NotificationTask.
 *
 * Accepts the target StorageFileDocument (from which the ID and purpose are derived)
 * and optional override behavior for existing tasks.
 */
export interface StorageFileProcessingNotificationTaskInput<M extends StorageFileProcessingSubtaskMetadata = StorageFileProcessingSubtaskMetadata> extends Omit<StorageFileProcessingNotificationTaskData<M>, 'storageFile' | 'p' | 'sfps'> {
  readonly storageFileDocument: StorageFileDocument;
  readonly overrideExistingTask?: Maybe<boolean>;
}

/**
 * Creates a {@link CreateNotificationTaskTemplate} for a StorageFile processing task.
 *
 * The created task is unique per StorageFile (only one processing task at a time).
 *
 * @param input - the target StorageFileDocument and optional subtask data
 *
 * @example
 * ```ts
 * const template = storageFileProcessingNotificationTaskTemplate({
 *   storageFileDocument: doc,
 *   sd: { customKey: 'value' }
 * });
 * ```
 */
export function storageFileProcessingNotificationTaskTemplate(input: StorageFileProcessingNotificationTaskInput): CreateNotificationTaskTemplate {
  const { storageFileDocument, overrideExistingTask } = input;

  return createNotificationTaskTemplate({
    type: STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE,
    targetModel: storageFileDocument,
    data: {
      storageFile: storageFileDocument.id,
      d: input.sd
    },
    /**
     * The task is unique to the StorageFile.
     */
    unique: true,
    overrideExistingTask
  });
}

// MARK: All Tasks
/**
 * All NotificationTask types used by the StorageFile system.
 *
 * Register these with the notification task handler to enable StorageFile processing.
 */
export const ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE];
