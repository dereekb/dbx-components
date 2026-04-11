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

// MARK: Password Reset
/**
 * Error code used when the provided password reset code is invalid or expired.
 */
export const DBX_FIREBASE_SERVER_PASSWORD_RESET_INVALID_CODE_ERROR_CODE = 'PASSWORD_RESET_INVALID_CODE';

/**
 * Error code used when a password reset is attempted but no active reset exists for the user.
 */
export const DBX_FIREBASE_SERVER_PASSWORD_RESET_NO_CONFIG_ERROR_CODE = 'PASSWORD_RESET_NO_CONFIG';

/**
 * Error code used when a password reset email send is throttled due to a recent send.
 */
export const DBX_FIREBASE_SERVER_PASSWORD_RESET_THROTTLE_ERROR_CODE = 'PASSWORD_RESET_THROTTLE';

/**
 * Error code used when a password reset email has already been sent and the send-once constraint is active.
 */
export const DBX_FIREBASE_SERVER_PASSWORD_RESET_SEND_ONCE_ERROR_CODE = 'PASSWORD_RESET_SEND_ONCE';
