import { copyObject, type CopyObjectFunction } from '../object/object';
import { type PromiseOrValue } from '../promise/promise.type';
import { type ClassType, isNonClassFunction } from '../type';
import { type MapFunction } from '../value/map';
import { type Maybe } from '../value/maybe.type';

/**
 * Function that returns a value.
 */
export type Getter<T> = () => T;

/**
 * Getter with the design of returning a new value each time.
 */
export type Factory<T> = Getter<T>;

/**
 * Getter that returns a promise.
 */
export type AsyncFactory<T> = Factory<Promise<T>>;

/**
 * Function that returns a value with an optional single argument.
 */
export type FactoryWithInput<O, I> = (args?: I) => O;

/**
 * Function that returns a value with a single argument.
 */
export type FactoryWithRequiredInput<T, A> = MapFunction<A, T>;

/**
 * Either a Getter, or an instance of the item.
 */
export type GetterOrValue<T> = T | Getter<T>;

/**
 * A GetterOrValue returned from a Promise.
 */
export type AsyncGetterOrValue<T> = GetterOrValue<PromiseOrValue<T>>;

/**
 * Either a GetterWithInput, or a Getter.
 */
export type GetterOrFactoryWithInput<T, A> = Getter<T> | FactoryWithInput<T, A>;

/**
 * Types of values that can safely be retrieved via getValueFromGetter() or asGetter().
 */
export type GetterDistinctValue = boolean | string | number | object | symbol | ClassType;

/**
 * Either a GetterOrValue, or a FactoryWithInput.
 */
export type GetterOrValueWithInput<T extends GetterDistinctValue, A> = GetterOrValue<T> | FactoryWithInput<T, A>;

export type StringOrGetter = GetterOrValue<string>;

/**
 * Returns true if the input value is a non-class function (i.e., likely a Getter).
 *
 * @param value - The value to check
 * @returns True if the value is a non-class function
 */
export function isGetter<T = unknown>(value: unknown): value is Getter<T> {
  return isNonClassFunction(value);
}

/**
 * If the input is a function, it is executed and the result returned. Otherwise, the value itself is returned.
 *
 * @param input - A value or a getter/factory function
 * @returns The resolved value
 */
export function getValueFromGetter<T>(input: GetterOrValue<T>): T;
export function getValueFromGetter<T>(this: unknown, input: GetterOrValue<T>): T;
export function getValueFromGetter<T, A>(this: unknown, input: FactoryWithRequiredInput<T, A>, args: A): T;
export function getValueFromGetter<T, A>(this: unknown, input: GetterOrFactoryWithInput<T, A>, args?: A): T;
export function getValueFromGetter<T extends GetterDistinctValue, A>(this: unknown, input: GetterOrValueWithInput<T, A>, args?: A): T;
export function getValueFromGetter<T, A>(this: unknown, input: unknown, args?: A): T {
  return isNonClassFunction(input) ? (input as (...fnArgs: unknown[]) => T)(args) : (input as T);
}

/**
 * Wraps the input as a Getter function. If it's already a function, returns it directly.
 *
 * @param input - A value or getter function
 * @returns A Getter function that returns the value
 */
export function asGetter<T>(input: GetterOrValue<T>): Getter<T> {
  return isNonClassFunction(input) ? (input as Getter<T>) : () => input as T;
}

/**
 * A factory that returns a copy of a value.
 */
export type ObjectCopyFactory<T> = Factory<T>;

/**
 * Creates a factory that returns a shallow copy of the input value on each call.
 *
 * @param value - The object to copy
 * @param copyFunction - Optional custom copy function (defaults to copyObject)
 * @returns A factory that produces copies of the value
 */
export function objectCopyFactory<T extends object>(value: T, copyFunction: CopyObjectFunction<T> = copyObject): ObjectCopyFactory<T> {
  return () => copyFunction(value);
}

/**
 * Converts the input to an ObjectCopyFactory. If the input is an object, wraps it with objectCopyFactory.
 * If it's already a function (Getter), it's returned directly.
 *
 * @param input - An object value or a getter function
 * @param copyFunction - Optional custom copy function
 * @returns An ObjectCopyFactory for the input
 */
export function asObjectCopyFactory<T>(input: T | ObjectCopyFactory<T>, copyFunction?: CopyObjectFunction<T>): ObjectCopyFactory<T> {
  return typeof input === 'object' ? objectCopyFactory<any>(input, copyFunction) : asGetter(input);
}

/**
 * Wraps the input value in a Getter function that always returns it.
 *
 * @param input - The value to wrap
 * @returns A Getter that returns the input value
 */
export function makeGetter<T>(input: T): Getter<T> {
  return () => input;
}

/**
 * A factory that can take in an index input optionally.
 */
export type FactoryWithIndex<T> = FactoryWithInput<T, number> | FactoryWithRequiredInput<T, number>;

/**
 * Calls a factory function the specified number of times and returns the results as an array.
 *
 * @param factory - The factory function to call (receives the current index as argument)
 * @param count - The number of items to create
 * @returns An array of produced values
 */
export function makeWithFactory<T>(factory: Factory<T> | FactoryWithIndex<T>, count: number): T[] {
  const results: T[] = [];

  for (let i = 0; i < count; i += 1) {
    results.push(factory(i));
  }

  return results;
}

/**
 * Maps an array of inputs through a factory function to produce an array of outputs.
 *
 * @param factory - The factory function to call with each input
 * @param input - The array of inputs to pass to the factory
 * @returns An array of produced values
 */
export function makeWithFactoryInput<T, A>(factory: FactoryWithInput<T, A>, input: Maybe<A>[]): T[];
export function makeWithFactoryInput<T, A>(factory: FactoryWithRequiredInput<T, A>, input: A[]): T[];
export function makeWithFactoryInput<T, A>(factory: FactoryWithRequiredInput<T, A>, input: A[]): T[] {
  return input.map((x) => factory(x));
}

/**
 * Wraps a factory so that no arguments are forwarded when it's called.
 * Useful for protecting a factory from accidentally receiving arguments.
 *
 * @param factory - The factory to wrap
 * @returns A new factory that calls the original with no arguments
 */
export function protectedFactory<T>(factory: Factory<T>): Factory<T> {
  return () => factory();
}
