import { CallableContextWithAuthData, AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext } from "@dereekb/firebase-server";
import { AuthClaims, AuthClaimsUpdate, AuthRoleSet, AuthRoleClaimsFactoryConfig, authRoleClaimsService, AUTH_ADMIN_ROLE } from "@dereekb/util";

export type APP_CODE_PREFIXApiAuthClaims = {
  /**
   * Admin role
   */
  a?: number;
}

export class APP_CODE_PREFIXApiFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<APP_CODE_PREFIXApiAuthService> {

}

export class APP_CODE_PREFIXApiFirebaseServerAuthContext extends AbstractFirebaseServerAuthContext<APP_CODE_PREFIXApiFirebaseServerAuthContext, APP_CODE_PREFIXApiFirebaseServerAuthUserContext, APP_CODE_PREFIXApiAuthService>  {

}

export class APP_CODE_PREFIXApiAuthService extends AbstractFirebaseServerAuthService<APP_CODE_PREFIXApiFirebaseServerAuthUserContext, APP_CODE_PREFIXApiFirebaseServerAuthContext> {

  static readonly APP_CODE_PREFIX_UPPER_API_CLAIMS_CONFIG: AuthRoleClaimsFactoryConfig<APP_CODE_PREFIXApiAuthClaims> = {
    a: {
      roles: AUTH_ADMIN_ROLE
    }
  };

  static readonly APP_CODE_PREFIX_UPPER_API_CLAIMS_SERVICE = authRoleClaimsService(APP_CODE_PREFIXApiAuthService.APP_CODE_PREFIX_UPPER_API_CLAIMS_CONFIG);

  protected _context(context: CallableContextWithAuthData): APP_CODE_PREFIXApiFirebaseServerAuthContext {
    return new APP_CODE_PREFIXApiFirebaseServerAuthContext(this, context);
  }

  userContext(uid: string): APP_CODE_PREFIXApiFirebaseServerAuthUserContext {
    return new APP_CODE_PREFIXApiFirebaseServerAuthUserContext(this, uid);
  }

  readRoles(claims: AuthClaims): AuthRoleSet {
    return APP_CODE_PREFIXApiAuthService.APP_CODE_PREFIX_UPPER_API_CLAIMS_SERVICE.toRoles(claims);
  }

  claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate {
    return APP_CODE_PREFIXApiAuthService.APP_CODE_PREFIX_UPPER_API_CLAIMS_SERVICE.toClaims(roles);
  }

}
