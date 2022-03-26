import { AuthRole, AuthRoleSet } from "../auth.role";
import { Maybe, setContainsAllValues } from '@dereekb/util';

export function authRolesSetHasRoles(authRolesSet: AuthRoleSet, roles: Maybe<Iterable<AuthRole>>) {
  return setContainsAllValues(authRolesSet, roles ?? [])
}
