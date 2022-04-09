import { Getter } from "./getter";

/**
 * Getter that returns a cached value.
 */
export type CachedGetter<T> = Getter<T>;

/**
 * Creates a CachedGetter from the input Getter.
 * 
 * The value will be retrieved once, then cached permenantly by this function.
 * 
 * @param getter 
 * @returns 
 */
export function cachedGetter<T>(getter: Getter<T>): CachedGetter<T> {
  let loaded: { value: T };

  return () => {
    if (!loaded) {
      loaded = {
        value: getter()
      };
    }

    return loaded.value;
  };
}
