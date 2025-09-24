import { StorageFileInitializeFromUploadResultType } from './storagefile.upload';

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
}

/**
 * Thrown if the target uploaded file initialization was successful, but produced no new StorageFileDocument.
 */
export const UPLOADED_FILE_INITIALIZATION_DISCARDED_ERROR_CODE = 'UPLOADED_FILE_INITIALIZATION_DISCARDED';
