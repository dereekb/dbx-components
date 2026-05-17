import { type Maybe } from '@dereekb/util';
import { fullAccessRoleMap, type GrantedRoleMap, noAccessRoleMap } from './role';

/**
 * Container that associates a model's data, the context in which roles were evaluated, and the resulting granted role map.
 *
 * Returned by permission services after evaluating what roles a given context has for a specific model.
 */
export interface ContextGrantedModelRoles<O, C = unknown, R extends string = string> {
  readonly data: Maybe<O>;
  readonly context: C;
  readonly roleMap: GrantedRoleMap<R>;
}

/**
 * Creates a {@link ContextGrantedModelRoles} with a no-access role map, indicating the context has no permissions.
 *
 * @param context - The context that was evaluated.
 * @param data - Optional model data, if it was loaded.
 * @returns A ContextGrantedModelRoles with no access.
 *
 * @example
 * ```typescript
 * const result = noAccessContextGrantedModelRoles(userContext);
 * // result.roleMap contains the no-access marker
 * ```
 */
export function noAccessContextGrantedModelRoles<O, C = unknown, R extends string = string>(context: C, data?: Maybe<O>): ContextGrantedModelRoles<O, C, R> {
  return contextGrantedModelRoles(context, data, noAccessRoleMap());
}

/**
 * Creates a {@link ContextGrantedModelRoles} with a full-access role map, granting all permissions.
 *
 * @param context - The context that was evaluated.
 * @param data - Optional model data.
 * @returns A ContextGrantedModelRoles with full access.
 *
 * @example
 * ```typescript
 * const result = fullAccessGrantedModelRoles(adminContext, modelData);
 * // result.roleMap contains the full-access marker
 * ```
 */
export function fullAccessGrantedModelRoles<O, C = unknown, R extends string = string>(context: C, data?: Maybe<O>): ContextGrantedModelRoles<O, C, R> {
  return contextGrantedModelRoles(context, data, fullAccessRoleMap());
}

/**
 * Creates a {@link ContextGrantedModelRoles} with the given role map, data, and context.
 *
 * @param context - The context that was evaluated.
 * @param data - The model data, if loaded.
 * @param roles - The granted role map.
 * @returns A ContextGrantedModelRoles combining all inputs.
 */
export function contextGrantedModelRoles<O, C = unknown, R extends string = string>(context: C, data: Maybe<O>, roles: GrantedRoleMap<R>): ContextGrantedModelRoles<O, C, R> {
  return {
    data,
    context,
    roleMap: roles
  };
}
