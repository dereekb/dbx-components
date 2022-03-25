

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
