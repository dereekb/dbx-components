import { CallableContextWithAuthData, AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext } from "@dereekb/firebase-server";
import { AuthClaims, AuthRoleSet } from "@dereekb/util";

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
    const roles = new Set<string>();

    if (claims.a) {

    }

    return roles;
  }

  claimsForRoles(roles: AuthRoleSet): AuthClaims {
    const claims: AuthClaims = {};



    return claims;
  }

}
