import { type ReadableError } from '@dereekb/util';
import { type FirebaseErrorCode } from '../error';

export interface FirebaseAuthError {
  readonly code: FirebaseErrorCode;
  readonly name: string;
  readonly customData: unknown;
}

export const FIREBASE_AUTH_USER_NOT_FOUND_ERROR = 'auth/user-not-found';
export const FIREBASE_AUTH_WRONG_PASSWORD = 'auth/wrong-password';
export const FIREBASE_AUTH_NETWORK_REQUEST_ERROR = 'auth/network-request-error';
export const FIREBASE_AUTH_NETWORK_REQUEST_FAILED = 'auth/network-request-failed';

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
    default:
      error = {
        code,
        message: 'An error occured.'
      };
      break;
  }

  return error;
}
