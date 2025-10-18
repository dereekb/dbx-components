import { type Maybe, MS_IN_HOUR } from '@dereekb/util';
import { type NotificationItemMetadata, type NotificationTaskCheckpointString } from '../notification';
import { createNotificationTaskTemplate, type CreateNotificationTaskTemplate } from '../notification/notification.create.task';
import { type NotificationTaskType } from '../notification/notification.id';
import { type StorageFileDocument } from './storagefile';
import { type StorageFileId, type StorageFilePurpose } from './storagefile.id';
import { type StoragePath } from '../../common';

// MARK: Storage File Processing Notification
export const STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'SFP';

/**
 * There are two task checkpoints, "processing" and "cleanup".
 *
 * Processing includes all of the subtask processing, while cleanup is scheduled for after the subtasks are complete, and
 * is used for updating/deleting the StorageFile depending on the final processing outcome.
 */
export type StorageFileProcessingNotificationTaskCheckpoint = 'processing' | 'cleanup';

/**
 * A subtask checkpoint.
 *
 * It is similar to NotificationTaskCheckpointString, but is used for StorageFile processing.
 */
export type StorageFileProcessingSubtask = NotificationTaskCheckpointString;

/**
 * Metadata for a subtask.
 *
 * It is similar to NotificationItemMetadata, but is stored within the StorageFileProcessingNotificationTaskData and passed to the subtasks.
 */
export type StorageFileProcessingSubtaskMetadata = NotificationItemMetadata;

/**
 * The maximum number of times to delay the cleanup step of a StorageFileProcessingNotificationTask.
 */
export const DEFAULT_MAX_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_ATTEMPTS = 4;

/**
 * The default amount of time to delay the cleanup step of a StorageFileProcessingNotificationTask that failed to cleanup successfully.
 */
export const DEFAULT_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_DELAY = MS_IN_HOUR;

export interface StorageFileProcessingNotificationTaskData<M extends StorageFileProcessingSubtaskMetadata = StorageFileProcessingSubtaskMetadata, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> {
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
  /**
   * The steps of the underlying subtask that have already been completed.
   */
  readonly sfps?: Maybe<S[]>;
  /**
   * Arbitrary metadata that is stored by the underlying subtask.
   */
  readonly sd?: Maybe<M>;
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
