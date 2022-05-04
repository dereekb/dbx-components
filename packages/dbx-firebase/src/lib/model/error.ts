import { readableError } from "@dereekb/util";

export const DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR = 'DOES_NOT_EXIST';

export function modelDoesNotExistError() {
  return readableError(DBX_FIREBASE_MODEL_DOES_NOT_EXIST_ERROR, 'This does not exist.')
}
