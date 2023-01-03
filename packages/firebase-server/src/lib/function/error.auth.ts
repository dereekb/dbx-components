import { ThrowErrorFunction } from '@dereekb/util';
import * as admin from 'firebase-admin';
import { handleFirebaseError, preconditionConflictError } from './error';

export const PHONE_NUMBER_ALREADY_EXISTS_ERROR_CODE = 'PHONE_NUMBER_ALREADY_EXISTS';

export function phoneNumberAlreadyExistsError() {
  return preconditionConflictError({
    code: PHONE_NUMBER_ALREADY_EXISTS_ERROR_CODE,
    message: 'This phone number already exists in the system.'
  });
}

export function handleFirebaseAuthError(e: unknown, handleUnknownCode?: ThrowErrorFunction<admin.FirebaseError>): never | void {
  handleFirebaseError(e, (firebaseError) => {
    switch (firebaseError.code) {
      case 'auth/phone-number-already-exists':
        throw phoneNumberAlreadyExistsError();
      default:
        handleUnknownCode?.(firebaseError);
        break;
    }
  });
}
