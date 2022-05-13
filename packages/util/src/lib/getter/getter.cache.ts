import { Maybe } from "../value/maybe";
import { FactoryWithInput, Getter } from "./getter";

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

export type CachedFactoryWithInput<T, A = any> = CachedGetter<T> & FactoryWithInput<T, A> & {

  /**
   * Re-initializes the cache using the factory function.
   * 
   * @param input 
   */
  init(input?: A): void;

};

/**
 * Creates a CachedGetter from the input Getter.
 * 
 * The value will be retrieved once, then cached permenantly by this function.
 * 
 * @param getter 
 * @returns 
 */
export function cachedGetter<T>(getter: Getter<T>): CachedFactoryWithInput<T>;
export function cachedGetter<T, A = any>(factory: FactoryWithInput<T, A>): CachedFactoryWithInput<T, A>;
export function cachedGetter<T, A = any>(factory: FactoryWithInput<T, A>): CachedFactoryWithInput<T, A> {
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

    return loaded!.value;
  }) as CachedFactoryWithInput<T, A>;

  result.set = (value: T) => loaded = { value };
  result.reset = () => loaded = undefined;
  result.init = init;

  return result;
}
