import { FirestoreDocument } from './../../firestore/accessor/document';
import { fullAccessRoleMap, GrantedRoleMap, noAccessRoleMap } from '@dereekb/model';
import { AsyncDecisionFunction, Getter, GetterOrValue, getValueFromGetter, Maybe, PromiseOrValue } from '@dereekb/util';
import { FirebaseModelContext } from '../context';
import { UserRelated } from '../../../model/user';

// MARK: Admin
/**
 * DecisionFunction for a FirebaseModelContext that checks if the current user is an admin.
 *
 * @param context
 * @returns
 */
export const isAdminInFirebaseModelContext: AsyncDecisionFunction<FirebaseModelContext> = (context: FirebaseModelContext) => context.auth?.isAdmin() ?? false;

/**
 * Convenience function that checks the input context if the user is an admin or not and grants pre-set admin roles if they are.
 *
 * @param context
 * @param rolesToGrantToAdmin
 * @param otherwise
 * @returns
 */
export function grantModelRolesIfAdminFunction<R extends string = string>(rolesToGrantToAdmin: GetterOrValue<GrantedRoleMap<R>>): GrantRolesIfFunction<FirebaseModelContext, R> {
  return grantModelRolesIfFunction(isAdminInFirebaseModelContext, rolesToGrantToAdmin);
}

/**
 * Convenience function that checks the input context if the user is an admin or grants all roles.
 */
export const grantFullAccessIfAdmin: GeneralGrantRolesIfFunction<FirebaseModelContext> = grantModelRolesIfAdminFunction(fullAccessRoleMap);

export function grantModelRolesIfAdmin<R extends string = string>(context: FirebaseModelContext, rolesToGrantToAdmin: GetterOrValue<GrantedRoleMap<R>>, otherwise?: GrantRolesOtherwiseFunction<R>): PromiseOrValue<GrantedRoleMap<R>> {
  return grantModelRolesIfAdminFunction(rolesToGrantToAdmin)(context, otherwise);
}

// MARK: User Related
export type UserRelatedModelFirebaseModelContext<T extends UserRelated = UserRelated> = UserRelatedModelFirebaseModelContextModelInput<T> | UserRelatedModelFirebaseModelContextDocumentInput<T>;

export type UserRelatedModelFirebaseModelContextModelInput<T extends UserRelated = UserRelated> = {
  model: T;
  context: FirebaseModelContext;
};

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
 * Creates a GrantRolesIfFunction that grants roles if the user is related to the model by uid.
 *
 * @param context
 * @param rolesToGrant
 * @param otherwise
 * @returns
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
 * Grants the configured roles if the decision is made about the context. Otherwise, returns a NoAccessRoleMap.
 */
export type GrantRolesOnlyIfFunction<C, R extends string = string> = (context: C) => Promise<GrantedRoleMap<R>>;
export type GeneralGrantRolesOnlyIfFunction<C> = <R extends string = string>(context: C) => Promise<GrantedRoleMap<R>>;

/**
 * Creates a GrantRolesOnlyIfFunction
 *
 * @param grantIf
 * @param grantedRoles
 * @returns
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
 * Used as the "else" statement for grantModelRolesIfFunction.
 *
 * If no roles are returned, the grantModelRolesIfFunction() will return a NoAccessRoleMap.
 */
export type GrantRolesOtherwiseFunction<R extends string = string> = Getter<Maybe<PromiseOrValue<Maybe<GrantedRoleMap<R>>>>>;

/**
 * Creates a GrantRolesIfFunction.
 *
 * @param grantIf
 * @param grantedRoles
 * @returns
 */
export function grantModelRolesIfFunction<C, R extends string = string>(grantIf: AsyncDecisionFunction<C>, grantedRoles: GetterOrValue<GrantedRoleMap<R>>): GrantRolesIfFunction<C, R> {
  if (!grantIf) {
    throw new Error('missing grant if');
  }

  return async (context: C, otherwise: GrantRolesOtherwiseFunction<R> = noAccessRoleMap) => {
    const decision = await grantIf(context);
    const results: GrantedRoleMap<R> = decision ? await getValueFromGetter(grantedRoles) : (await otherwise()) ?? noAccessRoleMap();
    return results;
  };
}
