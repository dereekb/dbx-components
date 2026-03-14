import { type FirestoreDocument } from './../../firestore';
import { AbstractModelPermissionService, type GrantedRoleMap, type InContextModelPermissionService, type InModelContextModelPermissionService, type ModelPermissionService } from '@dereekb/model';
import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type FirebaseModelLoader, type InModelContextFirebaseModelLoader } from '../model/model.loader';
import { type FirebaseModelContext } from '../context';
import { type FirebasePermissionServiceModel } from './permission';

/**
 * Permission service interface for a single Firebase model type, specialized from {@link ModelPermissionService}.
 */
export type FirebaseModelPermissionService<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = ModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>>;

/**
 * Delegate that provides model loading and role mapping for a {@link FirebaseModelPermissionServiceInstance}.
 *
 * The `roleMapForModel` function is the core of the permission system — it examines the loaded model data
 * and context to produce a {@link GrantedRoleMap} of what the current user can do.
 */
export interface FirebasePermissionServiceInstanceDelegate<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends FirebaseModelLoader<C, T, D> {
  roleMapForModel(output: FirebasePermissionServiceModel<T, D>, context: C, model: D): PromiseOrValue<GrantedRoleMap<R>>;
}

/**
 * Concrete permission service implementation for Firebase models.
 *
 * Loads the document snapshot, checks existence, and delegates role computation to the configured delegate.
 * Used internally by {@link firebaseModelPermissionService}.
 */
export class FirebaseModelPermissionServiceInstance<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> extends AbstractModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>> implements FirebaseModelPermissionService<C, T, D, R> {
  private readonly _delegate: FirebasePermissionServiceInstanceDelegate<C, T, D, R>;

  constructor(delegate: FirebasePermissionServiceInstanceDelegate<C, T, D, R>) {
    super(delegate);
    this._delegate = delegate;
  }

  get delegate(): FirebasePermissionServiceInstanceDelegate<C, T, D, R> {
    return this._delegate;
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

/**
 * Creates a {@link FirebaseModelPermissionServiceInstance} from a delegate.
 *
 * @param delegate - provides model loading and role computation
 */
export function firebaseModelPermissionService<C extends FirebaseModelContext, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string>(delegate: FirebasePermissionServiceInstanceDelegate<C, T, D, R>): FirebaseModelPermissionServiceInstance<C, T, D, R> {
  return new FirebaseModelPermissionServiceInstance(delegate);
}

// MARK: InContext
/**
 * Context-bound permission service — evaluates roles for any model by key or document.
 */
export type InContextFirebaseModelPermissionService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = InContextModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>>;

// MARK: InModelContext
/**
 * Fully bound permission service for a specific model and context — provides the computed role map.
 */
export type InModelContextFirebaseModelPermissionService<C, T, D extends FirestoreDocument<T> = FirestoreDocument<T>, R extends string = string> = InModelContextModelPermissionService<C, D, R, FirebasePermissionServiceModel<T, D>> & InModelContextFirebaseModelLoader<T, D>;
