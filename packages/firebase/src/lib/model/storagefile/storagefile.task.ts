import { type Maybe } from '@dereekb/util';
import { createNotificationTaskTemplate, type CreateNotificationTaskTemplate } from '../notification/notification.create.task';
import { NOTIFICATION_TASK_SUBTASK_CHECKPOINT_CLEANUP, NOTIFICATION_TASK_SUBTASK_CHECKPOINT_PROCESSING, type NotificationTaskSubtaskCheckpoint, type NotificationTaskSubtaskCheckpointString, type NotificationTaskSubtaskData, type NotificationTaskSubtaskMetadata } from '../notification/notification.task.subtask';
import { type NotificationTaskType } from '../notification/notification.id';
import { type StorageFileDocument } from './storagefile';
import { type StorageFileId, type StorageFilePurpose } from './storagefile.id';
import { type StoragePath } from '../../common';

// MARK: Storage File Processing Notification
export const STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'SFP';

/**
 * A subtask checkpoint.
 *
 * It is similar to NotificationTaskCheckpointString, but is used for StorageFile processing.
 */
export type StorageFileProcessingSubtask = NotificationTaskSubtaskCheckpointString;

/**
 * Metadata for a subtask.
 *
 * It is similar to NotificationItemMetadata, but is stored within the StorageFileProcessingNotificationTaskData and passed to the subtasks.
 */
export type StorageFileProcessingSubtaskMetadata = NotificationTaskSubtaskMetadata;

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

export interface StorageFileProcessingNotificationTaskInput<M extends StorageFileProcessingSubtaskMetadata = StorageFileProcessingSubtaskMetadata> extends Omit<StorageFileProcessingNotificationTaskData<M>, 'storageFile' | 'p' | 'sfps'> {
  readonly storageFileDocument: StorageFileDocument;
  readonly overrideExistingTask?: Maybe<boolean>;
}

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
export const ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE];

// MARK: Compat
/**
 * @deprecated Use NotificationTaskSubtaskCheckpoint instead.
 */
export type StorageFileProcessingNotificationTaskCheckpoint = NotificationTaskSubtaskCheckpoint;

/**
 * @deprecated Use NOTIFICATION_TASK_SUBTASK_CHECKPOINT_PROCESSING instead.
 */
export const STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_CHECKPOINT_PROCESSING: StorageFileProcessingNotificationTaskCheckpoint = NOTIFICATION_TASK_SUBTASK_CHECKPOINT_PROCESSING;

/**
 * @deprecated Use NOTIFICATION_TASK_SUBTASK_CHECKPOINT_CLEANUP instead.
 */
export const STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_CHECKPOINT_CLEANUP: StorageFileProcessingNotificationTaskCheckpoint = NOTIFICATION_TASK_SUBTASK_CHECKPOINT_CLEANUP;
