import {
  FORM_SPACE_ALREADY_EXISTS_ERROR_CODE,
  FORM_SPACE_FILE_NOT_FOUND_ERROR_CODE,
  FORM_SPACE_HAS_INVALID_FILES_ERROR_CODE,
  FORM_SPACE_NOT_EDITABLE_ERROR_CODE,
  FORM_SPACE_NOT_FOUND_ERROR_CODE,
  FORM_SPACE_REQUIRED_SLOT_MISSING_ERROR_CODE,
  FORM_SPACE_TYPE_MISMATCH_ERROR_CODE,
  FORM_SPACE_TYPE_NOT_REGISTERED_ERROR_CODE,
  FORM_SPACE_UPLOAD_NOT_ALLOWED_ERROR_CODE,
  FORM_SPACE_UPLOAD_USER_MISMATCH_ERROR_CODE,
  FORM_SPACE_VALIDATION_PENDING_ERROR_CODE,
  type FormSpaceFileSlot,
  type FormSpaceId,
  type FormSpaceSubmitBlocker,
  type FormSpaceType,
  type FormSpaceUploadRejectionReason
} from '@dereekb/firebase';
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
 * Creates an error indicating a slot holds a file that failed validation.
 *
 * Carries the per-file reasons rather than only the slot names: "the slot is not acceptable" is not
 * actionable, "scan.png is not a readable PDF" is.
 *
 * @param blockers - The invalid-file blockers reported by `formSpaceSubmitBlockers`.
 * @returns A precondition-conflict HttpsError with the FORM_SPACE_HAS_INVALID_FILES error code.
 */
export function formSpaceHasInvalidFilesError(blockers: FormSpaceSubmitBlocker[]) {
  const slots = blockers.map((x) => x.slot);

  return preconditionConflictError({
    message: `This FormSpace holds a file that did not pass validation in slot(s): ${slots.join(', ')}.`,
    code: FORM_SPACE_HAS_INVALID_FILES_ERROR_CODE,
    data: {
      slots,
      files: blockers.flatMap((x) => (x.files ?? []).map((y) => ({ slot: y.sl, storageFile: y.sf, fileName: y.n, reason: y.r ?? y.fr ?? null })))
    }
  });
}

/**
 * Creates an error indicating a slot is still awaiting a validation verdict.
 *
 * @param slots - The slots still being validated.
 * @returns A precondition-conflict HttpsError with the FORM_SPACE_VALIDATION_PENDING error code.
 */
export function formSpaceValidationPendingError(slots: FormSpaceFileSlot[]) {
  return preconditionConflictError({
    message: `This FormSpace is still validating the file(s) in slot(s): ${slots.join(', ')}.`,
    code: FORM_SPACE_VALIDATION_PENDING_ERROR_CODE,
    data: { slots }
  });
}

/**
 * Creates an error indicating the slot does not hold the file that was asked to be removed.
 *
 * @param slot - The slot that was targeted.
 * @returns A bad-request HttpsError with the FORM_SPACE_FILE_NOT_FOUND error code.
 */
export function formSpaceFileNotFoundError(slot: FormSpaceFileSlot) {
  return badRequestError({
    message: `The target FormSpace does not hold that file in slot "${slot}".`,
    code: FORM_SPACE_FILE_NOT_FOUND_ERROR_CODE,
    data: { slot }
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

/**
 * Creates an error indicating an explicit FormSpace id is already taken.
 *
 * @param formSpaceId - The id that already exists.
 * @returns A precondition-conflict HttpsError with the FORM_SPACE_ALREADY_EXISTS error code.
 */
export function formSpaceAlreadyExistsError(formSpaceId: FormSpaceId) {
  return preconditionConflictError({
    message: `A FormSpace already exists at id "${formSpaceId}".`,
    code: FORM_SPACE_ALREADY_EXISTS_ERROR_CODE,
    data: { formSpaceId }
  });
}

/**
 * Creates an error indicating a get-or-create resolved to a space of a different type.
 *
 * @param formSpaceId - The id that resolved.
 * @param expected - The type that was asked for.
 * @param found - The type the existing space actually carries.
 * @returns A precondition-conflict HttpsError with the FORM_SPACE_TYPE_MISMATCH error code.
 */
export function formSpaceTypeMismatchError(formSpaceId: FormSpaceId, expected: FormSpaceType, found: FormSpaceType) {
  return preconditionConflictError({
    message: `The FormSpace at id "${formSpaceId}" is of type "${found}", not "${expected}".`,
    code: FORM_SPACE_TYPE_MISMATCH_ERROR_CODE,
    data: { formSpaceId, expected, found }
  });
}
