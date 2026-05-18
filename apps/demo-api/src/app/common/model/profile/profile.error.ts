import { preconditionConflictError } from '@dereekb/firebase-server';

/**
 * Creates a precondition conflict error indicating the user has no associated Profile document.
 *
 * @param uid - The Firebase Auth UID of the user missing a profile.
 * @returns A precondition conflict error with a descriptive message.
 */
export function userHasNoProfileError(uid: string) {
  return preconditionConflictError(`User with uid ${uid} has no Profile.`);
}

/**
 * Creates a precondition conflict error indicating the requested username is already in use.
 *
 * @param username - The username that was already taken.
 * @returns A precondition conflict error with a descriptive message.
 */
export function usernameAlreadyTakenError(username: string) {
  return preconditionConflictError(`Username ${username} is already taken.`);
}
