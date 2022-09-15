import { FirebaseAuthError, FIREBASE_AUTH_USER_NOT_FOUND_ERROR } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import * as admin from 'firebase-admin';

/**
 * Awaits the load result from the input promise. If it encounters a FIREBASE_AUTH_USER_NOT_FOUND_ERROR, then returns undefined. Throws the error otherwise.
 * @param promise
 * @returns
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
