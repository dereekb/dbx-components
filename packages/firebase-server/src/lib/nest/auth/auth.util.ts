import { FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY, type UserRelated } from '@dereekb/firebase';
import { type ArrayOrValue, type AuthRole, containsAllValues, asArray } from '@dereekb/util';
import { forbiddenError } from '../../function/error';
import { type NestContextCallableRequestWithOptionalAuth } from '../function/nest';
import { type AbstractFirebaseNestContext } from '../nest.provider';

/**
 * Asserts that the caller has admin privileges in the request.
 *
 * @param request - The callable request to check for admin privileges.
 * @throws {HttpsError} Throws forbidden (403) if the caller is not an admin.
 */
export function assertIsAdminInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>) {
  if (!isAdminInRequest(request)) {
    throw forbiddenError();
  }
}

/**
 * Checks whether the caller has admin privileges in the request.
 *
 * @param request - The callable request to check for admin privileges.
 * @returns True if the caller has admin privileges.
 */
export function isAdminInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>) {
  return request.nest.authService.context(request).isAdmin;
}

/**
 * Asserts that the caller is either an admin or is targeting their own user record.
 *
 * If the request data contains a `uid` that differs from the caller's auth UID, admin status is required.
 *
 * @param request - The callable request containing the target UID.
 * @param requireUid - If true, a UID must be present in the request data.
 * @returns The resolved target UID (from request data or auth).
 * @throws {HttpsError} Throws forbidden (403) if the caller is not authorized.
 */
export function assertIsAdminOrTargetUserInRequestData<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I extends Partial<UserRelated> = Partial<UserRelated>>(request: NestContextCallableRequestWithOptionalAuth<N, I>, requireUid?: boolean) {
  if (!isAdminOrTargetUserInRequestData(request, requireUid)) {
    throw forbiddenError();
  }

  return request.data.uid ?? request.auth?.uid;
}

/**
 * Checks whether the caller is an admin or is targeting their own user record in the request data.
 *
 * @param request - The callable request containing the target UID.
 * @param requireUid - If true, a UID must be present in the request data.
 * @returns True if the caller is an admin or is targeting their own user record.
 */
export function isAdminOrTargetUserInRequestData<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I extends Partial<UserRelated> = Partial<UserRelated>>(request: NestContextCallableRequestWithOptionalAuth<N, I>, requireUid = false) {
  const uid = request.data.uid;
  const authUid = request.auth?.uid;

  let isAdminOrTargetUser = true;

  if ((requireUid && uid == null) || (uid != null && uid !== authUid)) {
    isAdminOrTargetUser = request.nest.authService.context(request).isAdmin;
  }

  return isAdminOrTargetUser;
}

/**
 * Asserts that the caller has signed the Terms of Service.
 *
 * @param request - The callable request to check for ToS status.
 * @throws {HttpsError} Throws forbidden (403) if ToS has not been signed.
 */
export function assertHasSignedTosInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>) {
  if (!hasSignedTosInRequest(request)) {
    throw forbiddenError({
      message: 'ToS has not been signed.'
    });
  }
}

/**
 * Checks whether the caller has signed the Terms of Service.
 *
 * @param request - The callable request to check for ToS status.
 * @returns True if the caller has signed the Terms of Service.
 */
export function hasSignedTosInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>) {
  return request.nest.authService.context(request).hasSignedTos;
}

/**
 * Asserts that the caller has all of the specified auth roles.
 *
 * @param request - The callable request to check for auth roles.
 * @param authRoles - One or more roles that must all be present.
 * @throws {HttpsError} Throws forbidden (403) if any required role is missing.
 */
export function assertHasRolesInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>, authRoles: ArrayOrValue<AuthRole>) {
  if (!hasAuthRolesInRequest(request, authRoles)) {
    throw forbiddenError({
      message: 'Missing required auth roles.',
      data: {
        roles: asArray(authRoles)
      }
    });
  }
}

/**
 * Checks whether the caller has all of the specified auth roles.
 *
 * @param request - The callable request to check for auth roles.
 * @param authRoles - One or more roles that must all be present.
 * @returns True if the caller has all of the specified auth roles.
 */
export function hasAuthRolesInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>, authRoles: ArrayOrValue<AuthRole>) {
  return containsAllValues(request.nest.authService.context(request).authRoles, authRoles);
}

/**
 * Returns true if the claims have a FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY claims value, indicating they are a newly invited user.
 *
 * This may be used to filter out new users that were not invited from finishing their onboarding.
 *
 * @param request - The callable request to check for setup password claims.
 * @returns True if the claims contain a setup password key.
 */
export function hasNewUserSetupPasswordInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>) {
  const claims = request.nest.authService.context(request).claims;

  return claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY] != null;
}
