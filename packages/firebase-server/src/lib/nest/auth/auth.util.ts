import { FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY, type UserRelated } from '@dereekb/firebase';
import { type ArrayOrValue, type AuthRole, containsAllValues, asArray, type ErrorMessageOrPartialServerError, type Maybe } from '@dereekb/util';
import { forbiddenError } from '../../function/error';
import { type NestContextCallableRequestWithOptionalAuth } from '../function/nest';
import { type AbstractFirebaseNestContext } from '../nest.provider';

/**
 * Asserts that the caller has admin privileges in the request.
 *
 * @param request - The callable request to check for admin privileges.
 * @param messageOrError - Optional custom error message or partial server error for the forbidden response.
 * @throws {HttpsError} Throws forbidden (403) if the caller is not an admin.
 */
export function assertIsAdminInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>, messageOrError?: Maybe<ErrorMessageOrPartialServerError>) {
  if (!isAdminInRequest(request)) {
    throw forbiddenError(messageOrError);
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
 * @param messageOrError - Optional custom error message or partial server error for the forbidden response.
 * @returns The resolved target UID (from request data or auth).
 * @throws {HttpsError} Throws forbidden (403) if the caller is not authorized.
 */
export function assertIsAdminOrTargetUserInRequestData<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I extends Partial<UserRelated> = Partial<UserRelated>>(request: NestContextCallableRequestWithOptionalAuth<N, I>, requireUid?: boolean, messageOrError?: Maybe<ErrorMessageOrPartialServerError>) {
  if (!isAdminOrTargetUserInRequestData(request, requireUid)) {
    throw forbiddenError(messageOrError);
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
 * @param messageOrError - Optional custom error message or partial server error for the forbidden response.
 * @throws {HttpsError} Throws forbidden (403) if ToS has not been signed.
 */
export function assertHasSignedTosInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>, messageOrError?: Maybe<ErrorMessageOrPartialServerError>) {
  if (!hasSignedTosInRequest(request)) {
    throw forbiddenError(
      messageOrError ?? {
        message: 'ToS has not been signed.'
      }
    );
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
 * @param messageOrError - Optional custom error message or partial server error for the forbidden response.
 * @throws {HttpsError} Throws forbidden (403) if any required role is missing.
 */
export function assertHasRolesInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithOptionalAuth<N, I>, authRoles: ArrayOrValue<AuthRole>, messageOrError?: Maybe<ErrorMessageOrPartialServerError>) {
  if (!hasAuthRolesInRequest(request, authRoles)) {
    throw forbiddenError(
      messageOrError ?? {
        message: 'Missing required auth roles.',
        data: {
          roles: asArray(authRoles)
        }
      }
    );
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

// MARK: Admin-Only Value
/**
 * Configuration for {@link resolveAdminOnlyValue}.
 *
 * @typeParam T - The value type being resolved.
 */
export interface ResolveAdminOnlyValueConfig<N extends AbstractFirebaseNestContext<any, any>, I, T> {
  /**
   * The callable request to check for admin privileges.
   */
  readonly request: NestContextCallableRequestWithOptionalAuth<N, I>;
  /**
   * The raw input value from the request data. May be undefined if the caller didn't provide it.
   */
  readonly value?: Maybe<T>;
  /**
   * The default value to use when {@link value} is undefined and the caller is not an admin.
   *
   * Admins receive no default (undefined) so the query has no restriction.
   */
  readonly defaultValue?: Maybe<T>;
  /**
   * Predicate that returns true if the given resolved value is restricted to admins only.
   *
   * When this returns true and the caller is not an admin, a forbidden error is thrown.
   *
   * @param value - The resolved value to check.
   * @returns True if the value requires admin privileges.
   */
  readonly isAdminOnlyValue: (value: Maybe<T>) => boolean;
  /**
   * Optional error message or partial server error to include in the forbidden error.
   */
  readonly messageOrError?: ErrorMessageOrPartialServerError;
}

/**
 * Resolves a request parameter value with admin-aware defaulting and access control.
 *
 * For non-admins:
 * - If the caller didn't provide a value, the {@link ResolveAdminOnlyValueConfig.defaultValue} is used.
 * - If the resolved value is admin-only (per the predicate), a forbidden error is thrown.
 *
 * For admins:
 * - If the caller didn't provide a value, undefined is returned (no restriction).
 * - Any value is allowed.
 *
 * @param config - Configuration specifying the request, value, defaults, and admin-only predicate.
 * @returns The resolved value, or undefined for admins who didn't provide a value.
 * @throws {HttpsError} Throws forbidden (403) if a non-admin attempts to use an admin-only value.
 *
 * @example
 * ```typescript
 * // Non-admins can only query published=true; admins can query anything
 * const published = resolveAdminOnlyValue({
 *   request,
 *   value: data.published,
 *   defaultValue: true,
 *   isAdminOnlyValue: (v) => v !== true,
 *   messageOrError: { message: 'Users can only search published entries.' }
 * });
 * ```
 */
export function resolveAdminOnlyValue<N extends AbstractFirebaseNestContext<any, any>, I, T>(config: ResolveAdminOnlyValueConfig<N, I, T>): Maybe<T> {
  const { request, value, defaultValue, isAdminOnlyValue, messageOrError } = config;
  const isAdmin = isAdminInRequest(request);

  // Admins get no default (undefined = no filter); non-admins get the safe default
  const resolvedValue: Maybe<T> = value ?? (isAdmin ? undefined : defaultValue);

  // Assert non-admins aren't using admin-only values
  if (resolvedValue != null && isAdminOnlyValue(resolvedValue) && !isAdmin) {
    throw forbiddenError(messageOrError);
  }

  return resolvedValue;
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
