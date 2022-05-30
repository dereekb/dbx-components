import { CallableContextWithAuthData, AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext } from "@dereekb/firebase-server";
import { AuthClaims, AuthClaimsUpdate, AuthRoleSet, AuthRoleClaimsFactoryConfig, authRoleClaimsService, AUTH_ADMIN_ROLE } from "@dereekb/util";
import { APP_CODE_PREFIX_UPPER_AUTH_CLAIMS_SERVICE } from 'FIREBASE_COMPONENTS_NAME';

export class APP_CODE_PREFIXApiFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<APP_CODE_PREFIXApiAuthService> {

}

export class APP_CODE_PREFIXApiFirebaseServerAuthContext extends AbstractFirebaseServerAuthContext<APP_CODE_PREFIXApiFirebaseServerAuthContext, APP_CODE_PREFIXApiFirebaseServerAuthUserContext, APP_CODE_PREFIXApiAuthService>  {

}

export class APP_CODE_PREFIXApiAuthService extends AbstractFirebaseServerAuthService<APP_CODE_PREFIXApiFirebaseServerAuthUserContext, APP_CODE_PREFIXApiFirebaseServerAuthContext> {

  protected _context(context: CallableContextWithAuthData): APP_CODE_PREFIXApiFirebaseServerAuthContext {
    return new APP_CODE_PREFIXApiFirebaseServerAuthContext(this, context);
  }

  userContext(uid: string): APP_CODE_PREFIXApiFirebaseServerAuthUserContext {
    return new APP_CODE_PREFIXApiFirebaseServerAuthUserContext(this, uid);
  }

  readRoles(claims: AuthClaims): AuthRoleSet {
    return APP_CODE_PREFIX_UPPER_AUTH_CLAIMS_SERVICE.toRoles(claims);
  }

  claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate {
    return APP_CODE_PREFIX_UPPER_AUTH_CLAIMS_SERVICE.toClaims(roles);
  }

}
