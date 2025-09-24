import { UPLOADED_FILE_DOES_NOT_EXIST_ERROR_CODE, UPLOADED_FILE_INITIALIZATION_DISCARDED_ERROR_CODE, UPLOADED_FILE_INITIALIZATION_FAILED_ERROR_CODE, UPLOADED_FILE_NOT_ALLOWED_TO_BE_INITIALIZED_ERROR_CODE, UploadedFileInitializationFailedErrorData } from '@dereekb/firebase';
import { internalServerError, preconditionConflictError } from '@dereekb/firebase-server';

export function uploadedFileDoesNotExistError() {
  return preconditionConflictError({
    message: `The target uploaded file does not exist.`,
    code: UPLOADED_FILE_DOES_NOT_EXIST_ERROR_CODE
  });
}

export function uploadedFileIsNotAllowedToBeInitializedError() {
  return preconditionConflictError({
    message: `The target uploaded file is not allowed to be initialized.`,
    code: UPLOADED_FILE_NOT_ALLOWED_TO_BE_INITIALIZED_ERROR_CODE
  });
}

export function uploadedFileInitializationFailedError(data: UploadedFileInitializationFailedErrorData) {
  return internalServerError({
    message: `The target uploaded file initialization failed with result type.`,
    code: UPLOADED_FILE_INITIALIZATION_FAILED_ERROR_CODE,
    data: {
      resultType: data.resultType
    }
  });
}

export function uploadedFileInitializationDiscardedError() {
  return internalServerError({
    message: `The target uploaded file initialization was discarded.`,
    code: UPLOADED_FILE_INITIALIZATION_DISCARDED_ERROR_CODE
  });
}
