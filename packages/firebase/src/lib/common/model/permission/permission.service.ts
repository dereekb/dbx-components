import { FirestoreDocument } from './../../firestore';
import { AbstractModelPermissionService, fullAccessRoleMap, GrantedRoleMap, InContextModelPermissionService, InModelContextModelPermissionService, ModelPermissionService, noAccessRoleMap } from '@dereekb/model';
import { DecisionFunction, Getter, GetterOrValue, getValueFromGetter, Maybe, PromiseOrValue } from '@dereekb/util';
import { FirebaseModelLoader, InModelContextFirebaseModelLoader } from '../model/model.loader';
import { FirebaseModelContext } from '../context';
import { FirebasePermissionServiceModel } from './permission';

export type FirebaseModelPermissionService<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = ModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>>;

export interface FirebasePermissionServiceInstanceDelegate<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends FirebaseModelLoader<C, T, D> {
  roleMapForModel(output: FirebasePermissionServiceModel<T, D>, context: C, model: D): PromiseOrValue<GrantedRoleMap<R>>;
}

/**
 * Abstract AbstractModelPermissionService implementation for FirebaseModelsPermissionService.
 */
export class FirebaseModelPermissionServiceInstance<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends AbstractModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>> implements FirebaseModelPermissionService<C, T, D, R> {
  constructor(readonly delegate: FirebasePermissionServiceInstanceDelegate<C, T, D, R>) {
    super(delegate);
  }

  roleMapForModel(output: FirebasePermissionServiceModel<T, D>, context: C, model: D): PromiseOrValue<GrantedRoleMap<R>> {
    return this.delegate.roleMapForModel(output, context, model);
  }

  protected async outputForModel(document: D): Promise<Maybe<FirebasePermissionServiceModel<T, D>>> {
    const snapshot = await document.accessor.get();
    const data = snapshot.data();

    const model: Maybe<FirebasePermissionServiceModel<T, D>> = { document, snapshot, data, exists: data != null };
    return model;
  }

  protected override isUsableOutputForRoles(output: FirebasePermissionServiceModel<T, D>) {
    return output.exists;
  }
}

export function firebaseModelPermissionService<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string>(delegate: FirebasePermissionServiceInstanceDelegate<C, T, D, R>): FirebaseModelPermissionServiceInstance<C, T, D, R> {
  return new FirebaseModelPermissionServiceInstance(delegate);
}

// MARK: InContext
export type InContextFirebaseModelPermissionService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = InContextModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>>;

// MARK: InModelContext
export type InModelContextFirebaseModelPermissionService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = InModelContextModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>> & InModelContextFirebaseModelLoader<T, D>;

// MARK: Utility
export const grantFullAccessIfAdmin: GeneralGrantRolesIfFunction = grantModelRolesIfAdminFunction(fullAccessRoleMap);

export function grantModelRolesIfAdmin<R extends string = string>(context: FirebaseModelContext, rolesToGrantToAdmin: GetterOrValue<GrantedRoleMap<R>>, otherwise?: GrantRolesOtherwiseFunction<R>): GrantedRoleMap<R> {
  return grantModelRolesIfAdminFunction(rolesToGrantToAdmin)(context, otherwise);
}

/**
 * Convenience function that checks the input context if the user is an admin or not and grants pre-set admin roles if they are.
 *
 * @param context
 * @param rolesToGrantToAdmin
 * @param otherwise
 * @returns
 */
export function grantModelRolesIfAdminFunction<R extends string = string>(rolesToGrantToAdmin: GetterOrValue<GrantedRoleMap<R>>): GrantRolesIfFunction<R> {
  return grantModelRolesIfFunction(isAdminInFirebaseModelContext, rolesToGrantToAdmin);
}

/**
 * DecisionFunction for a FirebaseModelContext that checks if the current user is an admin.
 *
 * @param context
 * @returns
 */
export const isAdminInFirebaseModelContext: DecisionFunction<FirebaseModelContext> = (context: FirebaseModelContext) => context.auth?.isAdmin() ?? false;

/**
 * Grants the configured roles if the decision is made about the context. Otherwise, returns a NoAccessRoleMap.
 */
export type GrantRolesOnlyIfFunction<R extends string = string, C extends FirebaseModelContext = FirebaseModelContext> = (context: C) => GrantedRoleMap<R>;
export type GeneralGrantRolesOnlyIfFunction = <R extends string = string, C extends FirebaseModelContext = FirebaseModelContext>(context: C) => GrantedRoleMap<R>;

/**
 * Creates a GrantRolesOnlyIfFunction
 *
 * @param grantIf
 * @param grantedRoles
 * @returns
 */
export function grantModelRolesOnlyIfFunction<C extends FirebaseModelContext, R extends string = string>(grantIf: DecisionFunction<C>, grantedRoles: GetterOrValue<GrantedRoleMap<R>>): GrantRolesOnlyIfFunction<R, C> {
  const fn = grantModelRolesIfFunction<C, R>(grantIf, grantedRoles);
  return (context: C) => fn(context);
}

/**
 * Grants the configured roles if the decision is made about the context. Otherwise, invokes the otherwise function if available, or returns a NoAccessRoleMap.
 */
export type GrantRolesIfFunction<R extends string = string, C extends FirebaseModelContext = FirebaseModelContext> = (context: C, otherwise?: GrantRolesOtherwiseFunction<R>) => GrantedRoleMap<R>;
export type GeneralGrantRolesIfFunction = <R extends string = string, C extends FirebaseModelContext = FirebaseModelContext>(context: C, otherwise?: GrantRolesOtherwiseFunction<R>) => GrantedRoleMap<R>;

/**
 * Used as the "else" statement for grantModelRolesIfFunction.
 *
 * If no roles are returned, the grantModelRolesIfFunction() will return a NoAccessRoleMap.
 */
export type GrantRolesOtherwiseFunction<R extends string = string> = Getter<Maybe<GrantedRoleMap<R>>>;

/**
 * Creates a GrantRolesIfFunction.
 *
 * @param grantIf
 * @param grantedRoles
 * @returns
 */
export function grantModelRolesIfFunction<C extends FirebaseModelContext, R extends string = string>(grantIf: DecisionFunction<C>, grantedRoles: GetterOrValue<GrantedRoleMap<R>>): GrantRolesIfFunction<R, C> {
  return (context: C, otherwise: GrantRolesOtherwiseFunction<R> = noAccessRoleMap) => {
    const decision = grantIf(context);
    const results = decision ? getValueFromGetter(grantedRoles) : otherwise() ?? noAccessRoleMap();
    return results;
  };
}
