import { asGetter, Getter, GetterOrValue } from '../getter/getter';
import { forEachKeyValue } from '../object/object';

/**
 * Registry used to load model services when requested.
 */
export interface TypedServiceRegistry<S, T extends string = string> {
  /**
   * Returns the service for the type. If a service is not registered, will throw an exception.
   *
   * @param type
   */
  serviceForType(type: T): S;
}

/**
 * TypedServiceRegistry implementation.
 */
export class TypedServiceRegistryInstance<S, T extends string = string> implements TypedServiceRegistry<S, T> {
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

export interface TypedServiceRegistrySetupConfig<S, T extends string = string> {
  services: {
    [K in T]: S;
  };
}

/**
 * Creates a new TypedServiceRegistryInstance and registers the input types.
 * @returns
 */
export function typedServiceRegistry<S, T extends string = string>(config: TypedServiceRegistrySetupConfig<S, T>): TypedServiceRegistryInstance<S, T> {
  const instance = new TypedServiceRegistryInstance<S, T>();

  forEachKeyValue(config.services, {
    forEach: ([key, service]) => {
      instance.registerServiceForType(key, service);
    }
  });

  return instance;
}
