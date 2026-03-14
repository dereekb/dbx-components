import { type FirebasePermissionServiceModel, type FirestoreModelKey, type GrantedRolesOtherwiseFunctionResult, type GrantRolesOtherwiseFunction, type StorageFile, type StorageFileDocument, type StorageFileRoles, type FirebaseModelContext } from '@dereekb/firebase';
import { type GrantedRoleMap } from '@dereekb/model';
import { type Getter, type Maybe } from '@dereekb/util';

/**
 * Configuration for {@link grantStorageFileRolesForUserAuthFunction}, providing the permission
 * service output, auth context, and target StorageFile document.
 */
export interface GrantStorageFileRolesForUserAuthFunctionConfig<T extends FirebaseModelContext> {
  readonly output: FirebasePermissionServiceModel<StorageFile, StorageFileDocument>;
  readonly context: T;
  readonly model: StorageFileDocument;
}

/**
 * Input for the role granting function, specifying which roles to grant based on
 * user ownership and/or ownership key matching.
 */
export interface GrantStorageFileRolesForUserAuthInput {
  /**
   * Roles to grant if the user matches the storage file user.
   */
  readonly rolesForStorageFileUser?: Maybe<Getter<GrantedRolesOtherwiseFunctionResult<StorageFileRoles>>>;
  /**
   * Roles to grant if the StorageFile has an ownership key.
   */
  readonly rolesForStorageFileOwnershipKey?: Maybe<(ownershipKey: FirestoreModelKey) => GrantedRolesOtherwiseFunctionResult<StorageFileRoles>>;
}

export type GrantStorageFileRolesForUserAuthFunction = (input: GrantStorageFileRolesForUserAuthInput) => GrantRolesOtherwiseFunction<StorageFileRoles>;

/**
 * Creates a function that grants {@link StorageFileRoles} based on user authentication context.
 *
 * The returned function checks two conditions in parallel:
 * 1. Whether the authenticated user matches the StorageFile's `u` (user) field
 * 2. Whether the StorageFile has an ownership key (`o`) that grants additional roles
 *
 * Use this within a permission service to define role-based access for StorageFile operations.
 *
 * @param config - the permission output, auth context, and target document
 *
 * @example
 * ```ts
 * const grantRoles = grantStorageFileRolesForUserAuthFunction({ output, context, model });
 * const otherwise = grantRoles({
 *   rolesForStorageFileUser: () => ({ download: true, update: true }),
 *   rolesForStorageFileOwnershipKey: (key) => ({ read: true })
 * });
 * ```
 */
export function grantStorageFileRolesForUserAuthFunction<T extends FirebaseModelContext>(config: GrantStorageFileRolesForUserAuthFunctionConfig<T>): GrantStorageFileRolesForUserAuthFunction {
  const { output, context, model } = config;

  return (input: GrantStorageFileRolesForUserAuthInput) => {
    const { rolesForStorageFileUser, rolesForStorageFileOwnershipKey } = input;
    const result: GrantRolesOtherwiseFunction<StorageFileRoles> = async () => {
      const { data: storageFile } = output;

      let userRoles: Maybe<Promise<Maybe<GrantedRoleMap<StorageFileRoles>>>>;
      let ownershipKeyRoles: Maybe<Promise<Maybe<GrantedRoleMap<StorageFileRoles>>>>;

      // check roles if the user matches
      if (rolesForStorageFileUser && storageFile?.u === context.auth?.uid) {
        userRoles = Promise.resolve(rolesForStorageFileUser());
      }

      // check roles if the ownership key is available
      if (rolesForStorageFileOwnershipKey && storageFile?.o) {
        ownershipKeyRoles = Promise.resolve(rolesForStorageFileOwnershipKey(storageFile.o));
      }

      const [a, b] = await Promise.all([userRoles, ownershipKeyRoles]);

      return {
        ...(a ?? {}),
        ...(b ?? {})
      };
    };

    return result;
  };
}
