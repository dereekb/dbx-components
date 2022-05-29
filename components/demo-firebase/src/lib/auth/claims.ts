import { AUTH_ADMIN_ROLE, authRoleClaimsService } from '@dereekb/util';

export type DemoApiAuthClaims = {
  /**
   * Admin role
   */
  a?: 1;
};

export const DEMO_AUTH_CLAIMS_SERVICE = authRoleClaimsService<DemoApiAuthClaims>({
  a: {
    roles: AUTH_ADMIN_ROLE
  }
});
