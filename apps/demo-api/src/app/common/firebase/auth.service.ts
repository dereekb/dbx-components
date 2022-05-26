import { CallableContextWithAuthData, AbstractFirebaseServerAuthContext, AbstractFirebaseServerAuthService, AbstractFirebaseServerAuthUserContext } from '@dereekb/firebase-server';
import { AuthClaims, AuthClaimsUpdate, AuthRoleSet, AUTH_ADMIN_ROLE, AuthRoleClaimsFactoryConfig, authRoleClaimsService } from '@dereekb/util';

export type DemoApiAuthClaims = {
  /**
   * Admin role
   */
  a?: number;
};

export class DemoApiFirebaseServerAuthUserContext extends AbstractFirebaseServerAuthUserContext<DemoApiAuthService> {}

export class DemoApiFirebaseServerAuthContext extends AbstractFirebaseServerAuthContext<DemoApiFirebaseServerAuthContext, DemoApiFirebaseServerAuthUserContext, DemoApiAuthService> {}

export class DemoApiAuthService extends AbstractFirebaseServerAuthService<DemoApiFirebaseServerAuthUserContext, DemoApiFirebaseServerAuthContext> {
  static readonly DEMO_API_CLAIMS_CONFIG: AuthRoleClaimsFactoryConfig<DemoApiAuthClaims> = {
    a: {
      roles: AUTH_ADMIN_ROLE
    }
  };

  static readonly DEMO_API_CLAIMS_SERVICE = authRoleClaimsService(DemoApiAuthService.DEMO_API_CLAIMS_CONFIG);

  protected _context(context: CallableContextWithAuthData): DemoApiFirebaseServerAuthContext {
    return new DemoApiFirebaseServerAuthContext(this, context);
  }

  userContext(uid: string): DemoApiFirebaseServerAuthUserContext {
    return new DemoApiFirebaseServerAuthUserContext(this, uid);
  }

  readRoles(claims: AuthClaims): AuthRoleSet {
    return DemoApiAuthService.DEMO_API_CLAIMS_SERVICE.toRoles(claims);
  }

  claimsForRoles(roles: AuthRoleSet): AuthClaimsUpdate {
    return DemoApiAuthService.DEMO_API_CLAIMS_SERVICE.toClaims(roles);
  }
}
