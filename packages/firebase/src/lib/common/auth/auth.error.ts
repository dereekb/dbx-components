import { type ReadableError } from '@dereekb/util';
import { type FirebaseErrorCode } from '../error';

/**
 * Shape of a Firebase Authentication error, matching the error structure from the Firebase Auth SDK.
 */
export interface FirebaseAuthError {
  readonly code: FirebaseErrorCode;
  readonly name: string;
  readonly customData: unknown;
}

/**
 * Error code when the user account is not found.
 */
export const FIREBASE_AUTH_USER_NOT_FOUND_ERROR = 'auth/user-not-found';
/**
 * Error code when the password is incorrect.
 */
export const FIREBASE_AUTH_WRONG_PASSWORD = 'auth/wrong-password';
/**
 * Error code for a network request error (client SDK).
 */
export const FIREBASE_AUTH_NETWORK_REQUEST_ERROR = 'auth/network-request-error';
/**
 * Error code for a failed network request (client SDK).
 */
export const FIREBASE_AUTH_NETWORK_REQUEST_FAILED = 'auth/network-request-failed';
/**
 * Error code when a phone number is already associated with another account.
 */
export const FIREBASE_AUTH_PHONE_NUMBER_ALREADY_EXISTS_ERROR = 'auth/phone-number-already-exists';
/**
 * Error code when an email is already associated with another account.
 */
export const FIREBASE_AUTH_EMAIL_ALREADY_EXISTS_ERROR = 'auth/email-already-exists';
/**
 * Error code when the provided phone number is not a valid E.164 string.
 */
export const FIREBASE_AUTH_INVALID_PHONE_NUMBER_ERROR = 'auth/invalid-phone-number';
/**
 * Error code when a provider is already linked to the current user account.
 */
export const FIREBASE_AUTH_PROVIDER_ALREADY_LINKED_ERROR = 'auth/provider-already-linked';
/**
 * Error code when the credential is already associated with a different user account.
 */
export const FIREBASE_AUTH_CREDENTIAL_ALREADY_IN_USE_ERROR = 'auth/credential-already-in-use';
/**
 * Error code when an email address is already in use by another account during linking.
 */
export const FIREBASE_AUTH_EMAIL_ALREADY_IN_USE_ERROR = 'auth/email-already-in-use';

/**
 * Converts a {@link FirebaseAuthError} into a user-friendly {@link ReadableError} with a human-readable message.
 *
 * Maps known error codes (wrong password, user not found, network errors) to contextual messages
 * suitable for display in the UI.
 *
 * @param inputError - the Firebase Auth error to convert
 * @returns a {@link ReadableError} with a human-readable message suitable for display
 *
 * @example
 * ```ts
 * try {
 *   await signIn(email, password);
 * } catch (e) {
 *   const readable = firebaseAuthErrorToReadableError(e as FirebaseAuthError);
 *   showToast(readable.message);
 * }
 * ```
 */
export function firebaseAuthErrorToReadableError(inputError: FirebaseAuthError): ReadableError {
  const code = inputError.code;
  let error: ReadableError;

  switch (code) {
    case FIREBASE_AUTH_WRONG_PASSWORD:
      error = {
        code,
        message: `The password you entered does not match our records. Please try again or click on "Forgot Password" to reset your password.`
      };
      break;
    case FIREBASE_AUTH_USER_NOT_FOUND_ERROR:
      error = {
        code,
        message: 'A user with this email address was not found.'
      };
      break;
    case FIREBASE_AUTH_NETWORK_REQUEST_FAILED:
    case FIREBASE_AUTH_NETWORK_REQUEST_ERROR:
      error = {
        code,
        message: 'Could not reach the server. Are you connected to the internet?'
      };
      break;
    case FIREBASE_AUTH_PROVIDER_ALREADY_LINKED_ERROR:
      error = {
        code,
        message: 'This provider is already linked to your account.'
      };
      break;
    case FIREBASE_AUTH_CREDENTIAL_ALREADY_IN_USE_ERROR:
      error = {
        code,
        message: 'These credentials are already associated with a different account.'
      };
      break;
    case FIREBASE_AUTH_EMAIL_ALREADY_IN_USE_ERROR:
      error = {
        code,
        message: 'This email address is already in use by another account.'
      };
      break;
    default:
      error = {
        code,
        message: 'An error occured.'
      };
      break;
  }

  return error;
}
