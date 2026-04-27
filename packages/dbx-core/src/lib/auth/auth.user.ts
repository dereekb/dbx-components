import { type Maybe } from '@dereekb/util';

/**
 * Represents the authentication state of an application user.
 *
 * These generic states define the current lifecycle stage of a user's authentication:
 *
 * - `'none'` - The user is not logged in (no active session).
 * - `'anon'` - The user is authenticated via an anonymous account (e.g., Firebase anonymous auth).
 * - `'error'` - An error occurred while resolving the user's authentication state.
 * - `'new'` - The user has a full account but has not yet completed onboarding or initial setup.
 * - `'user'` - The user has a full account and has completed all setup steps.
 *
 * @example
 * ```ts
 * const state: AuthUserState = 'user';
 *
 * if (state === 'new') {
 *   // redirect to onboarding
 * }
 * ```
 */
export type AuthUserState = 'none' | 'anon' | 'new' | 'user' | 'error';

/**
 * Arbitrary string identifier used to uniquely differentiate authenticated users.
 *
 * Typically corresponds to a UID from the authentication provider (e.g., Firebase Auth UID).
 *
 * @see {@link NO_AUTH_USER_IDENTIFIER} for the sentinel value representing an unidentified user.
 */
export type AuthUserIdentifier = string;

/**
 * Sentinel value representing an unauthenticated or unidentifiable user.
 *
 * Used as a fallback when no valid {@link AuthUserIdentifier} is available.
 */
export const NO_AUTH_USER_IDENTIFIER = '0';

/**
 * Type representing the {@link NO_AUTH_USER_IDENTIFIER} sentinel value.
 *
 * Useful for type narrowing when distinguishing between authenticated and unauthenticated user identifiers.
 *
 * @see {@link NO_AUTH_USER_IDENTIFIER}
 */
export type NoAuthUserIdentifier = typeof NO_AUTH_USER_IDENTIFIER;

/**
 * Normalizes an optional user identifier into a guaranteed {@link AuthUserIdentifier}.
 *
 * If the input is `undefined` or falsy, returns {@link NO_AUTH_USER_IDENTIFIER} as a safe default.
 * This ensures downstream consumers always receive a non-null identifier value.
 *
 * @param inputId - The user identifier to normalize, or `undefined`/`null`.
 * @returns The input identifier if truthy, otherwise {@link NO_AUTH_USER_IDENTIFIER}.
 *
 * @example
 * ```ts
 * authUserIdentifier('abc123'); // 'abc123'
 * authUserIdentifier(undefined); // '0'
 * ```
 */
export function authUserIdentifier(inputId: Maybe<AuthUserIdentifier>): AuthUserIdentifier {
  return inputId || NO_AUTH_USER_IDENTIFIER;
}
