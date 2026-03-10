import { objectHasNoKeys } from '@dereekb/util';
import { type UpdateData } from 'firebase/firestore';

/**
 * Throws an error indicating the current Firestore driver does not support the called function.
 * Used by driver implementations to reject unsupported operations at runtime.
 *
 * @param message - Optional custom error message
 * @throws {Error} Always throws
 */
export function unsupportedFirestoreDriverFunctionError(message?: string) {
  throw new Error(message ?? 'This function is not supported by this Firestore driver.');
}

/**
 * Asserts that the input update data contains at least one key.
 *
 * The `google-cloud/firestore` Admin SDK throws on empty update objects, but the Web SDK
 * does not. This assertion normalizes behavior across both platforms so that empty updates
 * are caught early regardless of which driver is in use.
 *
 * @param data - The update data to validate
 * @throws {Error} When the data object has no keys
 */
export function assertFirestoreUpdateHasData(data: UpdateData<object>) {
  if (objectHasNoKeys(data)) {
    throw firestoreUpdateWithNoDataError();
  }
}

/**
 * Creates and throws an error for empty update data passed to a {@link FirestoreDocumentDataAccessor}'s `update()` method.
 *
 * @throws {Error} Always throws
 */
export function firestoreUpdateWithNoDataError() {
  throw new Error('No data or an empty object was passed to update().');
}
