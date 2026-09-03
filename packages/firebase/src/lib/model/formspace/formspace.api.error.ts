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
 * Thrown when a FormSpace's submission is locked before the space was ever submitted.
 *
 * A lock ends a reopen window early, so there has to be a submission for it to be about. A space that was
 * submitted and then reopened DOES qualify — locking a reopened draft is how a reviewer says "this next
 * submission is the last one".
 */
export const FORM_SPACE_NOT_SUBMITTED_ERROR_CODE = 'FORM_SPACE_NOT_SUBMITTED';

/**
 * Thrown when a submitted FormSpace is reopened after it stopped being reopenable.
 *
 * TERMINAL, unlike {@link FORM_SPACE_PROCESSING_IN_PROGRESS_ERROR_CODE}: the type never allowed reopening,
 * the reopen window has closed, `lat` has passed, or `maxReopens` is spent. Retrying cannot help, so the
 * caller should be told the submission is final rather than asked to wait.
 */
export const FORM_SPACE_NOT_REOPENABLE_ERROR_CODE = 'FORM_SPACE_NOT_REOPENABLE';

/**
 * Thrown when a FormSpace is reopened while its submission is actively being processed.
 *
 * Transient by nature — the same reopen succeeds once the processor concludes — which is why it is not
 * folded into {@link FORM_SPACE_NOT_REOPENABLE_ERROR_CODE}. Reopening under a running processor would race
 * it: the task's cleanup writes `ps`/`cpat`/`pn` and would land them on a space already handed back as a
 * draft.
 */
export const FORM_SPACE_PROCESSING_IN_PROGRESS_ERROR_CODE = 'FORM_SPACE_PROCESSING_IN_PROGRESS';

/**
 * Thrown when a FormSpace is submitted while one of its type's required slots is still empty.
 */
export const FORM_SPACE_REQUIRED_SLOT_MISSING_ERROR_CODE = 'FORM_SPACE_REQUIRED_SLOT_MISSING';

/**
 * Thrown when a FormSpace is submitted while one of its slots holds a file validation judged invalid.
 *
 * Separate from {@link FORM_SPACE_REQUIRED_SLOT_MISSING_ERROR_CODE}: the slot IS filled, so telling the owner
 * to upload something would be wrong — they need to remove or replace what is already there.
 */
export const FORM_SPACE_HAS_INVALID_FILES_ERROR_CODE = 'FORM_SPACE_HAS_INVALID_FILES';

/**
 * Thrown when a FormSpace is submitted while a slot that requires validation is still awaiting a verdict.
 *
 * Transient by nature — the same submission succeeds once validation concludes — which is why it is not
 * folded into {@link FORM_SPACE_HAS_INVALID_FILES_ERROR_CODE}.
 */
export const FORM_SPACE_VALIDATION_PENDING_ERROR_CODE = 'FORM_SPACE_VALIDATION_PENDING';

/**
 * Thrown when a file is removed from a FormSpace slot that does not hold it.
 */
export const FORM_SPACE_FILE_NOT_FOUND_ERROR_CODE = 'FORM_SPACE_FILE_NOT_FOUND';

/**
 * Thrown when a caller who may reach the FormSpace may not touch THAT file of it.
 *
 * Distinct from a plain FORBIDDEN: the caller does hold the space-level role, and the refusal is the type's
 * {@link FormSpaceFileAccess} narrowing it to the file's own uploader.
 */
export const FORM_SPACE_FILE_ACCESS_DENIED_ERROR_CODE = 'FORM_SPACE_FILE_ACCESS_DENIED';

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

/**
 * Thrown when a FormSpace is created at an explicit id that is already taken, without `getOrCreate`.
 *
 * Only reachable for a space keyed by {@link formSpaceIdForModel}; a generated id can never collide.
 */
export const FORM_SPACE_ALREADY_EXISTS_ERROR_CODE = 'FORM_SPACE_ALREADY_EXISTS';

/**
 * Thrown when a get-or-create resolves to an existing FormSpace of a DIFFERENT {@link FormSpaceType}.
 *
 * Two types keyed to the same target model derive the same id, and returning the other type's space would
 * hand the caller a document whose slots, expiration and submission handler are all someone else's.
 */
export const FORM_SPACE_TYPE_MISMATCH_ERROR_CODE = 'FORM_SPACE_TYPE_MISMATCH';
