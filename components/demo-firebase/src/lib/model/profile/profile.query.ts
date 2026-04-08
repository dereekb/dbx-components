import { type FirestoreQueryConstraint, where } from '@dereekb/firebase';

/**
 * Creates a Firestore query constraint that matches a profile by its unique username.
 *
 * @param username - The username to search for.
 * @returns A FirestoreQueryConstraint filtering on the 'username' field.
 */
export function profileWithUsername(username: string): FirestoreQueryConstraint {
  return where('username', '==', username);
}
