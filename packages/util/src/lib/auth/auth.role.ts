import { setContainsAllValues } from '../set/set';
import { type Maybe } from '../value/maybe.type';

/**
 * An application role.
 *
 * Is used in the client to decide which content a user can view.
 *
 * Roles should always be lowercase.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-util:auth
 */
export type AuthRole = string;

/**
 * A set of auth roles for a user.
 */
export type AuthRoleSet = Set<AuthRole>;

/**
 * Auth role for an account that has signed the terms of service.
 */
export const AUTH_TOS_SIGNED_ROLE = 'tos';

/**
 * Auth role for an account that has been onboarded.
 */
export const AUTH_ONBOARDED_ROLE = 'onboarded';

/**
 * Auth role for a full admin. Is allowed into all sections of the app.
 */
export const AUTH_ADMIN_ROLE = 'admin';

/**
 * Auth role for a general user. Is allowed into the app and is logged in.
 */
export const AUTH_USER_ROLE = 'user';

/**
 * Checks if an AuthRoleSet contains all of the specified roles.
 *
 * @param authRolesSet - Granted roles that must satisfy the required-roles check.
 * @param roles - Roles that must all be present; nullish or empty is treated as vacuously true.
 * @returns True when every required role appears in the granted set; otherwise false.
 */
export function authRolesSetHasRoles(authRolesSet: AuthRoleSet, roles: Maybe<Iterable<AuthRole>>) {
  return setContainsAllValues(authRolesSet, roles ?? []);
}
