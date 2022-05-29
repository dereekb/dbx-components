import { AUTH_ADMIN_ROLE, authRoleClaimsService } from '@dereekb/util';

export type APP_CODE_PREFIXApiAuthClaims = {
  /**
   * Admin role
   */
  a?: number;
}

export const APP_CODE_PREFIX_UPPER_AUTH_CLAIMS_SERVICE = authRoleClaimsService<APP_CODE_PREFIXApiAuthClaims>({
  a: {
    roles: AUTH_ADMIN_ROLE
  }
});
