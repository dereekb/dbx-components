import { type FirebasePermissionServiceModel, type FirestoreModelKey, type GrantedRolesOtherwiseFunctionResult, type GrantRolesOtherwiseFunction, type StorageFile, type StorageFileDocument, type StorageFileRoles, type FirebaseModelContext } from '@dereekb/firebase';
import { type GrantedRoleMap } from '@dereekb/model';
import { type Getter, type Maybe } from '@dereekb/util';

/**
 * grantStorageFileRolesForUserAuthFunction() configuration
 */
export interface GrantStorageFileRolesForUserAuthFunctionConfig<T extends FirebaseModelContext> {
  readonly output: FirebasePermissionServiceModel<StorageFile, StorageFileDocument>;
  readonly context: T;
  readonly model: StorageFileDocument;
}

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
 * Creates a new GrantStorageFileRolesForUserAuthFunction given the input config/context.
 *
 * @param config
 * @returns
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
