import { AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext } from "@dereekb/firebase-server";
import { AuthClaims, AuthRoleSet } from "@dereekb/util";
import { CallableContextWithAuthData } from "packages/firebase-server/src/lib/function/context";

export class DemoApiFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<DemoApiAuthService> {

}

export class DemoApiFirebaseServerAuthContext extends AbstractFirebaseServerAuthContext<DemoApiFirebaseServerAuthContext, DemoApiFirebaseServerAuthUserContext, DemoApiAuthService>  {

}

export class DemoApiAuthService extends AbstractFirebaseServerAuthService<DemoApiFirebaseServerAuthUserContext, DemoApiFirebaseServerAuthContext> {

  protected _context(context: CallableContextWithAuthData): DemoApiFirebaseServerAuthContext {
    return new DemoApiFirebaseServerAuthContext(this, context);
  }

  userContext(uid: string): DemoApiFirebaseServerAuthUserContext {
    return new DemoApiFirebaseServerAuthUserContext(this, uid);
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
