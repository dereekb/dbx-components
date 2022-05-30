import { addToSetCopy, AuthClaims, AuthClaimsObject, AuthRoleClaimsService, AuthRoleSet } from '@dereekb/util';
import { map, Observable, switchMap } from 'rxjs';
import { DbxFirebaseAuthService, DbxFirebaseAuthServiceDelegate, DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE } from './firebase.auth.service';

export interface AuthRolesObsWithClaimsServiceConfig<T extends AuthClaimsObject> {
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

export interface DefaultDbxFirebaseAuthServiceDelegateWithClaimsServiceConfig<T extends AuthClaimsObject> extends AuthRolesObsWithClaimsServiceConfig<T> {}

export function defaultDbxFirebaseAuthServiceDelegateWithClaimsService<T extends AuthClaimsObject>(config: DefaultDbxFirebaseAuthServiceDelegateWithClaimsServiceConfig<T>): DbxFirebaseAuthServiceDelegate {
  return {
    authUserStateObs: DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE.authUserStateObs,
    authRolesObs: authRolesObsWithClaimsService(config),
    isOnboarded: DEFAULT_DBX_FIREBASE_AUTH_SERVICE_DELEGATE.isOnboarded
  };
}
