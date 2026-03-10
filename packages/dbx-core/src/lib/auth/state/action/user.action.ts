import { createAction, props } from '@ngrx/store';
import { type AuthRole } from '@dereekb/util';
import { type AuthUserIdentifier, type AuthUserState } from '../../auth.user';

/**
 * NgRx action that updates the authenticated user's identifier in the store.
 *
 * Dispatched by {@link DbxAppAuthEffects.setUserIdentifier} whenever the
 * {@link DbxAuthService.userIdentifier$} emits a new value.
 *
 * @see {@link DbxAppAuthStateUser.userId}
 */
export const setUserIdentifier = createAction('[App/Auth] Set User Identifier', props<{ id: AuthUserIdentifier }>());

/**
 * NgRx action that updates the authenticated user's {@link AuthUserState} in the store.
 *
 * Dispatched by {@link DbxAppAuthEffects.setUserState} whenever the
 * {@link DbxAuthService.authUserState$} emits a new value. The state determines
 * the user's lifecycle stage (none, anon, new, user, or error).
 *
 * @see {@link AuthUserState}
 * @see {@link DbxAppAuthStateUser.userState}
 */
export const setUserState = createAction('[App/Auth] Set User State', props<{ state: AuthUserState }>());

/**
 * NgRx action that updates the authenticated user's auth roles in the store.
 *
 * Dispatched by {@link DbxAppAuthEffects.setUserRoles} whenever the
 * {@link DbxAuthService.authRoles$} emits a new role set. Roles are stored
 * as an array in the NgRx state.
 *
 * @see {@link DbxAppAuthStateUser.userRoles}
 */
export const setUserRoles = createAction('[App/Auth] Set User Roles', props<{ roles: AuthRole[] }>());

/**
 * NgRx action that updates the authenticated user's onboarding status in the store.
 *
 * Dispatched by {@link DbxAppAuthEffects.setUserIsOnboarded} whenever the
 * {@link DbxAuthService.isOnboarded$} emits a new value.
 *
 * @see {@link DbxAppAuthStateUser.isOnboarded}
 */
export const setUserIsOnboarded = createAction('[App/Auth] Set User Is Onboarded', props<{ isOnboarded: boolean }>());
