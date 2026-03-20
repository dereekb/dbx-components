import { type CallableContext } from '../type';
import { unauthenticatedContextHasNoAuthData } from './error';

/**
 * A {@link CallableContext} narrowed to guarantee that `auth` data is present.
 *
 * Used as the base context type for authenticated function handlers throughout `@dereekb/firebase-server`.
 */
export type CallableContextWithAuthData<R extends CallableContext = CallableContext> = Omit<R, 'auth'> & Required<Pick<R, 'auth'>>;

/**
 * Type guard that checks whether the given callable context contains authenticated user data (non-null auth with a uid).
 *
 * @param context - The callable context to check.
 * @returns `true` if the context has authenticated user data with a valid UID.
 *
 * @example
 * ```typescript
 * if (isContextWithAuthData(context)) {
 *   console.log(context.auth.uid);
 * }
 * ```
 */
export function isContextWithAuthData<R extends CallableContext>(context: CallableContext): context is CallableContextWithAuthData<R> {
  return Boolean(context.auth?.uid);
}

/**
 * Asserts that the callable context contains authenticated user data.
 *
 * @param context - The callable context to assert on.
 * @throws {HttpsError} Throws an unauthenticated error if auth data is missing.
 *
 * @example
 * ```typescript
 * assertIsContextWithAuthData(context);
 * // context.auth is now guaranteed to be present
 * ```
 */
export function assertIsContextWithAuthData<R extends CallableContext>(context: CallableContext): asserts context is CallableContextWithAuthData<R> {
  if (!isContextWithAuthData(context)) {
    throw unauthenticatedContextHasNoAuthData();
  }
}
