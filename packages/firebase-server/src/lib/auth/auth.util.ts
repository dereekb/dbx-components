import { type FirebaseAuthError, FIREBASE_AUTH_USER_NOT_FOUND_ERROR } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import type * as admin from 'firebase-admin';

/**
 * Safely awaits a Firebase Admin Auth user lookup, returning `undefined` instead of throwing
 * when the user is not found.
 *
 * Any error other than {@link FIREBASE_AUTH_USER_NOT_FOUND_ERROR} is re-thrown.
 *
 * @param promise - A promise resolving to a UserRecord (e.g., from `auth.getUser(uid)`).
 * @returns The user record, or `undefined` if the user does not exist.
 *
 * @example
 * ```typescript
 * const user = await getAuthUserOrUndefined(admin.auth().getUser(uid));
 * if (user) {
 *   console.log(user.email);
 * }
 * ```
 */
export async function getAuthUserOrUndefined(promise: Promise<admin.auth.UserRecord>): Promise<Maybe<admin.auth.UserRecord>> {
  try {
    return await promise;
  } catch (error: unknown) {
    if ((error as FirebaseAuthError)?.code === FIREBASE_AUTH_USER_NOT_FOUND_ERROR) {
      return undefined;
    } else {
      throw error;
    }
  }
}
