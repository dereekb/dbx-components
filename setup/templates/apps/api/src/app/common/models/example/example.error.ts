import { preconditionConflictError } from "@dereekb/firebase-server";

export function userHasNoExampleError(uid: string) {
  return preconditionConflictError(`User with uid ${uid} has no Example.`);
}
