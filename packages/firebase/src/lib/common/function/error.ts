// MARK: HTTP Error Codes
/**
 * Error code for unauthenticated (401) requests.
 */
export const UNAUTHENTICATED_ERROR_CODE = 'UNAUTHENTICATED';

/**
 * Error code for forbidden (403) requests.
 */
export const FORBIDDEN_ERROR_CODE = 'FORBIDDEN';

/**
 * Error code for permission-denied (403) requests.
 */
export const PERMISSION_DENIED_ERROR_CODE = 'PERMISSION_DENIED';

/**
 * Error code for not-found (404) requests.
 */
export const NOT_FOUND_ERROR_CODE = 'NOT_FOUND';

/**
 * Error code for a Firestore document that does not exist (404).
 */
export const MODEL_NOT_AVAILABLE_ERROR_CODE = 'MODEL_NOT_AVAILABLE';

/**
 * Error code for bad-request (400) responses.
 */
export const BAD_REQUEST_ERROR_CODE = 'BAD_REQUEST';

/**
 * Error code for precondition-conflict (409) responses.
 */
export const CONFLICT_ERROR_CODE = 'CONFLICT';

/**
 * Error code for already-exists (409) responses.
 */
export const ALREADY_EXISTS_ERROR_CODE = 'ALREADY_EXISTS';

/**
 * Error code for unavailable (503) responses.
 */
export const UNAVAILABLE_ERROR_CODE = 'UNAVAILABLE';

/**
 * Error code for deactivated or unavailable functions (501).
 */
export const UNAVAILABLE_OR_DEACTIVATED_FUNCTION_ERROR_CODE = 'UNAVAILABLE_OR_DEACTIVATED_FUNCTION';

/**
 * Error code for internal server errors (500).
 */
export const INTERNAL_SERVER_ERROR_CODE = 'INTERNAL_ERROR';
