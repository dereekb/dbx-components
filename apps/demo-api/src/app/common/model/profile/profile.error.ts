import { preconditionConflictError } from "@dereekb/firebase-server";

export function userHasNoProfileError(uid: string) {
  return preconditionConflictError(`User with uid ${uid} has no Profile.`);
}
