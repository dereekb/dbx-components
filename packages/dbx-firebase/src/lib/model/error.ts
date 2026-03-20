import { readableError } from '@dereekb/util';

export const DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR = 'DOES_NOT_EXIST';

/**
 * Creates a readable error indicating that the requested Firebase model document does not exist.
 *
 * @returns A readable error with the 'DOES_NOT_EXIST' code and a descriptive message.
 */
export function modelDoesNotExistError() {
  return readableError(DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR, 'The document does not exist.');
}
