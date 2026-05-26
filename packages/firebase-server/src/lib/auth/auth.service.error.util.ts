import { DBX_FIREBASE_SERVER_PASSWORD_RESET_INVALID_CODE_ERROR_CODE, DBX_FIREBASE_SERVER_PASSWORD_RESET_NO_CONFIG_ERROR_CODE, DBX_FIREBASE_SERVER_PASSWORD_RESET_SEND_ONCE_ERROR_CODE, DBX_FIREBASE_SERVER_PASSWORD_RESET_THROTTLE_ERROR_CODE } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { badRequestError, permissionDeniedError, unavailableError } from '../function';
import { FirebaseServerAuthPasswordResetInvalidCodeError, FirebaseServerAuthPasswordResetNoResetConfigError, FirebaseServerAuthPasswordResetSendOnceError, FirebaseServerAuthPasswordResetThrottleError } from './auth.service.error';

/**
 * Wraps an async function that uses {@link FirebaseServerUserPasswordResetService} methods,
 * catching password-reset-specific errors and re-throwing them as appropriate {@link HttpsError} instances
 * suitable for returning to clients.
 *
 * Default mapping (security-hardened — enumeration-safe, for end-user callers):
 * - {@link FirebaseServerAuthPasswordResetInvalidCodeError} → permission-denied (403)
 * - {@link FirebaseServerAuthPasswordResetNoResetConfigError} → permission-denied (403), same opaque
 *   response as InvalidCode so callers cannot distinguish "wrong code" from "no reset active".
 * - {@link FirebaseServerAuthPasswordResetSendOnceError} → permission-denied (403), same opaque
 *   response so callers cannot probe whether a reset was already initiated.
 * - {@link FirebaseServerAuthPasswordResetThrottleError} → unavailable (503) with a generic message
 *   (no `lastSentAt` is leaked).
 *
 * Admin mapping (`isAdmin: true`) — preserves distinct error codes and statuses so an admin
 * resetting on behalf of another user can see the actual reason. Used when the call originates
 * from an authenticated admin, where enumeration is not a concern:
 * - {@link FirebaseServerAuthPasswordResetInvalidCodeError} → permission-denied (403)
 * - {@link FirebaseServerAuthPasswordResetNoResetConfigError} → bad-request (400), distinct message
 * - {@link FirebaseServerAuthPasswordResetSendOnceError} → bad-request (400), distinct message
 * - {@link FirebaseServerAuthPasswordResetThrottleError} → unavailable (503), same as default
 *
 * @param fn - The async function to execute.
 * @param isAdmin - When `true`, returns distinct error codes/messages instead of the
 *   enumeration-safe opaque response. Pass the caller's admin status here.
 * @returns The result of the function.
 */
export async function catchAndThrowPasswordResetServerErrors<T>(fn: () => Promise<T>, isAdmin?: Maybe<boolean>): Promise<T> {
  let result: T;

  try {
    result = await fn();
  } catch (error) {
    if (error instanceof FirebaseServerAuthPasswordResetInvalidCodeError) {
      throw authServicePasswordResetInvalidCodeError();
    } else if (error instanceof FirebaseServerAuthPasswordResetNoResetConfigError) {
      throw isAdmin ? authServicePasswordResetNoConfigError() : authServicePasswordResetInvalidCodeError();
    } else if (error instanceof FirebaseServerAuthPasswordResetSendOnceError) {
      throw isAdmin ? authServicePasswordResetSendOnceError() : authServicePasswordResetInvalidCodeError();
    } else if (error instanceof FirebaseServerAuthPasswordResetThrottleError) {
      throw authServicePasswordResetThrottleError();
    }

    throw error;
  }

  return result;
}

/**
 * Creates a permission-denied (403) server error for an invalid or expired password reset code.
 *
 * @returns An {@link HttpsError} with code `permission-denied`.
 */
export function authServicePasswordResetInvalidCodeError() {
  return permissionDeniedError({
    code: DBX_FIREBASE_SERVER_PASSWORD_RESET_INVALID_CODE_ERROR_CODE,
    message: 'Invalid or expired reset code.'
  });
}

/**
 * Creates a bad-request (400) server error when no active password reset exists for the user.
 *
 * Distinct from {@link authServicePasswordResetInvalidCodeError}. Use only when the caller is
 * trusted (e.g., an admin) and revealing "no reset active" is not an enumeration risk; for
 * end-user callers, {@link catchAndThrowPasswordResetServerErrors} maps this case to the same
 * opaque response as `InvalidCodeError`.
 *
 * @returns An {@link HttpsError} with code `invalid-argument`.
 */
export function authServicePasswordResetNoConfigError() {
  return badRequestError({
    code: DBX_FIREBASE_SERVER_PASSWORD_RESET_NO_CONFIG_ERROR_CODE,
    message: 'No active password reset for this user.'
  });
}

/**
 * Creates an unavailable (503) server error when password reset email sending is throttled.
 *
 * @returns An {@link HttpsError} with code `unavailable`.
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
 *
 * @returns An {@link HttpsError} with code `invalid-argument`.
 */
export function authServicePasswordResetSendOnceError() {
  return badRequestError({
    code: DBX_FIREBASE_SERVER_PASSWORD_RESET_SEND_ONCE_ERROR_CODE,
    message: 'Password reset email has already been sent.'
  });
}
