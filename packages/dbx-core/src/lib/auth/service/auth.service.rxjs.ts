import { type AuthRole, type AuthRoleSet, type Maybe } from '@dereekb/util';
import { onFalseToTrue, onTrueToFalse, setContainsAllValuesFrom, setContainsNoValueFrom } from '@dereekb/rxjs';
import { map, type Observable, type OperatorFunction } from 'rxjs';

/**
 * Creates an observable that emits a `void` event each time the user transitions from
 * logged-out to logged-in (i.e., the input observable transitions from `false` to `true`).
 *
 * Useful for triggering side effects (e.g., loading user data) on login events.
 *
 * @param isLoggedInObs - An observable that emits `true` when the user is logged in and `false` otherwise.
 * @returns An observable that emits `void` on each false-to-true transition.
 *
 * @see {@link loggedOutObsFromIsLoggedIn} for the inverse (logout detection).
 */
export function loggedInObsFromIsLoggedIn(isLoggedInObs: Observable<boolean>): Observable<void> {
  return isLoggedInObs.pipe(
    onFalseToTrue(),
    map(() => undefined)
  );
}
/**
 * Creates an observable that emits a `void` event each time the user transitions from
 * logged-in to logged-out (i.e., the input observable transitions from `true` to `false`).
 *
 * Useful for triggering side effects (e.g., clearing cached data) on logout events.
 *
 * @param isLoggedInObs - An observable that emits `true` when the user is logged in and `false` otherwise.
 * @returns An observable that emits `void` on each true-to-false transition.
 *
 * @see {@link loggedInObsFromIsLoggedIn} for the inverse (login detection).
 */
export function loggedOutObsFromIsLoggedIn(isLoggedInObs: Observable<boolean>): Observable<void> {
  return isLoggedInObs.pipe(
    onTrueToFalse(),
    map(() => undefined)
  );
}

/**
 * RxJS operator that checks whether an {@link AuthRoleSet} contains **all** roles from the given observable set.
 *
 * Emits `true` when every role in the target set is present in the source role set, `false` otherwise.
 *
 * @param roles - Observable of the required roles to check against.
 * @returns An `OperatorFunction` that transforms an `AuthRoleSet` stream into a `boolean` stream.
 *
 * @see {@link authRolesSetContainsAnyRoleFrom} for matching any role.
 * @see {@link authRolesSetContainsNoRolesFrom} for matching no roles.
 */
export function authRolesSetContainsAllRolesFrom(roles: Observable<Maybe<Iterable<AuthRole>>>): OperatorFunction<AuthRoleSet, boolean> {
  return setContainsAllValuesFrom<AuthRole>(roles);
}

/**
 * RxJS operator that checks whether an {@link AuthRoleSet} contains **any** role from the given observable set.
 *
 * Emits `true` when at least one role in the target set is present in the source role set, `false` otherwise.
 *
 * @param roles - Observable of the target roles to check against.
 * @returns An `OperatorFunction` that transforms an `AuthRoleSet` stream into a `boolean` stream.
 *
 * @see {@link authRolesSetContainsAllRolesFrom} for matching all roles.
 * @see {@link authRolesSetContainsNoRolesFrom} for matching no roles.
 */
export function authRolesSetContainsAnyRoleFrom(roles: Observable<Maybe<Iterable<AuthRole>>>): OperatorFunction<AuthRoleSet, boolean> {
  return setContainsAllValuesFrom<AuthRole>(roles);
}

/**
 * RxJS operator that checks whether an {@link AuthRoleSet} contains **none** of the roles from the given observable set.
 *
 * Emits `true` when no role in the target set is present in the source role set, `false` otherwise.
 * Useful for hiding content from users with specific roles.
 *
 * @param roles - Observable of the roles to check for absence.
 * @returns An `OperatorFunction` that transforms an `AuthRoleSet` stream into a `boolean` stream.
 *
 * @see {@link authRolesSetContainsAllRolesFrom} for matching all roles.
 * @see {@link authRolesSetContainsAnyRoleFrom} for matching any role.
 */
export function authRolesSetContainsNoRolesFrom(roles: Observable<Maybe<Iterable<AuthRole>>>): OperatorFunction<AuthRoleSet, boolean> {
  return setContainsNoValueFrom<AuthRole>(roles);
}
