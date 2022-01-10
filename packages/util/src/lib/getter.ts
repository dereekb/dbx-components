
/**
 * Function that returns a value.
 */
export type Getter<T> = () => T;

/**
 * Either a Getter, or an instance of the item.
 */
export type ObjectOrGetter<T> = T | Getter<T>;

export type StringOrGetter = ObjectOrGetter<string>;

/**
 * If the input is a function, it is executed. Otherwise, the value is returned.
 * 
 * @param input 
 * @returns 
 */
export function getValueFromObjectOrGetter<T>(input: ObjectOrGetter<T>): T {
  if (typeof input === 'function') {
    return (input as () => T)();
  } else {
    return input;
  }
}
