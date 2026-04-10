import { DBX_FIREBASE_SERVER_PASSWORD_RESET_INVALID_CODE_ERROR_CODE, DBX_FIREBASE_SERVER_PASSWORD_RESET_NO_CONFIG_ERROR_CODE, DBX_FIREBASE_SERVER_PASSWORD_RESET_SEND_ONCE_ERROR_CODE, DBX_FIREBASE_SERVER_PASSWORD_RESET_THROTTLE_ERROR_CODE } from '@dereekb/firebase';
import { badRequestError, permissionDeniedError, unavailableError } from '../function';
import { FirebaseServerAuthPasswordResetInvalidCodeError, FirebaseServerAuthPasswordResetNoResetConfigError, FirebaseServerAuthPasswordResetSendOnceError, FirebaseServerAuthPasswordResetThrottleError } from './auth.service.error';

/**
 * Wraps an async function that uses {@link FirebaseServerUserPasswordResetService} methods,
 * catching password-reset-specific errors and re-throwing them as appropriate {@link HttpsError} instances
 * suitable for returning to clients.
 *
 * Error mapping:
 * - {@link FirebaseServerAuthPasswordResetInvalidCodeError} → permission-denied (403)
 * - {@link FirebaseServerAuthPasswordResetNoResetConfigError} → bad-request (400)
 * - {@link FirebaseServerAuthPasswordResetThrottleError} → unavailable (503)
 * - {@link FirebaseServerAuthPasswordResetSendOnceError} → bad-request (400)
 *
 * @param fn - The async function to execute.
 * @returns The result of the function.
 */
export async function catchAndThrowPasswordResetServerErrors<T>(fn: () => Promise<T>): Promise<T> {
  let result: T;

  try {
    result = await fn();
  } catch (error) {
    if (error instanceof FirebaseServerAuthPasswordResetInvalidCodeError) {
      throw authServicePasswordResetInvalidCodeError();
    } else if (error instanceof FirebaseServerAuthPasswordResetNoResetConfigError) {
      throw authServicePasswordResetNoConfigError();
    } else if (error instanceof FirebaseServerAuthPasswordResetThrottleError) {
      throw authServicePasswordResetThrottleError();
    } else if (error instanceof FirebaseServerAuthPasswordResetSendOnceError) {
      throw authServicePasswordResetSendOnceError();
    }

    throw error;
  }

  return result;
}

/**
 * Creates a permission-denied (403) server error for an invalid or expired password reset code.
 */
export function authServicePasswordResetInvalidCodeError() {
  return permissionDeniedError({
    code: DBX_FIREBASE_SERVER_PASSWORD_RESET_INVALID_CODE_ERROR_CODE,
    message: 'Invalid or expired reset password code.'
  });
}

/**
 * Creates a bad-request (400) server error when no active password reset exists for the user.
 */
export function authServicePasswordResetNoConfigError() {
  return badRequestError({
    code: DBX_FIREBASE_SERVER_PASSWORD_RESET_NO_CONFIG_ERROR_CODE,
    message: 'No active password reset for this user.'
  });
}

/**
 * Creates an unavailable (503) server error when password reset email sending is throttled.
 */
export function authServicePasswordResetThrottleError() {
  return unavailableError({
    code: DBX_FIREBASE_SERVER_PASSWORD_RESET_THROTTLE_ERROR_CODE,
    message: 'Password reset email was recently sent. Try again later.'
  });
}

/**
 * Creates a bad-request (400) server error when the password reset email has already been sent
 * and the send-once constraint is active.
 */
export function authServicePasswordResetSendOnceError() {
  return badRequestError({
    code: DBX_FIREBASE_SERVER_PASSWORD_RESET_SEND_ONCE_ERROR_CODE,
    message: 'Password reset email has already been sent.'
  });
}
