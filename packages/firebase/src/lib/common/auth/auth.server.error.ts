/**
 * Error code used when a Firebase Cloud Function is called without any authentication context.
 *
 * Typically caught by middleware that validates auth before allowing the function to proceed.
 */
export const DBX_FIREBASE_SERVER_NO_AUTH_ERROR_CODE = 'NO_AUTH';

/**
 * Error code used when a Firebase Cloud Function has an auth context but is missing the user UID.
 *
 * This can happen with anonymous or malformed tokens.
 */
export const DBX_FIREBASE_SERVER_NO_UID_ERROR_CODE = 'NO_USER_UID';
