import { type Auth, type User, onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { Observable } from 'rxjs';
import { type Maybe } from '@dereekb/util';

/**
 * Creates an Observable that emits the current Firebase auth state.
 *
 * Wraps `onAuthStateChanged` in an Observable. Emits the current `User` when
 * signed in, or `null`/`undefined` when signed out.
 *
 * Replacement for rxfire's `authState()`.
 *
 * @param auth - The Firebase Auth instance to observe.
 * @returns Observable that emits the current user or null/undefined.
 */
export function firebaseAuthState(auth: Auth): Observable<Maybe<User>> {
  return new Observable<Maybe<User>>((subscriber) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => subscriber.next(user),
      (error) => subscriber.error(error),
      () => subscriber.complete()
    );
    return { unsubscribe };
  });
}

/**
 * Creates an Observable that emits the current Firebase ID token string.
 *
 * Wraps `onIdTokenChanged` in an Observable. When a user is signed in,
 * emits the ID token string via `getIdToken()`. When signed out, emits `null`.
 *
 * Replacement for rxfire's `idToken()`.
 *
 * @param auth - The Firebase Auth instance to observe.
 * @returns Observable that emits the current ID token string or null.
 */
export function firebaseIdToken(auth: Auth): Observable<Maybe<string>> {
  return new Observable<Maybe<string>>((subscriber) => {
    const unsubscribe = onIdTokenChanged(
      auth,
      (user) => {
        if (user) {
          user.getIdToken().then(
            (token) => subscriber.next(token),
            (error) => subscriber.error(error)
          );
        } else {
          subscriber.next(null);
        }
      },
      (error) => subscriber.error(error),
      () => subscriber.complete()
    );
    return { unsubscribe };
  });
}
