import { FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY, type UserRelated } from '@dereekb/firebase';
import { type ArrayOrValue, type AuthRole, containsAllValues, asArray } from '@dereekb/util';
import { forbiddenError } from '../../function/error';
import { type NestContextCallableRequestWithAuth } from '../function/nest';
import { type AbstractFirebaseNestContext } from '../nest.provider';

export function assertIsAdminInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithAuth<N, I>) {
  if (!isAdminInRequest(request)) {
    throw forbiddenError();
  }
}

export function isAdminInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithAuth<N, I>) {
  return request.nest.authService.context(request).isAdmin;
}

export function assertIsAdminOrTargetUserInRequestData<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I extends Partial<UserRelated> = Partial<UserRelated>>(request: NestContextCallableRequestWithAuth<N, I>, requireUid?: boolean) {
  if (!isAdminOrTargetUserInRequestData(request, requireUid)) {
    throw forbiddenError();
  }

  return request.data.uid ?? request.auth.uid;
}

export function isAdminOrTargetUserInRequestData<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I extends Partial<UserRelated> = Partial<UserRelated>>(request: NestContextCallableRequestWithAuth<N, I>, requireUid = false) {
  const uid = request.data.uid;
  const authUid = request.auth.uid;

  let isAdminOrTargetUser = true;

  if ((requireUid && uid == null) || (uid != null && uid !== authUid)) {
    isAdminOrTargetUser = request.nest.authService.context(request).isAdmin;
  }

  return isAdminOrTargetUser;
}

export function assertHasSignedTosInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithAuth<N, I>) {
  if (!hasSignedTosInRequest(request)) {
    throw forbiddenError({
      message: 'ToS has not been signed.'
    });
  }
}

export function hasSignedTosInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithAuth<N, I>) {
  return request.nest.authService.context(request).hasSignedTos;
}

export function assertHasRolesInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithAuth<N, I>, authRoles: ArrayOrValue<AuthRole>) {
  if (!hasAuthRolesInRequest(request, authRoles)) {
    throw forbiddenError({
      message: 'Missing required auth roles.',
      data: {
        roles: asArray(authRoles)
      }
    });
  }
}

export function hasAuthRolesInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithAuth<N, I>, authRoles: ArrayOrValue<AuthRole>) {
  return containsAllValues(request.nest.authService.context(request).authRoles, authRoles);
}

/**
 * Returns true if the claims have a FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY claims value, indicating they are a newly invited user.
 *
 * This may be used to filter out new users that were not invited from finishing their onboarding.
 *
 * @param request
 */
export function hasNewUserSetupPasswordInRequest<N extends AbstractFirebaseNestContext<any, any> = AbstractFirebaseNestContext<any, any>, I = unknown>(request: NestContextCallableRequestWithAuth<N, I>) {
  const claims = request.nest.authService.context(request).claims;
  return claims[FIREBASE_SERVER_AUTH_CLAIMS_SETUP_PASSWORD_KEY] != null;
}
