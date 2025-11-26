import { type Maybe } from '@dereekb/util';
import { type StorageFileInitializeFromUploadResultType } from './storagefile.upload';

/**
 * Thrown if the target uploaded file does not exist.
 */
export const UPLOADED_FILE_DOES_NOT_EXIST_ERROR_CODE = 'UPLOADED_FILE_DOES_NOT_EXIST';

/**
 * Thrown if the target uploaded file is not allowed to be initialized.
 */
export const UPLOADED_FILE_NOT_ALLOWED_TO_BE_INITIALIZED_ERROR_CODE = 'UPLOADED_FILE_NOT_ALLOWED_TO_BE_INITIALIZED';

/**
 * Thrown if the target uploaded file initialization failed.
 */
export const UPLOADED_FILE_INITIALIZATION_FAILED_ERROR_CODE = 'UPLOADED_FILE_INITIALIZATION_FAILED';

export interface UploadedFileInitializationFailedErrorData {
  readonly resultType: StorageFileInitializeFromUploadResultType;
  /**
   * True if the file was deleted.
   */
  readonly fileDeleted?: Maybe<boolean>;
}

/**
 * Thrown if the target uploaded file initialization was successful, but produced no new StorageFileDocument.
 */
export const UPLOADED_FILE_INITIALIZATION_DISCARDED_ERROR_CODE = 'UPLOADED_FILE_INITIALIZATION_DISCARDED';

/**
 * Thrown if the target StorageFileDocument is not queued for processing and is called to be processed.
 */
export const STORAGE_FILE_PROCESSING_NOT_QUEUED_FOR_PROCESSING_ERROR_CODE = 'STORAGE_FILE_PROCESSING_NOT_QUEUED_FOR_PROCESSING';

/**
 * Thrown if:
 * - the target StorageFileDocument was marked as queued for processing but isn't actually a processable-type.
 * - the target StorageFileDocument is marked as init but has no purpose set, meaning it can't be processed.
 */
export const STORAGE_FILE_PROCESSING_NOT_AVAILABLE_FOR_TYPE_ERROR_CODE = 'STORAGE_FILE_PROCESSING_NOT_AVAILABLE_FOR_TYPE';

/**
 * Thrown if the StorageFile is not in an OK state.
 */
export const STORAGE_FILE_PROCESSING_NOT_ALLOWED_FOR_INVALID_STATE_ERROR_CODE = 'STORAGE_FILE_PROCESSING_NOT_ALLOWED_FOR_INVALID_STATE';

/**
 * Thrown if the target StorageFileDocument already finished processing.
 */
export const STORAGE_FILE_ALREADY_PROCESSED_ERROR_CODE = 'STORAGE_FILE_ALREADY_PROCESSED';

/**
 * Thrown if the target StorageFileDocument is not flagged for deletion but attempts to be deleted.
 */
export const STORAGE_FILE_NOT_FLAGGED_FOR_DELETION_ERROR_CODE = 'STORAGE_FILE_NOT_FLAGGED_FOR_DELETION';

/**
 * Thrown if the target StorageFileDocument is flagged for deletion, but has not reached the time to be deleted yet.
 */
export const STORAGE_FILE_CANNOT_BE_DELETED_YET_ERROR_CODE = 'STORAGE_FILE_CANNOT_BE_DELETED_YET';

/**
 * Thrown if the target InitializedStorageFileModel has already been initialized.
 */
export const STORAGE_FILE_MODEL_ALREADY_INITIALIZED_ERROR_CODE = 'STORAGE_FILE_MODEL_ALREADY_INITIALIZED';

/**
 * Thrown if the target StorageFileDocument is attempted to be synced with groups, but is not flagged for groups sync.
 */
export const STORAGE_FILE_NOT_FLAGGED_FOR_GROUPS_SYNC_ERROR_CODE = 'STORAGE_FILE_NOT_FLAGGED_FOR_GROUPS_SYNC';

/**
 * Thrown if both the target model and storageFileId is not provided in CreateStorageFileGroupParams.
 */
export const STORAGE_FILE_GROUP_CREATE_INPUT_ERROR_CODE = 'STORAGE_FILE_GROUP_CREATE_INPUT_ERROR';
