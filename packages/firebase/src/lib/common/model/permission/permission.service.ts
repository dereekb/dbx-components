import { DocumentSnapshot, FirestoreDocument } from './../../firestore';
import { AbstractModelPermissionService, fullAccessGrantedModelRoles, GrantedRoleMap, InContextModelPermissionService, ModelPermissionService } from '@dereekb/model';
import { Maybe, PromiseOrValue } from '@dereekb/util';
import { FirebaseModelLoader } from '../model/model.loader';
import { FirebaseModelContext } from '../context';

export interface FirebasePermissionServiceModel<T, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly document: D;
  readonly snapshot: DocumentSnapshot<T>;
  readonly exists: boolean;
  readonly data: Maybe<T>;
}

export type FirebaseModelPermissionService<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = ModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>>;

export interface FirebasePermissionServiceInstanceDelegate<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends FirebaseModelLoader<C, T, D> {
  rolesMapForModel(output: FirebasePermissionServiceModel<T, D>, context: C, model: D): PromiseOrValue<GrantedRoleMap<R>>;
}

/**
 * Abstract AbstractModelPermissionService implementation for FirebaseModelsPermissionService.
 */
export class FirebaseModelPermissionServiceInstance<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends AbstractModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>> implements FirebaseModelPermissionService<C, T, D, R> {
  constructor(readonly delegate: FirebasePermissionServiceInstanceDelegate<C, T, D, R>) {
    super(delegate);
  }

  rolesMapForModel(output: FirebasePermissionServiceModel<T, D>, context: C, model: D): PromiseOrValue<GrantedRoleMap<R>> {
    return this.delegate.rolesMapForModel(output, context, model);
  }

  protected async outputForModel(document: D): Promise<Maybe<FirebasePermissionServiceModel<T, D>>> {
    const snapshot = await document.accessor.get();
    const data = snapshot.data();

    const model: Maybe<FirebasePermissionServiceModel<T, D>> = { document, snapshot, data, exists: data != null };
    return model;
  }

  protected override async getRolesMapForOutput(output: FirebasePermissionServiceModel<T, D>, context: C, model: D) {
    if (context.adminGetsAllowAllRoles && context.auth?.isAdmin?.()) {
      return fullAccessGrantedModelRoles(context, output);
    } else {
      return super.getRolesMapForOutput(output, context, model);
    }
  }

  protected override isUsableOutputForRoles(output: FirebasePermissionServiceModel<T, D>) {
    return output.exists;
  }
}

export function firebaseModelPermissionService<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string>(delegate: FirebasePermissionServiceInstanceDelegate<C, T, D, R>): FirebaseModelPermissionServiceInstance<C, T, D, R> {
  return new FirebaseModelPermissionServiceInstance(delegate);
}

// MARK: InContext
export type InContextFirebaseModelPermissionService<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = InContextModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>>;
