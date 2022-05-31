import { asGetter, forEachKeyValue, Getter, GetterOrValue, ModelTypeString } from '@dereekb/util';

/**
 * Registry used to load model services when requested.
 */
export interface ModelServiceRegistry<S, T extends ModelTypeString = ModelTypeString> {
  /**
   * Returns the service for the type. If a service is not registered, will throw an exception.
   *
   * @param type
   */
  serviceForType(type: T): S;
}

/**
 * ModelServiceRegistry implementation.
 */
export class ModelServiceRegistryInstance<S, T extends ModelTypeString = ModelTypeString> implements ModelServiceRegistry<S, T> {
  private _map = new Map<T, Getter<S>>();

  registerServiceForType(type: T, service: GetterOrValue<S>): void {
    const getter = asGetter(service);
    this._map.set(type, getter);
  }

  serviceForType(type: T): S {
    const getter = this._map.get(type);
    const service = getter?.();

    if (service == null) {
      throw new Error(`no service registered for type "${type}"`);
    }

    return service;
  }
}

export interface ModelServiceRegistrySetupConfig<S, T extends ModelTypeString = ModelTypeString> {
  services: {
    [K in T]: S;
  };
}

/**
 * Creates a new ModelServiceRegistryInstance and registers the input types.
 * @returns
 */
export function modelServiceRegistry<S, T extends ModelTypeString = ModelTypeString>(config: ModelServiceRegistrySetupConfig<S, T>): ModelServiceRegistryInstance<S, T> {
  const instance = new ModelServiceRegistryInstance<S, T>();

  forEachKeyValue(config.services, {
    forEach: ([key, service]) => {
      instance.registerServiceForType(key, service);
    }
  });

  return instance;
}
