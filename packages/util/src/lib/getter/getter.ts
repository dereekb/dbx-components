
/**
 * Function that returns a value.
 */
export type Getter<T> = () => T;

/**
 * Getter with the design of returning a new value each time.
 */
export type Factory<T> = Getter<T>;

/**
 * Function that returns a value with an optional single argument.
 */
export type FactoryWithInput<T, A> = (args?: A) => T;

/**
 * Function that returns a value with a single argument.
 */
export type FactoryWithRequiredInput<T, A> = (args: A) => T;

/**
 * Either a Getter, or an instance of the item.
 */
export type GetterOrValue<T> = T | Getter<T>;

/**
 * Either a GetterWithInput, or a Getter.
 */
export type GetterOrValueWithInput<T, A> = Getter<T> | FactoryWithInput<T, A>;

export type StringOrGetter = GetterOrValue<string>;

/**
 * Returns true if the input object looks like a Getter (is a function).
 * 
 * @param value 
 * @returns 
 */
export function isGetter<T = any>(value: any): value is Getter<T> {
  return (typeof value === 'function');
}

/**
 * If the input is a function, it is executed. Otherwise, the value is returned.
 * 
 * @param input 
 * @returns 
 */
export function getValueFromGetter<T>(input: GetterOrValue<T>): T;
export function getValueFromGetter<T>(this: any, input: GetterOrValue<T>): T;
export function getValueFromGetter<T>(this: any, input: GetterOrValue<T>, inputArgs?: any): T;
export function getValueFromGetter<T, A>(this: any, input: GetterOrValueWithInput<T, A>, args?: A): T;
export function getValueFromGetter<T, A>(this: any, input: GetterOrValueWithInput<T, A>, args?: A): T {
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
export function asGetter<T>(input: GetterOrValue<T>): Getter<T> {
  if (typeof input === 'function') {
    return input as Getter<T>;
  } else {
    return makeGetter(input);
  }
}

/**
 * Wraps the input and returns a Getter for that value.
 * 
 * @param input 
 * @returns 
 */
export function makeGetter<T>(input: T): Getter<T> {
  return () => input;
}
