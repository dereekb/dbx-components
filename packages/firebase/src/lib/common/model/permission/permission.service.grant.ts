import { type FirestoreDocument } from './../../firestore/accessor/document';
import { fullAccessRoleMap, type GrantedRoleMap, noAccessRoleMap } from '@dereekb/model';
import { type AsyncDecisionFunction, type AuthRole, type Getter, type GetterOrValue, type Maybe, type PromiseOrValue, setContainsAllValues, type IterableOrValue, iterableToArray, getValueFromGetter } from '@dereekb/util';
import { type FirebaseModelContext } from '../context';
import { type UserRelated } from '../../../model/user';

// MARK: Admin
/**
 * Decision function that checks if the current user is an admin in the given context.
 *
 * Returns `false` if no auth is present.
 */
export const isAdminInFirebaseModelContext: AsyncDecisionFunction<FirebaseModelContext> = (context: FirebaseModelContext) => context.auth?.isAdmin() ?? false;

/**
 * Creates a {@link GrantRolesIfFunction} that grants the specified roles when the user is an admin.
 *
 * @param rolesToGrantToAdmin - roles to grant if the user is an admin
 *
 * @example
 * ```ts
 * const grantIfAdmin = grantModelRolesIfAdminFunction(fullAccessRoleMap);
 * const roles = await grantIfAdmin(context);
 * ```
 */
export function grantModelRolesIfAdminFunction<R extends string = string>(rolesToGrantToAdmin: GetterOrValue<GrantedRoleMap<R>>): GrantRolesIfFunction<FirebaseModelContext, R> {
  return grantModelRolesIfFunction(isAdminInFirebaseModelContext, rolesToGrantToAdmin);
}

/**
 * Pre-built grant function that gives full access (all roles) when the user is an admin.
 */
export const grantFullAccessIfAdmin: GeneralGrantRolesIfFunction<FirebaseModelContext> = grantModelRolesIfAdminFunction(fullAccessRoleMap);

/**
 * Convenience function that evaluates admin status and grants roles in a single call.
 *
 * @param context - the model context to check
 * @param rolesToGrantToAdmin - roles to grant if admin
 * @param otherwise - fallback role computation when not admin
 */
export function grantModelRolesIfAdmin<R extends string = string>(context: FirebaseModelContext, rolesToGrantToAdmin: GetterOrValue<GrantedRoleMap<R>>, otherwise?: GrantRolesOtherwiseFunction<R>): PromiseOrValue<GrantedRoleMap<R>> {
  return grantModelRolesIfAdminFunction(rolesToGrantToAdmin)(context, otherwise);
}

// MARK: Auth Roles
/**
 * Creates a {@link GrantRolesIfFunction} that grants roles when the user has all specified auth roles in their token.
 *
 * @param authRoles - the auth roles the user must have
 * @param rolesToGrantToAdmin - the model roles to grant if the auth roles are present
 */
export function grantModelRolesIfHasAuthRolesFunction<R extends string = string>(authRoles: AuthRole[], rolesToGrantToAdmin: GetterOrValue<GrantedRoleMap<R>>): GrantRolesIfFunction<FirebaseModelContext, R> {
  return grantModelRolesIfFunction((context: FirebaseModelContext) => {
    const currentAuthRoles = context.auth?.getAuthRoles();

    if (currentAuthRoles) {
      return setContainsAllValues(currentAuthRoles, authRoles);
    } else {
      return authRoles.length === 0;
    }
  }, rolesToGrantToAdmin);
}

/**
 * Factory function type for auth-role-based role granting.
 */
export type GrantModelRolesIfHasAuthRolesFactory = <R extends string = string>(context: FirebaseModelContext, rolesToGrantToAdmin: GetterOrValue<GrantedRoleMap<R>>, otherwise?: GrantRolesOtherwiseFunction<R>) => PromiseOrValue<GrantedRoleMap<R>>;

/**
 * Creates a reusable factory pre-configured with specific auth roles to check for.
 *
 * @param authRoles - the auth roles the user must have
 */
export function grantModelRolesIfHasAuthRolesFactory(authRoles: IterableOrValue<AuthRole>): GrantModelRolesIfHasAuthRolesFactory {
  const authRolesToHave = iterableToArray(authRoles);

  return <R extends string = string>(context: FirebaseModelContext, rolesToGrantToMatch: GetterOrValue<GrantedRoleMap<R>>, otherwise?: GrantRolesOtherwiseFunction<R>): PromiseOrValue<GrantedRoleMap<R>> => {
    return grantModelRolesIfHasAuthRolesFunction(authRolesToHave, rolesToGrantToMatch)(context, otherwise);
  };
}

// MARK: User Related
/**
 * Context for evaluating ownership of a {@link UserRelated} model. Accepts either the model data directly
 * or a document reference that will be loaded to check ownership.
 */
export type UserRelatedModelFirebaseModelContext<T extends UserRelated = UserRelated> = UserRelatedModelFirebaseModelContextModelInput<T> | UserRelatedModelFirebaseModelContextDocumentInput<T>;

/**
 * Input variant that provides the model data directly (avoids an extra Firestore read).
 */
export type UserRelatedModelFirebaseModelContextModelInput<T extends UserRelated = UserRelated> = {
  model: T;
  context: FirebaseModelContext;
};

/**
 * Input variant that provides a document reference — the model data will be loaded to check ownership.
 */
export type UserRelatedModelFirebaseModelContextDocumentInput<T extends UserRelated = UserRelated> = {
  document: FirestoreDocument<T>;
  context: FirebaseModelContext;
};

/**
 * DecisionFunction for a FirebaseModelContext that checks if the user is related to the model by uid.
 *
 * @param context
 * @returns
 */
export const isOwnerOfUserRelatedModelInFirebaseModelContext: AsyncDecisionFunction<UserRelatedModelFirebaseModelContext<UserRelated>> = async (context: UserRelatedModelFirebaseModelContext) => {
  let decision = false;
  const auth = context.context.auth;

  if (auth != null) {
    let model: Maybe<UserRelated> = (context as UserRelatedModelFirebaseModelContextModelInput).model;

    if (!model) {
      const document = (context as UserRelatedModelFirebaseModelContextDocumentInput).document;

      if (document) {
        model = (await document.accessor.get()).data();
      }
    }

    if (model) {
      decision = auth.uid === model.uid;
    }
  }

  return decision;
};

/**
 * Creates a {@link GrantRolesIfFunction} that grants roles when the authenticated user's UID matches the model's `uid` field.
 *
 * @param rolesToGrant - the roles to grant if the user owns the model
 *
 * @example
 * ```ts
 * const grantIfOwner = grantModelRolesIfAuthUserRelatedModelFunction<User>(fullAccessRoleMap);
 * const roles = await grantIfOwner({ model: userData, context });
 * ```
 */
export function grantModelRolesIfAuthUserRelatedModelFunction<T extends UserRelated, R extends string = string>(rolesToGrant: GetterOrValue<GrantedRoleMap<R>>): GrantRolesIfFunction<UserRelatedModelFirebaseModelContext<T>, R> {
  return grantModelRolesIfFunction(isOwnerOfUserRelatedModelInFirebaseModelContext, rolesToGrant);
}

/**
 * Convenience function that checks the input context if the user is related to the model by uid.
 */
export const grantFullAccessIfAuthUserRelated: GeneralGrantRolesIfFunction<UserRelatedModelFirebaseModelContext<UserRelated>> = grantModelRolesIfAuthUserRelatedModelFunction(fullAccessRoleMap);

// MARK: Grant Roles
/**
 * Grants the configured roles if the decision function returns `true`. Otherwise returns a no-access role map.
 *
 * Unlike {@link GrantRolesIfFunction}, this does not accept an `otherwise` fallback.
 */
export type GrantRolesOnlyIfFunction<C, R extends string = string> = (context: C) => Promise<GrantedRoleMap<R>>;

/**
 * Generic variant of {@link GrantRolesOnlyIfFunction} that works with any role type.
 */
export type GeneralGrantRolesOnlyIfFunction<C> = <R extends string = string>(context: C) => Promise<GrantedRoleMap<R>>;

/**
 * Creates a {@link GrantRolesOnlyIfFunction} with no fallback — returns no-access if the condition is false.
 *
 * @param grantIf - decision function to evaluate
 * @param grantedRoles - roles to grant if the decision is `true`
 */
export function grantModelRolesOnlyIfFunction<C, R extends string = string>(grantIf: AsyncDecisionFunction<C>, grantedRoles: GetterOrValue<GrantedRoleMap<R>>): GrantRolesOnlyIfFunction<C, R> {
  const fn = grantModelRolesIfFunction<C, R>(grantIf, grantedRoles);
  return (context: C) => fn(context);
}

/**
 * Grants the configured roles if the decision is made about the context. Otherwise, invokes the otherwise function if available, or returns a NoAccessRoleMap.
 */
export type GrantRolesIfFunction<C, R extends string = string> = (context: C, otherwise?: GrantRolesOtherwiseFunction<R>) => Promise<GrantedRoleMap<R>>;
export type GeneralGrantRolesIfFunction<C> = <R extends string = string>(context: C, otherwise?: GrantRolesOtherwiseFunction<R>) => Promise<GrantedRoleMap<R>>;

/**
 * The result of a GrantedRolesOtherwiseFunction.
 */
export type GrantedRolesOtherwiseFunctionResult<R extends string = string> = PromiseOrValue<Maybe<GrantedRoleMap<R>>>;

/**
 * Used as the "else" statement for grantModelRolesIfFunction.
 *
 * If no roles are returned, the grantModelRolesIfFunction() will return a NoAccessRoleMap.
 */
export type GrantRolesOtherwiseFunction<R extends string = string> = Getter<GrantedRolesOtherwiseFunctionResult<R>>;

/**
 * Creates a {@link GrantRolesIfFunction} that evaluates a decision function and grants roles if `true`,
 * or falls back to the `otherwise` function (defaulting to no-access).
 *
 * This is the core building block for composing permission logic.
 *
 * @param grantIf - async decision function to evaluate
 * @param grantedRoles - roles to grant if the decision is `true`
 * @throws {Error} When `grantIf` is not provided.
 *
 * @example
 * ```ts
 * const grantIfOwner = grantModelRolesIfFunction(
 *   isOwnerOfUserRelatedModelInFirebaseModelContext,
 *   fullAccessRoleMap
 * );
 * const roles = await grantIfOwner(context, () => noAccessRoleMap());
 * ```
 */
export function grantModelRolesIfFunction<C, R extends string = string>(grantIf: AsyncDecisionFunction<C>, grantedRoles: GetterOrValue<GrantedRoleMap<R>>): GrantRolesIfFunction<C, R> {
  if (!grantIf) {
    throw new Error('missing grant if');
  }

  return async (context: C, otherwise: GrantRolesOtherwiseFunction<R> = noAccessRoleMap) => {
    const decision = await grantIf(context);
    const results: GrantedRoleMap<R> = decision ? await getValueFromGetter(grantedRoles) : ((await otherwise()) ?? noAccessRoleMap());
    return results;
  };
}
