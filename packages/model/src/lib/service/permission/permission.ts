import { type Maybe } from '@dereekb/util';
import { fullAccessRoleMap, type GrantedRoleMap, noAccessRoleMap } from './role';

/**
 * Object that contains granted roles, a model, and the context the roles were granted in.
 */
export interface ContextGrantedModelRoles<O, C = unknown, R extends string = string> {
  readonly data: Maybe<O>;
  readonly context: C;
  readonly roleMap: GrantedRoleMap<R>;
}

export function noAccessContextGrantedModelRoles<O, C = unknown, R extends string = string>(context: C, data?: Maybe<O>): ContextGrantedModelRoles<O, C, R> {
  return contextGrantedModelRoles(context, data, noAccessRoleMap());
}

export function fullAccessGrantedModelRoles<O, C = unknown, R extends string = string>(context: C, data?: Maybe<O>): ContextGrantedModelRoles<O, C, R> {
  return contextGrantedModelRoles(context, data, fullAccessRoleMap());
}

export function contextGrantedModelRoles<O, C = unknown, R extends string = string>(context: C, data: Maybe<O>, roles: GrantedRoleMap<R>): ContextGrantedModelRoles<O, C, R> {
  return {
    data,
    context,
    roleMap: roles
  };
}
