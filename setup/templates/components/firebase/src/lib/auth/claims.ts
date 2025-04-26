import { AUTH_ADMIN_ROLE, authRoleClaimsService, AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE } from '@dereekb/util';

export const APP_CODE_PREFIX_CAPS_API_AUTH_CLAIMS_ONBOARDED_TOKEN = 'o';

export type APP_CODE_PREFIXApiAuthClaims = {
  /**
   * Admin role
   */
  a?: 1;
  /**
   * Onboarded flag
   */
  o?: 1;
}

export const APP_CODE_PREFIX_CAPS_AUTH_CLAIMS_SERVICE = authRoleClaimsService<APP_CODE_PREFIXApiAuthClaims>({
  a: {
    roles: AUTH_ADMIN_ROLE
  },
  o: {
    roles: [AUTH_TOS_SIGNED_ROLE, AUTH_ONBOARDED_ROLE]
  }
});
