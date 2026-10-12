import { asGetter, type Getter, type GetterOrValue } from '../getter/getter';
import { forEachKeyValue } from '../object/object.filter.tuple';
import { type Maybe } from '../value/maybe.type';

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
   * @throws {Error} If no service is registered for the given type.
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
  readonly services: {
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

// MARK: Typed Config Registry
/**
 * Immutable registry of configs keyed by type, with a fallback config for types that are not registered.
 *
 * Unlike {@link TypedServiceRegistry}, a lookup for an unknown type does not throw. It falls back to a default config instead, so work over stored data (such as a scheduled sweep) does not stop on one unknown type.
 *
 * Every member is a closure without `this`, so a domain-specific service can re-expose the members under its own names.
 */
export interface TypedConfigRegistry<C, T extends string = string> {
  /**
   * The record of registered configs, keyed by type.
   */
  readonly configs: Record<T, C>;
  /**
   * Returns the registered config for the type, or the default config for the type if none is registered.
   *
   * @param type - The type key to look up.
   */
  configForType(type: T): C;
  /**
   * Returns the registered config for the type, if one is registered.
   *
   * @param type - The type key to look up.
   */
  registeredConfigForType(type: T): Maybe<C>;
  /**
   * Returns a copy of the registered types, in registration order.
   */
  getAllKnownTypes(): T[];
  /**
   * Returns a copy of the registered configs, in registration order.
   */
  getAllKnownConfigs(): C[];
}

/**
 * Configuration for {@link typedConfigRegistry}.
 */
export interface TypedConfigRegistrySetupConfig<C, T extends string = string> {
  /**
   * The record of registered configs, keyed by type.
   */
  readonly configs: Record<T, C>;
  /**
   * Returns the config used for a type that is not registered.
   *
   * @param type - The type that is not registered.
   */
  readonly defaultConfigForType: (type: T) => C;
}

/**
 * Creates a {@link TypedConfigRegistry} over a record of configs.
 *
 * Lookups read the passed record with an own-property check, so a type such as `constructor` never resolves to an `Object.prototype` member. The known types and configs are captured when the registry is created and returned as copies.
 *
 * @param config - The configs and the fallback for unregistered types.
 * @returns A registry whose members can be re-exposed under domain-specific names.
 *
 * @dbxUtil
 * @dbxUtilCategory service
 * @dbxUtilKind factory
 * @dbxUtilTags service, registry, config, type, lookup, fallback, default
 * @dbxUtilRelated array-to-object
 *
 * @example
 * ```ts
 * const registry = typedConfigRegistry({
 *   configs: { a: { type: 'a', label: 'A' } },
 *   defaultConfigForType: (type) => ({ type, label: 'Unknown' })
 * });
 *
 * registry.configForType('a'); // { type: 'a', label: 'A' }
 * registry.configForType('b'); // { type: 'b', label: 'Unknown' }
 * registry.registeredConfigForType('b'); // undefined
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function typedConfigRegistry<C, T extends string = string>(config: TypedConfigRegistrySetupConfig<C, T>): TypedConfigRegistry<C, T> {
  const { configs, defaultConfigForType } = config;
  const allKnownTypes = Object.keys(configs) as T[];
  const allKnownConfigs = allKnownTypes.map((x) => configs[x]);

  function registeredConfigForType(type: T): Maybe<C> {
    return Object.hasOwn(configs, type) ? configs[type] : undefined;
  }

  return {
    configs,
    configForType: (type) => registeredConfigForType(type) ?? defaultConfigForType(type),
    registeredConfigForType,
    getAllKnownTypes: () => [...allKnownTypes],
    getAllKnownConfigs: () => [...allKnownConfigs]
  };
}
