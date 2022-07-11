import { addToSetCopy, AuthClaims, AuthClaimsObject, AuthRoleClaimsService, AuthRoleSet, filterMaybeValues } from '@dereekb/util';
import { map, Observable, switchMap } from 'rxjs';
import { authUserStateFromFirebaseAuthServiceFunction, stateFromTokenForLoggedInUserFunction, StateFromTokenFunction } from './firebase.auth.rxjs';
import { AuthUserStateObsFunction, DbxFirebaseAuthService, DbxFirebaseAuthServiceDelegate, DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE } from './firebase.auth.service';

export interface AuthRolesObsWithClaimsServiceConfig<T extends AuthClaimsObject> extends Partial<Pick<DbxFirebaseAuthServiceDelegate, 'isAdminInAuthRoleSet' | 'authUserStateObs'>> {
  /**
   * (Optional) alternative to supplying authUserStateObs. Is passed to authUserStateFromFirebaseAuthService.
   */
  readonly stateForLoggedInUser?: AuthUserStateObsFunction;
  /**
   * (Optional) alternative to supplying authUserStateObs.
   */
  readonly stateForLoggedInUserToken?: StateFromTokenFunction;
  /**
   * Claims service to use for decoding.
   */
  readonly claimsService: AuthRoleClaimsService<T>;
  /**
   * Whether or not to also add the current AuthUserState value to decoded roles.
   */
  readonly addAuthUserStateToRoles?: boolean;
}

export function authRolesObsWithClaimsService<T extends AuthClaimsObject>(config: AuthRolesObsWithClaimsServiceConfig<T>): (dbxFirebaseAuthService: DbxFirebaseAuthService) => Observable<AuthRoleSet> {
  const { addAuthUserStateToRoles: addAuthUserState, claimsService } = config;

  return (dbxFirebaseAuthService: DbxFirebaseAuthService): Observable<AuthRoleSet> => {
    let obs = dbxFirebaseAuthService.idTokenResult$.pipe(map((x) => claimsService.toRoles(x.claims as AuthClaims<T>)));

    if (addAuthUserState) {
      obs = obs.pipe(switchMap((authRoleSet: AuthRoleSet) => dbxFirebaseAuthService.authUserState$.pipe(map((userState) => addToSetCopy(authRoleSet, [userState])))));
    }

    return obs;
  };
}

export type DefaultDbxFirebaseAuthServiceDelegateWithClaimsServiceConfig<T extends AuthClaimsObject> = AuthRolesObsWithClaimsServiceConfig<T>;

export function defaultDbxFirebaseAuthServiceDelegateWithClaimsService<T extends AuthClaimsObject>(config: DefaultDbxFirebaseAuthServiceDelegateWithClaimsServiceConfig<T>): DbxFirebaseAuthServiceDelegate {
  if (filterMaybeValues([config.stateForLoggedInUser, config.stateForLoggedInUserToken, config.authUserStateObs]).length > 1) {
    throw new Error('Cannot specify a combination of "stateForLoggedInUserToken", "stateForLoggedInUser" and "authUserStateObs". Must specify one at max.');
  }

  const authUserStateObs = config.authUserStateObs ?? authUserStateFromFirebaseAuthServiceFunction(config.stateForLoggedInUserToken ? stateFromTokenForLoggedInUserFunction(config.stateForLoggedInUserToken) : config.stateForLoggedInUser);

  return {
    authUserStateObs,
    isAdminInAuthRoleSet: config.isAdminInAuthRoleSet ?? DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE.isAdminInAuthRoleSet,
    authRolesObs: authRolesObsWithClaimsService(config),
    isOnboarded: DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE.isOnboarded,
    authRoleClaimsService: config.claimsService as unknown as AuthRoleClaimsService<AuthClaimsObject>
  };
}
