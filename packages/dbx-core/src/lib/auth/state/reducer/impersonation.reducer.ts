import { type Maybe } from '@dereekb/util';
import { createReducer, on } from '@ngrx/store';
import { DbxAppAuthActions, DbxAppAuthImpersonationActions } from '../action';
import { type AuthUserIdentifier } from '../../auth.user';

/**
 * NgRx feature key for the impersonation sub-state within the auth feature.
 */
export const DBX_APP_AUTH_IMPERSONATION_FEATURE_KEY = 'impersonation';

/**
 * Shape of the impersonation ("view as another user") state stored in the NgRx store.
 *
 * This slice is always present in the `app.auth` feature (it stays empty when impersonation is unused),
 * and is fed by the opt-in `DbxAppAuthImpersonationEffects` bridge mirroring {@link DbxAuthImpersonationService}.
 *
 * @see {@link DbxAppAuthStateService.authStateImpersonation$} for accessing this state reactively.
 */
export interface DbxAppAuthStateImpersonation {
  /**
   * Identifier of the user currently being impersonated, or null/undefined when not impersonating.
   */
  impersonatedUserId: Maybe<AuthUserIdentifier>;
}

/**
 * Initial state for the impersonation reducer: not impersonating anyone.
 */
export const INITIAL_STATE: DbxAppAuthStateImpersonation = {
  impersonatedUserId: undefined
};

export const reducer = createReducer(
  INITIAL_STATE,
  on(DbxAppAuthActions.loggedOut, () => ({ ...INITIAL_STATE })),
  on(DbxAppAuthImpersonationActions.startedImpersonating, (state, { userId }) => ({ ...state, impersonatedUserId: userId })),
  on(DbxAppAuthImpersonationActions.stoppedImpersonating, (state) => ({ ...state, impersonatedUserId: undefined }))
);
