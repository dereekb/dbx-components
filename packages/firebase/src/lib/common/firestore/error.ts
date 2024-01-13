import { objectHasNoKeys } from '@dereekb/util';
import { type UpdateData } from 'firebase/firestore';

export function unsupportedFirestoreDriverFunctionError(message?: string) {
  throw new Error(message ?? 'This function is not supported by this Firestore driver.');
}

/**
 * Asserts that the input data is not an empty object and has keys.
 *
 * Used to help bring pairity to update(), as google-cloud/firestore will throw an error if the input data has no keys defined.
 *
 * @param data
 */
export function assertFirestoreUpdateHasData(data: UpdateData<object>) {
  if (objectHasNoKeys(data)) {
    throw firestoreUpdateWithNoDataError();
  }
}

/**
 * Throws an error related to an empty object being passed to a FirestoreDocumentDataAccessor's update() function.
 */
export function firestoreUpdateWithNoDataError() {
  throw new Error('No data or an empty object was passed to update().');
}
