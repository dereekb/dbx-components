import { Maybe } from "@dereekb/util";


/**
 * An application user state.
 * 
 * Generic states that define the current state of the user:
 * - none: the user is not logged in
 * - anon: the user is logged in as an anonymous account
 * - error: there was an error loading the correct user state
 * - new: the user has a full account but has not completed onboarding/setup
 * - user: the user has a full account and has completed setup
 */
export type AuthUserState = 'none' | 'anon' | 'new' | 'user' | 'error';

/**
 * Arbitrary identifier used to differentiate users.
 */
export type AuthUserIdentifier = string;

export const NO_AUTH_USER_IDENTIFIER = '0';

/**
 * AuthUserIdentifier used to indicate that the user cannot be uniquely identifier.
 */
export type NoAuthUserIdentifier = typeof NO_AUTH_USER_IDENTIFIER;


/**
 * Creates an AuthUserIdentifier from the input. If the input is undefined, returns the NoAuthUserIdentifier.
 * 
 * @param inputId 
 * @returns 
 */
export function authUserIdentifier(inputId: Maybe<AuthUserIdentifier>): AuthUserIdentifier {
  return (inputId) ? inputId : NO_AUTH_USER_IDENTIFIER;
}
