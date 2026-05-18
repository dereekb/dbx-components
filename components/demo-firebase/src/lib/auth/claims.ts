import { AUTH_ADMIN_ROLE, authRoleClaimsService, AUTH_ONBOARDED_ROLE, AUTH_TOS_SIGNED_ROLE } from '@dereekb/util';
import { type StorageFileUploadUserClaims, STORAGE_FILE_UPLOAD_USER_SIMPLE_CLAIMS_CONFIGURATION } from '@dereekb/firebase';

export const DEMO_API_AUTH_CLAIMS_ONBOARDED_TOKEN = 'o';

/**
 * Custom Firebase Auth claims for the demo API.
 *
 * @dbxAuthClaimsApp demo-api
 */
export type DemoApiAuthClaims = StorageFileUploadUserClaims & {
  /**
   * Onboarded flag — set when the user has signed TOS and completed onboarding.
   *
   * @dbxAuthClaim
   * @dbxAuthRoleTag onboarded
   * @dbxAuthRoleTag verified-user
   */
  o?: 1;
  /**
   * Admin role — grants full access to admin-only sections of the app.
   *
   * @dbxAuthClaim
   * @dbxAuthRoleTag privileged
   * @dbxAuthRoleTag staff
   */
  a?: 1;
};

/**
 * Demo API auth claims service. Converts between {@link DemoApiAuthClaims}
 * and the AuthRoleSet the app uses for permission checks.
 *
 * @dbxAuthClaimsService demo-api
 */
export const DEMO_AUTH_CLAIMS_SERVICE = authRoleClaimsService<DemoApiAuthClaims>({
  o: {
    roles: [AUTH_TOS_SIGNED_ROLE, AUTH_ONBOARDED_ROLE]
  },
  a: {
    roles: AUTH_ADMIN_ROLE
  },
  fr: STORAGE_FILE_UPLOAD_USER_SIMPLE_CLAIMS_CONFIGURATION
});
