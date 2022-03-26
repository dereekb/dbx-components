import { AuthRole, AuthRoleSet } from '../auth.role';
import { Maybe } from '@dereekb/util';
import { onTrueToFalse, setContainsAllValuesFrom } from '@dereekb/rxjs';
import { map, Observable, OperatorFunction } from 'rxjs';

/**
 * Convenience operator that emits events when the input observable goes from true to false.
 * 
 * @param isLoggedInObs 
 * @returns 
 */
export function signedOutEventFromIsLoggedIn(isLoggedInObs: Observable<boolean>): Observable<void> {
  return isLoggedInObs.pipe(onTrueToFalse(), map(_ => undefined));
}

export function authRolesSetContainsAllRolesFrom(roles: Observable<Maybe<Iterable<AuthRole>>>): OperatorFunction<AuthRoleSet, boolean> {
  return setContainsAllValuesFrom<AuthRole>(roles);
}

export function authRolesSetContainsAnyRoleFrom(roles: Observable<Maybe<Iterable<AuthRole>>>): OperatorFunction<AuthRoleSet, boolean> {
  return setContainsAllValuesFrom<AuthRole>(roles);
}
