import { createAction } from '@ngrx/store';

/**
 * Action for when the user has logged in.
 */
export const loggedIn = createAction('[App/Auth] Auth Logged In');

/**
 * Action for when the user has logged out.
 */
export const loggedOut = createAction('[App/Auth] Auth Logged Out');

/**
 * Action to log the user out.
 */
export const logout = createAction('[App/Auth] Auth Logout');
