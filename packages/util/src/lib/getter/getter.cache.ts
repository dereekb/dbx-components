import { type Maybe } from '../value/maybe.type';
import { type FactoryWithInput, type Getter } from './getter';

/**
 * Getter that returns a cached value.
 */
export type CachedGetter<T> = Getter<T> & {
  /**
   * Sets the value in the cache.
   *
   * @param value
   */
  set(value: T): void;

  /**
   * Resets/clears the cache.
   */
  reset(): void;

  /**
   * Re-initializes the getter and reloads the value from the source.
   */
  init(): void;
};

/**
 * A cached factory that stores the result of the first call and returns it on subsequent calls.
 * Supports optional input arguments for the initial factory call.
 */
export type CachedFactoryWithInput<T, A = unknown> = CachedGetter<T> &
  FactoryWithInput<T, A> & {
    /**
     * Re-initializes the cache using the factory function.
     *
     * @param input
     */
    init(input?: A): void;
  };

/**
 * Creates a CachedGetter from the input factory function.
 * The value is retrieved once on first call and cached permanently.
 * Use `reset()` to clear the cache and `init()` to reload.
 *
 * @param getter - the factory or getter function whose result will be cached
 * @returns A CachedFactoryWithInput that caches the first result
 */
export function cachedGetter<T>(getter: Getter<T>): CachedFactoryWithInput<T>;
export function cachedGetter<T, A = unknown>(factory: FactoryWithInput<T, A>): CachedFactoryWithInput<T, A>;
export function cachedGetter<T, A = unknown>(factory: FactoryWithInput<T, A>): CachedFactoryWithInput<T, A> {
  let loaded: Maybe<{ value: T }>;

  const init = (input?: A) => {
    loaded = {
      value: factory(input)
    };
  };

  const result = ((input?: A) => {
    if (!loaded) {
      init(input);
    }

    return (loaded as { value: T }).value;
  }) as CachedFactoryWithInput<T, A>;

  result.set = (value: T) => (loaded = { value });
  result.reset = () => (loaded = undefined);
  result.init = init;

  return result;
}
