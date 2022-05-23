import { NO_AUTH_USER_IDENTIFIER, AuthUserIdentifier, AuthUserState } from '../../auth.user';
import { createReducer, on } from '@ngrx/store';
import { DbxAppAuthActions, DbxAppAuthUserActions } from '../action';
import { AuthRole } from '@dereekb/util';

export const dbxAppAuthUserFeatureKey = 'user';

export interface DbxAppAuthStateUser {
  userId: AuthUserIdentifier;
  isOnboarded: boolean;
  userState: AuthUserState;
  userRoles: AuthRole[];
}

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
  on(DbxAppAuthUserActions.setUserRoles, (state, { roles: userRoles }) => ({ ...state, userRoles: Array.from(userRoles) }))
);
