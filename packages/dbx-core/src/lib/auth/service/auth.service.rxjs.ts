import { AuthRole, AuthRoleSet, Maybe } from '@dereekb/util';
import { onFalseToTrue, onTrueToFalse, setContainsAllValuesFrom, setContainsNoValueFrom } from '@dereekb/rxjs';
import { map, Observable, OperatorFunction } from 'rxjs';

/**
 * Convenience operator that emits events when the input observable goes from false to true.
 *
 * @param isLoggedInObs
 * @returns
 */
export function loggedInObsFromIsLoggedIn(isLoggedInObs: Observable<boolean>): Observable<void> {
  return isLoggedInObs.pipe(
    onFalseToTrue(),
    map(() => undefined)
  );
}
/**
 * Convenience operator that emits events when the input observable goes from true to false.
 *
 * @param isLoggedInObs
 * @returns
 */
export function loggedOutObsFromIsLoggedIn(isLoggedInObs: Observable<boolean>): Observable<void> {
  return isLoggedInObs.pipe(
    onTrueToFalse(),
    map(() => undefined)
  );
}

export function authRolesSetContainsAllRolesFrom(roles: Observable<Maybe<Iterable<AuthRole>>>): OperatorFunction<AuthRoleSet, boolean> {
  return setContainsAllValuesFrom<AuthRole>(roles);
}

export function authRolesSetContainsAnyRoleFrom(roles: Observable<Maybe<Iterable<AuthRole>>>): OperatorFunction<AuthRoleSet, boolean> {
  return setContainsAllValuesFrom<AuthRole>(roles);
}

export function authRolesSetContainsNoRolesFrom(roles: Observable<Maybe<Iterable<AuthRole>>>): OperatorFunction<AuthRoleSet, boolean> {
  return setContainsNoValueFrom<AuthRole>(roles);
}
