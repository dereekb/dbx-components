import { type AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE, type AuthRoleClaimsFactoryConfigEntrySimpleOptions } from '@dereekb/util';

/**
 * Claim value type used to restrict file uploads for a user.
 *
 * When set to true in the user's custom claims, the `uploads` role is revoked
 * (inverse claim pattern).
 */
export type StorageFileUploadUserRestriction = typeof AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE;

/**
 * Custom claims shape for controlling a user's file upload permission.
 *
 * Uses an inverse claim pattern: when `fr` is set to true, the `uploads` role
 * is removed from the user, preventing file uploads. When absent or false,
 * the user retains the `uploads` role by default.
 *
 * Used with Firebase Storage security rules to enforce upload restrictions.
 */
export type StorageFileUploadUserClaims = {
  /**
   * Storage uploads restriction.
   *
   * An inverse claim that removes the "uploads" role from the user when set true.
   */
  fr?: StorageFileUploadUserRestriction;
};

/**
 * The role used for uploading files.
 */
export const STORAGE_FILE_UPLOAD_USER_ROLE = 'uploads';

/**
 * Pre-configured claims entry that grants the `uploads` role by default and revokes it
 * when the `fr` claim is set (inverse pattern).
 *
 * Pass this to an `AuthRoleClaimsFactory` to integrate upload restrictions into your auth system.
 *
 * @example
 * ```ts
 * const claimsConfig = {
 *   fr: storageFileUploadUserSimpleClaimsConfiguration
 * };
 * ```
 */
export const storageFileUploadUserSimpleClaimsConfiguration: AuthRoleClaimsFactoryConfigEntrySimpleOptions<StorageFileUploadUserRestriction> = {
  roles: STORAGE_FILE_UPLOAD_USER_ROLE,
  inverse: true
};
