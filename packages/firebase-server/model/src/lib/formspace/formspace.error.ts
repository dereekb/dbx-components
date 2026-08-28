import { FORM_SPACE_NOT_EDITABLE_ERROR_CODE, FORM_SPACE_NOT_FOUND_ERROR_CODE, FORM_SPACE_REQUIRED_SLOT_MISSING_ERROR_CODE, FORM_SPACE_TYPE_NOT_REGISTERED_ERROR_CODE, FORM_SPACE_UPLOAD_NOT_ALLOWED_ERROR_CODE, FORM_SPACE_UPLOAD_USER_MISMATCH_ERROR_CODE, type FormSpaceFileSlot, type FormSpaceType, type FormSpaceUploadRejectionReason } from '@dereekb/firebase';
import { badRequestError, preconditionConflictError, unavailableError } from '@dereekb/firebase-server';

/**
 * Creates an error indicating the app never registered the requested {@link FormSpaceType}.
 *
 * @param formSpaceType - The unregistered type.
 * @returns A bad-request HttpsError with the FORM_SPACE_TYPE_NOT_REGISTERED error code.
 */
export function formSpaceTypeNotRegisteredError(formSpaceType: FormSpaceType) {
  return badRequestError({
    message: `The FormSpaceType "${formSpaceType}" is not registered with this app.`,
    code: FORM_SPACE_TYPE_NOT_REGISTERED_ERROR_CODE
  });
}

/**
 * Creates an error indicating the FormSpace is no longer a draft, so it cannot be changed.
 *
 * @returns A precondition-conflict HttpsError with the FORM_SPACE_NOT_EDITABLE error code.
 */
export function formSpaceNotEditableError() {
  return preconditionConflictError({
    message: `This FormSpace is no longer editable.`,
    code: FORM_SPACE_NOT_EDITABLE_ERROR_CODE
  });
}

/**
 * Creates an error indicating a required upload slot is still empty at submission time.
 *
 * @param slots - The unsatisfied slots.
 * @returns A precondition-conflict HttpsError with the FORM_SPACE_REQUIRED_SLOT_MISSING error code.
 */
export function formSpaceRequiredSlotMissingError(slots: FormSpaceFileSlot[]) {
  return preconditionConflictError({
    message: `This FormSpace is missing a file in required slot(s): ${slots.join(', ')}.`,
    code: FORM_SPACE_REQUIRED_SLOT_MISSING_ERROR_CODE,
    data: { slots }
  });
}

/**
 * Creates an error indicating the upload was rejected by the type's rules.
 *
 * @param reason - Why the upload was rejected.
 * @returns A bad-request HttpsError with the FORM_SPACE_UPLOAD_NOT_ALLOWED error code.
 */
export function formSpaceUploadNotAllowedError(reason: FormSpaceUploadRejectionReason) {
  return badRequestError({
    message: `This upload is not allowed for this FormSpace: ${reason}.`,
    code: FORM_SPACE_UPLOAD_NOT_ALLOWED_ERROR_CODE,
    data: { reason }
  });
}

/**
 * Creates an error indicating the uploader is not the user the FormSpace belongs to.
 *
 * @returns A bad-request HttpsError with the FORM_SPACE_UPLOAD_USER_MISMATCH error code.
 */
export function formSpaceUploadUserMismatchError() {
  return badRequestError({
    message: `This file was uploaded by a user that does not own the target FormSpace.`,
    code: FORM_SPACE_UPLOAD_USER_MISMATCH_ERROR_CODE
  });
}

/**
 * Creates an error indicating the referenced FormSpace does not exist.
 *
 * @returns An unavailable HttpsError with the FORM_SPACE_NOT_FOUND error code.
 */
export function formSpaceNotFoundError() {
  return unavailableError({
    message: `The target FormSpace does not exist.`,
    code: FORM_SPACE_NOT_FOUND_ERROR_CODE
  });
}
