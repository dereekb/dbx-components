/**
 * @module formspace.api.error
 *
 * Error codes raised by the FormSpace actions and its upload initializer.
 */

/**
 * Thrown when a FormSpace is created for a {@link FormSpaceType} the app never registered.
 *
 * Unlike a SWEEP over existing documents — which falls back to {@link DEFAULT_FORM_SPACE_TYPE_CONFIG} so one
 * bad document cannot take the pass down — creation is strict: an unregistered type has no upload rules and
 * no handler, so a space of that type could never be filled in or submitted.
 */
export const FORM_SPACE_TYPE_NOT_REGISTERED_ERROR_CODE = 'FORM_SPACE_TYPE_NOT_REGISTERED';

/**
 * Thrown when a FormSpace is edited, uploaded into, or submitted after it stopped being a draft.
 */
export const FORM_SPACE_NOT_EDITABLE_ERROR_CODE = 'FORM_SPACE_NOT_EDITABLE';

/**
 * Thrown when a FormSpace is submitted while one of its type's required slots is still empty.
 */
export const FORM_SPACE_REQUIRED_SLOT_MISSING_ERROR_CODE = 'FORM_SPACE_REQUIRED_SLOT_MISSING';

/**
 * Thrown when an upload is rejected by {@link assertFormSpaceUploadAllowed}.
 */
export const FORM_SPACE_UPLOAD_NOT_ALLOWED_ERROR_CODE = 'FORM_SPACE_UPLOAD_NOT_ALLOWED';

/**
 * Thrown when a file is uploaded into a FormSpace by someone other than the user the space belongs to.
 */
export const FORM_SPACE_UPLOAD_USER_MISMATCH_ERROR_CODE = 'FORM_SPACE_UPLOAD_USER_MISMATCH';

/**
 * Thrown when a FormSpace upload path names a FormSpace that does not exist.
 */
export const FORM_SPACE_NOT_FOUND_ERROR_CODE = 'FORM_SPACE_NOT_FOUND';
