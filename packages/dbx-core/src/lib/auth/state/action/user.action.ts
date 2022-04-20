import { createAction, props } from '@ngrx/store';
import { AuthRole } from '../../auth.role';
import { AuthUserIdentifier, AuthUserState } from '../../auth.user';

/**
 * Sets the user's identifier in the auth.
 */
export const setUserIdentifier = createAction('[App/Auth] Set User Identifier',
  props<{ id: AuthUserIdentifier }>()
);

/**
 * Sets the user's state in the auth.
 */
export const setUserState = createAction('[App/Auth] Set User State',
  props<{ state: AuthUserState }>()
);

/**
 * Sets the user's roles in the auth.
 */
export const setUserRoles = createAction('[App/Auth] Set User Roles',
  props<{ roles: AuthRole[] }>()
);

/**
 * Sets the user's onboarding state.
 */
export const setUserIsOnboarded = createAction('[App/Auth] Set User Is Onboarded',
  props<{ isOnboarded: boolean }>()
);
