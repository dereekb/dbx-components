import { type Configurable } from '../type';

/**
 * Represents a mutable partial version of a normally read-only model, used during construction/configuration.
 *
 * Combines `Partial` and `Configurable` (writable) so that properties can be set incrementally before the object is treated as complete.
 */
export type Building<T> = Partial<Configurable<T>>;

/**
 * Function that mutates a {@link Building} instance to populate its properties.
 */
export type BuildFunction<T> = (base: Building<T>) => void;

/**
 * Configuration for the {@link build} function, providing the base object and the build function to apply.
 */
export interface BuildConfig<T extends object> {
  /**
   * Optional pre-existing partial object to build upon. If omitted, an empty object is used.
   */
  base?: Building<T>;
  /**
   * Function that mutates the base to populate it with the desired values.
   */
  build: BuildFunction<T>;
}

/**
 * Convenience function for imperatively constructing an object of a specific type by mutating a base object via a build function.
 *
 * This is useful when building objects whose type is normally read-only, allowing incremental property assignment during construction.
 *
 * @param config - the build configuration containing the base object and build function
 *
 * @example
 * ```ts
 * interface User { name: string; age: number; }
 *
 * const user = build<User>({
 *   base: {},
 *   build: (x) => { x.name = 'Alice'; x.age = 30; }
 * });
 * // user === { name: 'Alice', age: 30 }
 * ```
 */
export function build<T extends object>({ base, build }: BuildConfig<T>): T {
  const baseObject = base ?? {};
  build(baseObject);
  return baseObject as T;
}
