import { PromiseOrValue, Maybe, ModelKey, ModelTypeString } from '@dereekb/util';
import { ModelLoader } from '../loader/model.loader';
import { contextGrantedModelRoles, ContextGrantedModelRoles, emptyContextGrantedModelRoles } from './permission';
import { GrantedRoleMap } from './role';

/**
 * Full model permission service that can read permissions for models by key or for an input model.
 */
export interface ModelPermissionService<T, C, R extends string = string, O = T> extends ModelOnlyModelPermissionService<T, C, R, O>, KeyOnlyModelPermissionService<T, C, R, O> {}

/**
 * Used for retrieving permissions for a specific model.
 */
export interface ModelOnlyModelPermissionService<T, C, R extends string = string, O = T> {
  /**
   * Returns roles for the model given the input context.
   * @param model
   * @param context
   */
  rolesMapForModelContext(model: T, context: C): Promise<ContextGrantedModelRoles<O, C, R>>;
}

/**
 * Used for retrieving permissions for a specific model by their key.
 */
export interface KeyOnlyModelPermissionService<T, C, R extends string = string, O = T> {
  /**
   * Returns roles for the model given the input context.
   * @param model
   * @param context
   */
  rolesMapForKeyContext(key: ModelKey, context: C): Promise<ContextGrantedModelRoles<O, C, R>>;
}

/**
 * Abstract ModelPermissionService implementation.
 */
export abstract class AbstractModelPermissionService<T, C, R extends string = string, O = T> implements ModelPermissionService<T, C, R, O> {
  constructor(readonly modelLoader: ModelLoader<C, T>) {}

  async rolesMapForKeyContext(key: string, context: C): Promise<ContextGrantedModelRoles<O, C, R>> {
    const model = await this.modelLoader.loadModelForKey(key, context);
    let result: ContextGrantedModelRoles<O, C, R>;

    if (model != null) {
      result = await this.rolesMapForModelContext(model, context);
    } else {
      result = emptyContextGrantedModelRoles<O, C, R>(context);
    }

    return result;
  }

  async rolesMapForModelContext(model: T, context: C): Promise<ContextGrantedModelRoles<O, C, R>> {
    const output = await this.outputForModel(model, context);
    let result: ContextGrantedModelRoles<O, C, R>;

    if (output != null) {
      const rolesMap = await this.rolesMapForModel(output, context, model);
      result = contextGrantedModelRoles<O, C, R>(output, context, rolesMap);
    } else {
      result = emptyContextGrantedModelRoles<O, C, R>(context);
    }

    return result;
  }

  protected abstract outputForModel(model: T, context: C): PromiseOrValue<Maybe<O>>;

  protected abstract rolesMapForModel(output: O, context: C, model: T): PromiseOrValue<GrantedRoleMap<R>>;
}

/**
 * Used to retrieve a ModelPermissionService for a specific type.
 */
export interface ModelsPermissionService<C> {
  modelPermissions<T, R extends string = string, O = T>(type: ModelTypeString): ModelPermissionService<T, C, R, O>;
}
