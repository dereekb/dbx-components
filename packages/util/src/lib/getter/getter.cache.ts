import { Maybe } from "../value/maybe";
import { Getter } from "./getter";

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
};

/**
 * Creates a CachedGetter from the input Getter.
 * 
 * The value will be retrieved once, then cached permenantly by this function.
 * 
 * @param getter 
 * @returns 
 */
export function cachedGetter<T>(getter: Getter<T>): CachedGetter<T> {
  let loaded: Maybe<{ value: T }>;

  const result = (() => {
    if (!loaded) {
      loaded = {
        value: getter()
      };
    }

    return loaded.value;
  }) as CachedGetter<T>;

  result.set = (value: T) => loaded = { value };
  result.reset = () => loaded = undefined;
  return result;
}
