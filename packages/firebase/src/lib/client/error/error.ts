import { type FirebaseError } from 'firebase/app';

/**
 * Returns true if the input is seen as a client-side FirebaseError.
 *
 * @param error
 * @returns
 */
export function isClientFirebaseError(error: any): error is FirebaseError {
  return typeof error === 'object' && (error as FirebaseError).name === 'FirebaseError' && typeof (error as FirebaseError).code === 'string';
}
