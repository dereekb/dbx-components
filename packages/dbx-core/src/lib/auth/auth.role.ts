
/**
 * An application role.
 * 
 * Is used in the client to decide which content a user can view.
 * 
 * Roles should always be lowercase.
 */
export type AuthRole = string;

/**
 * A set of auth roles for a user.
 */
export type AuthRoleSet = Set<AuthRole>;

/**
 * Auth role for a full admin. Is allowed into all sections of the app.
 */
export const AUTH_APP_ADMIN_ROLE = 'admin';

/**
 * Auth role for a general user. Is allowed into the app and is logged in.
 */
export const AUTH_APP_USER_ROLE = 'user';
