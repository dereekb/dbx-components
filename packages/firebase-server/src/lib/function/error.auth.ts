import { FIREBASE_AUTH_PHONE_NUMBER_ALREADY_EXISTS_ERROR } from '@dereekb/firebase';
import { type ThrowErrorFunction } from '@dereekb/util';
import type * as admin from 'firebase-admin';
import { handleFirebaseError, preconditionConflictError } from './error';

/**
 * Error code for when a phone number is already registered in Firebase Auth.
 */
export const PHONE_NUMBER_ALREADY_EXISTS_ERROR_CODE = 'PHONE_NUMBER_ALREADY_EXISTS';

/**
 * Creates a precondition conflict (409) error indicating the phone number already exists.
 *
 * @returns A new precondition-conflict (409) {@link HttpsError} with the phone-number-exists code.
 */
export function phoneNumberAlreadyExistsError() {
  return preconditionConflictError({
    code: PHONE_NUMBER_ALREADY_EXISTS_ERROR_CODE,
    message: 'This phone number already exists in the system.'
  });
}

/**
 * Handles Firebase Auth errors by mapping known error codes to typed HTTP errors.
 *
 * Currently maps `auth/phone-number-already-exists` to a 409 conflict error.
 * Unknown error codes are forwarded to the optional handler.
 *
 * @param e - The caught error.
 * @param handleUnknownCode - Optional handler for Firebase errors with unrecognized codes.
 */
export function handleFirebaseAuthError(e: unknown, handleUnknownCode?: ThrowErrorFunction<admin.FirebaseError>): never | void {
  handleFirebaseError(e, (firebaseError) => {
    switch (firebaseError.code) {
      case FIREBASE_AUTH_PHONE_NUMBER_ALREADY_EXISTS_ERROR:
        throw phoneNumberAlreadyExistsError();
      default:
        handleUnknownCode?.(firebaseError);
        break;
    }
  });
}
