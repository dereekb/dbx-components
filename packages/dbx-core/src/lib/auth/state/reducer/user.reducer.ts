import { NO_AUTH_USER_IDENTIFIER, type AuthUserIdentifier, type AuthUserState } from '../../auth.user';
import { createReducer, on } from '@ngrx/store';
import { DbxAppAuthActions, DbxAppAuthUserActions } from '../action';
import { type AuthRole } from '@dereekb/util';

/**
 * NgRx feature key for the auth user sub-state within the auth feature.
 */
export const DBX_APP_AUTH_USER_FEATURE_KEY = 'user';

/**
 * Shape of the authenticated user's state stored in the NgRx store.
 *
 * This interface represents the complete snapshot of user authentication information
 * managed by the auth reducer, including identity, lifecycle state, authorization roles,
 * and onboarding status.
 *
 * @example
 * ```ts
 * // Selecting from the store via DbxAppAuthStateService:
 * const user$ = authStateService.authStateUser$;
 * user$.subscribe((user: DbxAppAuthStateUser) => {
 *   console.log(user.userId, user.userState, user.userRoles);
 * });
 * ```
 *
 * @see {@link DbxAppAuthStateService} for accessing this state reactively.
 * @see {@link AuthUserState} for possible values of `userState`.
 */
export interface DbxAppAuthStateUser {
  /**
   * Unique identifier for the authenticated user. Defaults to {@link NO_AUTH_USER_IDENTIFIER} when no user is logged in.
   */
  userId: AuthUserIdentifier;
  /**
   * Whether the user has completed the onboarding/setup flow.
   */
  isOnboarded: boolean;
  /**
   * Current authentication lifecycle state of the user.
   */
  userState: AuthUserState;
  /**
   * Array of authorization roles assigned to the current user.
   */
  userRoles: AuthRole[];
}

/**
 * Initial state for the auth user reducer.
 *
 * Represents a fully unauthenticated state: no user identifier, not onboarded,
 * in the `'none'` auth state, with no roles assigned.
 */
export const initialState: DbxAppAuthStateUser = {
  userId: NO_AUTH_USER_IDENTIFIER,
  isOnboarded: false,
  userState: 'none',
  userRoles: []
};

export const reducer = createReducer(
  initialState,
  on(DbxAppAuthActions.loggedOut, () => ({ ...initialState })),
  on(DbxAppAuthUserActions.setUserIdentifier, (state, { id: userId }) => ({ ...state, userId })),
  on(DbxAppAuthUserActions.setUserIsOnboarded, (state, { isOnboarded }) => ({ ...state, isOnboarded })),
  on(DbxAppAuthUserActions.setUserState, (state, { state: userState }) => ({ ...state, userState })),
  on(DbxAppAuthUserActions.setUserRoles, (state, { roles: userRoles }) => ({ ...state, userRoles: [...userRoles] }))
);
