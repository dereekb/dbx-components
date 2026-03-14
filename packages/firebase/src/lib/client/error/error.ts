import { type FirebaseError } from 'firebase/app';

/**
 * Type guard that checks whether an error is a client-side {@link FirebaseError} from the `firebase/app` package.
 *
 * Distinguishes client Firebase errors from server-side errors or generic errors by checking
 * for the `FirebaseError` name and a string `code` property. Used by {@link convertHttpsCallableErrorToReadableError}
 * to determine the appropriate error wrapping strategy.
 *
 * @param error - the value to check
 * @returns `true` if the input matches the shape of a client-side `FirebaseError`
 *
 * @example
 * ```ts
 * try {
 *   await someFirebaseOperation();
 * } catch (e) {
 *   if (isClientFirebaseError(e)) {
 *     console.log(e.code); // e.g., 'auth/user-not-found'
 *   }
 * }
 * ```
 */
export function isClientFirebaseError(error: any): error is FirebaseError {
  return typeof error === 'object' && (error as FirebaseError).name === 'FirebaseError' && typeof (error as FirebaseError).code === 'string';
}
