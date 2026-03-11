import {
  STORAGE_FILE_ALREADY_PROCESSED_ERROR_CODE,
  STORAGE_FILE_CANNOT_BE_DELETED_YET_ERROR_CODE,
  STORAGE_FILE_GROUP_CREATE_INPUT_ERROR_CODE,
  STORAGE_FILE_GROUP_QUEUED_FOR_INITIALIZATION_ERROR_CODE,
  STORAGE_FILE_MODEL_ALREADY_INITIALIZED_ERROR_CODE,
  STORAGE_FILE_NOT_FLAGGED_FOR_DELETION_ERROR_CODE,
  STORAGE_FILE_NOT_FLAGGED_FOR_GROUPS_SYNC_ERROR_CODE,
  STORAGE_FILE_PROCESSING_NOT_ALLOWED_FOR_INVALID_STATE_ERROR_CODE,
  STORAGE_FILE_PROCESSING_NOT_AVAILABLE_FOR_TYPE_ERROR_CODE,
  STORAGE_FILE_PROCESSING_NOT_QUEUED_FOR_PROCESSING_ERROR_CODE,
  UPLOADED_FILE_DOES_NOT_EXIST_ERROR_CODE,
  UPLOADED_FILE_INITIALIZATION_DISCARDED_ERROR_CODE,
  UPLOADED_FILE_INITIALIZATION_FAILED_ERROR_CODE,
  UPLOADED_FILE_NOT_ALLOWED_TO_BE_INITIALIZED_ERROR_CODE,
  type UploadedFileInitializationFailedErrorData
} from '@dereekb/firebase';
import { internalServerError, preconditionConflictError } from '@dereekb/firebase-server';

/**
 * Creates an error indicating that a storage file model has already been initialized.
 */
export function storageFileModelAlreadyInitializedError() {
  return preconditionConflictError({
    message: `This model has already been initialized.`,
    code: STORAGE_FILE_MODEL_ALREADY_INITIALIZED_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the StorageFile is not flagged for group sync.
 */
export function storageFileNotFlaggedForGroupsSyncError() {
  return preconditionConflictError({
    message: `This StorageFile has not been flagged for sync with its groups.`,
    code: STORAGE_FILE_NOT_FLAGGED_FOR_GROUPS_SYNC_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the target uploaded file does not exist in storage.
 */
export function uploadedFileDoesNotExistError() {
  return preconditionConflictError({
    message: `The target uploaded file does not exist.`,
    code: UPLOADED_FILE_DOES_NOT_EXIST_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the file is not allowed to be initialized (rejected by the check function).
 */
export function uploadedFileIsNotAllowedToBeInitializedError() {
  return preconditionConflictError({
    message: `The target uploaded file is not allowed to be initialized.`,
    code: UPLOADED_FILE_NOT_ALLOWED_TO_BE_INITIALIZED_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the file initialization failed with the given result type.
 *
 * @param data - error data containing the result type that caused the failure
 */
export function uploadedFileInitializationFailedError(data: UploadedFileInitializationFailedErrorData) {
  return internalServerError({
    message: `The target uploaded file initialization failed with result type "${data.resultType}".`,
    code: UPLOADED_FILE_INITIALIZATION_FAILED_ERROR_CODE,
    data: {
      resultType: data.resultType
    }
  });
}

/**
 * Creates an error indicating that the initialization result was discarded (e.g., the created file no longer exists).
 */
export function uploadedFileInitializationDiscardedError() {
  return internalServerError({
    message: `The target uploaded file initialization was discarded.`,
    code: UPLOADED_FILE_INITIALIZATION_DISCARDED_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the StorageFile is not in a valid state for processing.
 */
export function storageFileProcessingNotAllowedForInvalidStateError() {
  return preconditionConflictError({
    message: `The target StorageFileDocument must be in an OK state to be processed and processing not flagged as SHOULD_NOT_PROCESS.`,
    code: STORAGE_FILE_PROCESSING_NOT_ALLOWED_FOR_INVALID_STATE_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the StorageFile is not queued for processing.
 */
export function storageFileProcessingNotQueuedForProcessingError() {
  return preconditionConflictError({
    message: `The target StorageFileDocument is not queued for processing.`,
    code: STORAGE_FILE_PROCESSING_NOT_QUEUED_FOR_PROCESSING_ERROR_CODE
  });
}

/**
 * Creates an error indicating that no processor is configured for the StorageFile's type.
 */
export function storageFileProcessingNotAvailableForTypeError() {
  return preconditionConflictError({
    message: `The target StorageFileDocument is not available for processing.`,
    code: STORAGE_FILE_PROCESSING_NOT_AVAILABLE_FOR_TYPE_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the StorageFile has already finished processing.
 */
export function storageFileAlreadyProcessedError() {
  return preconditionConflictError({
    message: `The target StorageFileDocument has already finished processing.`,
    code: STORAGE_FILE_ALREADY_PROCESSED_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the StorageFile is not flagged for deletion.
 */
export function storageFileNotFlaggedForDeletionError() {
  return preconditionConflictError({
    message: `The target StorageFileDocument is not flagged for deletion.`,
    code: STORAGE_FILE_NOT_FLAGGED_FOR_DELETION_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the StorageFile's scheduled deletion time has not yet passed.
 */
export function storageFileCannotBeDeletedYetError() {
  return preconditionConflictError({
    message: `The target StorageFileDocument cannot be deleted yet.`,
    code: STORAGE_FILE_CANNOT_BE_DELETED_YET_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the StorageFileGroup is still queued for initialization and cannot be operated on.
 */
export function storageFileGroupQueuedForInitializationError() {
  return preconditionConflictError({
    message: `The target StorageFileGroupDocument is queued for initialization.`,
    code: STORAGE_FILE_GROUP_QUEUED_FOR_INITIALIZATION_ERROR_CODE
  });
}

/**
 * Creates an error indicating that the required model key or storageFileId is missing when creating a StorageFileGroup.
 */
export function createStorageFileGroupInputError() {
  return preconditionConflictError({
    message: `The model or storageFileId is required for creating a StorageFileGroup.`,
    code: STORAGE_FILE_GROUP_CREATE_INPUT_ERROR_CODE
  });
}
