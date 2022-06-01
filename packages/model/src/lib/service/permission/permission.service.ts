import { PromiseOrValue, Maybe, ModelKey, ModelTypeString } from '@dereekb/util';
import { ModelLoader } from '../loader/model.loader';
import { contextGrantedModelRoles, ContextGrantedModelRoles, noAccessContextGrantedModelRoles } from './permission';
import { GrantedRoleMap } from './role';

/**
 * Full model permission service that can read permissions for models by key or for an input model.
 */
export interface ModelPermissionService<C, T, R extends string = string, O = T> extends ModelOnlyModelPermissionService<C, T, R, O>, KeyOnlyModelPermissionService<C, T, R, O> {}

/**
 * Used for retrieving permissions for a specific model.
 */
export interface ModelOnlyModelPermissionService<C, T, R extends string = string, O = T> {
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
export interface KeyOnlyModelPermissionService<C, T, R extends string = string, O = T> {
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
export abstract class AbstractModelPermissionService<C, T, R extends string = string, O = T> implements ModelPermissionService<C, T, R, O> {
  constructor(readonly modelLoader: ModelLoader<C, T>) {}

  async rolesMapForKeyContext(key: string, context: C): Promise<ContextGrantedModelRoles<O, C, R>> {
    const model = await this.modelLoader.loadModelForKey(key, context);
    let result: ContextGrantedModelRoles<O, C, R>;

    if (model != null) {
      result = await this.rolesMapForModelContext(model, context);
    } else {
      result = noAccessContextGrantedModelRoles<O, C, R>(context);
    }

    return result;
  }

  async rolesMapForModelContext(model: T, context: C): Promise<ContextGrantedModelRoles<O, C, R>> {
    const output: Maybe<O> = await this.outputForModel(model, context);
    let result: ContextGrantedModelRoles<O, C, R>;

    if (output != null && this.isUsableOutputForRoles(output, context)) {
      result = await this.getRolesMapForOutput(output, context, model);
    } else {
      result = noAccessContextGrantedModelRoles<O, C, R>(context, output);
    }

    return result;
  }

  protected async getRolesMapForOutput(output: O, context: C, model: T): Promise<ContextGrantedModelRoles<O, C, R>> {
    const rolesMap = await this.rolesMapForModel(output, context, model);
    return contextGrantedModelRoles<O, C, R>(context, output, rolesMap);
  }

  protected abstract outputForModel(model: T, context: C): PromiseOrValue<Maybe<O>>;

  protected isUsableOutputForRoles(output: O, context: C) {
    return true; // can override in parent functions to further filter roles.
  }

  protected abstract rolesMapForModel(output: O, context: C, model: T): PromiseOrValue<GrantedRoleMap<R>>;
}

/**
 * Used to retrieve a ModelPermissionService for a specific type.
 */
export interface ModelsPermissionService<C> {
  modelPermissions<T, R extends string = string, O = T>(type: ModelTypeString): ModelPermissionService<C, T, R, O>;
}

// MARK: InContext
/**
 * Used for retrieving permissions for a specific model.
 */
export interface InContextModelOnlyModelPermissionService<C, T, R extends string = string, O = T> {
  /**
   * Returns roles for the model given the input context.
   * @param model
   * @param context
   */
  rolesMapForModel(model: T): Promise<ContextGrantedModelRoles<O, C, R>>;
}

/**
 * Used for retrieving permissions for a specific model by their key.
 */
export interface InContextKeyOnlyModelPermissionService<C, T, R extends string = string, O = T> {
  /**
   * Returns roles for the model given the input context.
   * @param model
   * @param context
   */
  rolesMapForKey(key: ModelKey): Promise<ContextGrantedModelRoles<O, C, R>>;
}

/**
 * ModelsPermissionService that has a context.
 */
export interface InContextModelPermissionService<C, T, R extends string = string, O = T> extends InContextModelOnlyModelPermissionService<C, T, R, O>, InContextKeyOnlyModelPermissionService<C, T, R, O> {}
