
/**
 * Function that returns a value.
 */
export type Getter<T> = () => T;

/**
 * Function that returns a value with a single argument.
 */
export type GetterWithInput<T, A> = (args?: A) => T;

/**
 * Either a Getter, or an instance of the item.
 */
export type ObjectOrGetter<T> = T | Getter<T>;

/**
 * Either a GetterWithInput, or a Getter.
 */
export type ObjectOrGetterWithInput<T, A> = Getter<T> | GetterWithInput<T, A>;

export type StringOrGetter = ObjectOrGetter<string>;

/**
 * If the input is a function, it is executed. Otherwise, the value is returned.
 * 
 * @param input 
 * @returns 
 */
export function getValueFromObjectOrGetter<T>(input: ObjectOrGetter<T>): T;
export function getValueFromObjectOrGetter<T>(this: any, input: ObjectOrGetter<T>, inputArgs?: any): T;
export function getValueFromObjectOrGetter<T, A>(this: any, input: ObjectOrGetterWithInput<T, A>, args?: A): T;
export function getValueFromObjectOrGetter<T, A>(this: any, input: ObjectOrGetterWithInput<T, A>, args?: A): T {
  if (typeof input === 'function') {
    return input(args);
  } else {
    return input;
  }
}

/**
 * Returns the input as a getter.
 * 
 * @param input 
 * @returns 
 */
export function asGetter<T>(input: ObjectOrGetter<T>): Getter<T> {
  if (typeof input === 'function') {
    return input as Getter<T>;
  } else {
    return () => input;
  }
}
