import { AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE, AuthRoleClaimsFactoryConfigEntrySimpleOptions } from '@dereekb/util';

/**
 * Used as a flag to disable uploads for a user.
 */
export type StorageFileUploadUserRestriction = typeof AUTH_ROLE_CLAIMS_DEFAULT_CLAIM_VALUE;

/**
 * Claims value for disabling uploads for a user.
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
 * AuthRoleClaimsFactoryConfigEntrySimpleOptions configuration for adding the "uploads" role to the user when the disable uploads claim is not present.
 */
export const storageFileUploadUserSimpleClaimsConfiguration: AuthRoleClaimsFactoryConfigEntrySimpleOptions<StorageFileUploadUserRestriction> = {
  roles: STORAGE_FILE_UPLOAD_USER_ROLE,
  inverse: true
};
