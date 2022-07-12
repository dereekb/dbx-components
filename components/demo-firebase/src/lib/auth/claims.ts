import { AUTH_ADMIN_ROLE, authRoleClaimsService, AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE } from '@dereekb/util';

export const DEMO_API_AUTH_CLAIMS_ONBOARDED_TOKEN = 'o';

export type DemoApiAuthClaims = {
  /**
   * Onboarded flag
   */
  o?: 1;
  /**
   * Admin role
   */
  a?: 1;
};

export const DEMO_AUTH_CLAIMS_SERVICE = authRoleClaimsService<DemoApiAuthClaims>({
  o: {
    roles: [AUTH_TOS_SIGNED_ROLE, AUTH_ONBOARDED_ROLE]
  },
  a: {
    roles: AUTH_ADMIN_ROLE
  }
});
