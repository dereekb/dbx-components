import { createAction } from '@ngrx/store';

/**
 * NgRx action dispatched when the user has successfully logged in.
 *
 * This is an event action (past tense) triggered by {@link DbxAppAuthEffects} in response
 * to the {@link DbxAuthService.onLogIn$} observable. It signals that authentication has been
 * established and downstream effects (e.g., navigation to the app) can proceed.
 *
 * @see {@link loggedOut} for the corresponding logout event.
 * @see {@link DbxAppAuthEffects.emitLoggedIn}
 */
export const loggedIn = createAction('[App/Auth] Auth Logged In');

/**
 * NgRx action dispatched when the user has logged out.
 *
 * This is an event action (past tense) triggered by {@link DbxAppAuthEffects} in response
 * to the {@link DbxAuthService.onLogOut$} observable. When dispatched, the user reducer
 * resets the auth state to its initial values (no user, no roles, not onboarded).
 *
 * @see {@link loggedIn} for the corresponding login event.
 * @see {@link logout} for the imperative command action to initiate logout.
 */
export const loggedOut = createAction('[App/Auth] Auth Logged Out');

/**
 * NgRx action that commands the application to perform a logout.
 *
 * This is a command action (imperative) that, when dispatched, triggers {@link DbxAppAuthEffects.forwardLogoutToAuthService}
 * to call {@link DbxAuthService.logOut}. Use this action to initiate logout from anywhere in the application
 * via the NgRx store rather than calling the auth service directly.
 *
 * @see {@link loggedOut} for the event action dispatched after logout completes.
 */
export const logout = createAction('[App/Auth] Auth Logout');
