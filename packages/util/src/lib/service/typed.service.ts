import { asGetter, type Getter, type GetterOrValue } from '../getter/getter';
import { forEachKeyValue } from '../object/object.filter.tuple';

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

  /**
   * Registers a service (or getter) for the given type key.
   *
   * @param type - The type key to register the service under.
   * @param service - The service instance or a getter function that returns it.
   */
  registerServiceForType(type: T, service: GetterOrValue<S>): void {
    const getter = asGetter(service);
    this._map.set(type, getter);
  }

  /**
   * Returns the service registered for the given type. Throws if no service is registered.
   *
   * @param type - The type key to look up.
   * @returns The registered service instance.
   * @throws Error if no service is registered for the given type.
   */
  serviceForType(type: T): S {
    const getter = this._map.get(type);
    const service = getter?.();

    if (service == null) {
      throw new Error(`no service registered for type "${type}"`);
    }

    return service;
  }
}

/**
 * Configuration for initializing a {@link TypedServiceRegistryInstance} with a set of services.
 */
export interface TypedServiceRegistrySetupConfig<S, T extends string = string> {
  /**
   * A record mapping type keys to their service instances.
   */
  services: {
    [K in T]: S;
  };
}

/**
 * Creates a new {@link TypedServiceRegistryInstance} and registers all services from the provided config.
 *
 * @param config - Configuration containing the services to register.
 * @returns A new TypedServiceRegistryInstance with all services registered.
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
