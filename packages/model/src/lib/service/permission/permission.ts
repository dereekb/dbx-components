import { Maybe } from '@dereekb/util';
import { GrantedRoleMap, noAccessRolesMap } from './role';

/**
 * Object that contains granted roles, a model, and the context the roles were granted in.
 */
export interface ContextGrantedModelRoles<O, C = unknown, R extends string = string> {
  readonly data: Maybe<O>;
  readonly context: C;
  readonly roles: GrantedRoleMap<R>;
}

export function emptyContextGrantedModelRoles<O, C = unknown, R extends string = string>(context: C): ContextGrantedModelRoles<O, C, R> {
  return {
    data: undefined,
    context,
    roles: noAccessRolesMap()
  };
}

export function contextGrantedModelRoles<O, C = unknown, R extends string = string>(data: Maybe<O>, context: C, roles: GrantedRoleMap<R>): ContextGrantedModelRoles<O, C, R> {
  return {
    data,
    context,
    roles
  };
}
