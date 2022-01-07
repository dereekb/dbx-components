
/**
 * Function that returns a value.
 */
export type Getter<T> = () => T;

/**
 * Either a Getter, or an instance of the item.
 */
export type ObjectOrGetter<T> = T | Getter<T>;

export type StringOrGetter = ObjectOrGetter<string>;

export function useObjectGetter<T>(input: ObjectOrGetter<T>): T {
  if (typeof input === 'function') {
    return (input as () => T)();
  } else {
    return input;
  }
}
