import { type GrantedRoleMap } from '@dereekb/model';
import { type Getter, type Maybe } from '@dereekb/util';
import { type FirebaseModelContext, type FirebasePermissionServiceModel, type FirestoreModelKey, type GrantRolesOtherwiseFunction, type GrantedRolesOtherwiseFunctionResult } from '../../common';
import { type FormSpace, type FormSpaceDocument, type FormSpaceRoles } from './formspace';

/**
 * Configuration for {@link grantFormSpaceRolesForUserAuthFunction}, providing the permission
 * service output, auth context, and target FormSpace document.
 */
export interface GrantFormSpaceRolesForUserAuthFunctionConfig<T extends FirebaseModelContext> {
  readonly output: FirebasePermissionServiceModel<FormSpace, FormSpaceDocument>;
  readonly context: T;
  readonly model: FormSpaceDocument;
}

/**
 * Input for the role granting function, specifying which roles to grant based on
 * user ownership and/or ownership key matching.
 */
export interface GrantFormSpaceRolesForUserAuthInput {
  /**
   * Roles to grant if the user matches the FormSpace's `u` value.
   */
  readonly rolesForFormSpaceUser?: Maybe<Getter<GrantedRolesOtherwiseFunctionResult<FormSpaceRoles>>>;
  /**
   * Roles to grant if the FormSpace carries an ownership key.
   */
  readonly rolesForFormSpaceOwnershipKey?: Maybe<(ownershipKey: FirestoreModelKey) => GrantedRolesOtherwiseFunctionResult<FormSpaceRoles>>;
}

export type GrantFormSpaceRolesForUserAuthFunction = (input: GrantFormSpaceRolesForUserAuthInput) => GrantRolesOtherwiseFunction<FormSpaceRoles>;

/**
 * Creates a function that grants {@link FormSpaceRoles} based on the authentication context.
 *
 * Mirrors {@link grantStorageFileRolesForUserAuthFunction}: the two conditions — the caller IS the space's
 * user, and the space carries an ownership key the caller satisfies — are evaluated in parallel and merged.
 *
 * @param config - Permission output, auth context, and target document for the grant.
 * @returns Builder that takes role configuration and yields a GrantRolesOtherwiseFunction.
 *
 * @example
 * ```ts
 * const grantRoles = grantFormSpaceRolesForUserAuthFunction({ output, context, model });
 * const otherwise = grantRoles({
 *   rolesForFormSpaceUser: () => ({ read: true, update: true, submit: true, delete: true })
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function grantFormSpaceRolesForUserAuthFunction<T extends FirebaseModelContext>(config: GrantFormSpaceRolesForUserAuthFunctionConfig<T>): GrantFormSpaceRolesForUserAuthFunction {
  const { output, context } = config;

  return (input: GrantFormSpaceRolesForUserAuthInput) => {
    const { rolesForFormSpaceUser, rolesForFormSpaceOwnershipKey } = input;
    const result: GrantRolesOtherwiseFunction<FormSpaceRoles> = async () => {
      const { data: formSpace } = output;

      let userRoles: Maybe<Promise<Maybe<GrantedRoleMap<FormSpaceRoles>>>>;
      let ownershipKeyRoles: Maybe<Promise<Maybe<GrantedRoleMap<FormSpaceRoles>>>>;

      // check roles if the user matches
      if (rolesForFormSpaceUser && formSpace?.u === context.auth?.uid) {
        userRoles = Promise.resolve(rolesForFormSpaceUser());
      }

      // check roles if the ownership key is available
      if (rolesForFormSpaceOwnershipKey && formSpace?.o) {
        ownershipKeyRoles = Promise.resolve(rolesForFormSpaceOwnershipKey(formSpace.o));
      }

      const [a, b] = await Promise.all([userRoles, ownershipKeyRoles]);

      return {
        ...a,
        ...b
      };
    };

    return result;
  };
}
