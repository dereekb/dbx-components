import { FirestoreDocument } from './../../firestore';
import { AbstractModelPermissionService, GrantedRoleMap, InContextModelPermissionService, InModelContextModelPermissionService, ModelPermissionService } from '@dereekb/model';
import { Maybe, PromiseOrValue } from '@dereekb/util';
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
