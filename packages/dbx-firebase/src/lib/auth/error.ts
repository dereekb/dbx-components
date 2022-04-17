import { ReadableError } from "@dereekb/util";

export interface FirebaseAuthError {
  code: string;
  name: string;
  customData: any;
}

export const FIREBASE_AUTH_USER_NOT_FOUND_ERROR = 'auth/user-not-found';
export const FIREBASE_AUTH_NETWORK_REQUEST_ERROR = 'auth/network-request-error';

export function firebaseAuthErrorToReadableError(inputError: FirebaseAuthError): ReadableError {
  const code = inputError.code;
  let error: ReadableError;

  switch (code) {
    case FIREBASE_AUTH_USER_NOT_FOUND_ERROR:
      error = {
        code,
        message: 'A user with this email address was not found.'
      };
      break;
    case FIREBASE_AUTH_NETWORK_REQUEST_ERROR:
      error = {
        code,
        message: 'Could not reach the server.'
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
