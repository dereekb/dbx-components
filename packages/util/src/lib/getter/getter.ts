import { PromiseOrValue } from '../promise/promise';
import { MapFunction } from '../value/map';
import { Maybe } from '../value/maybe.type';

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
 * Either a GetterOrValue, or a FactoryWithInput.
 */
export type GetterOrValueWithInput<T extends string | number | object | symbol, A> = GetterOrValue<T> | FactoryWithInput<T, A>;

export type StringOrGetter = GetterOrValue<string>;

/**
 * Returns true if the input object looks like a Getter (is a function).
 *
 * @param value
 * @returns
 */
export function isGetter<T = unknown>(value: unknown): value is Getter<T> {
  return typeof value === 'function';
}

/**
 * If the input is a function, it is executed. Otherwise, the value is returned.
 *
 * @param input
 * @returns
 */
export function getValueFromGetter<T>(input: GetterOrValue<T>): T;
export function getValueFromGetter<T>(this: unknown, input: GetterOrValue<T>): T;
export function getValueFromGetter<T>(this: unknown, input: GetterOrValue<T>, inputArgs?: unknown): T;
export function getValueFromGetter<T, A>(this: unknown, input: GetterOrFactoryWithInput<T, A>, args?: A): T;
export function getValueFromGetter<T extends string | number | object | symbol, A>(this: unknown, input: GetterOrValueWithInput<T, A>, args?: A): T;
export function getValueFromGetter<T, A>(this: unknown, input: unknown, args?: A): T {
  if (typeof input === 'function') {
    return input(args);
  } else {
    return input as T;
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

/**
 * A factory that can take in an index input optionally.
 */
export type FactoryWithIndex<T> = FactoryWithInput<T, number> | FactoryWithRequiredInput<T, number>;

export function makeWithFactory<T>(factory: Factory<T> | FactoryWithIndex<T>, count: number): T[] {
  const results: T[] = [];

  for (let i = 0; i < count; i += 1) {
    results.push(factory(i));
  }

  return results;
}

export function makeWithFactoryInput<T, A>(factory: FactoryWithInput<T, A>, input: Maybe<A>[]): T[];
export function makeWithFactoryInput<T, A>(factory: FactoryWithRequiredInput<T, A>, input: A[]): T[];
export function makeWithFactoryInput<T, A>(factory: FactoryWithRequiredInput<T, A>, input: A[]): T[] {
  return input.map((x) => factory(x));
}
