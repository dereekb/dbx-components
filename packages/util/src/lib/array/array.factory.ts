import { type Factory, type FactoryWithIndex, type FactoryWithRequiredInput, makeWithFactory, makeWithFactoryInput } from '../getter/getter';
import type { Maybe } from '@dereekb/util';
import { type AsyncMapFunction } from '../value/map';

/**
 * Factory that generates multiple values given a number of items to make.
 * Takes a count parameter and returns an array of generated items.
 */
export type ArrayFactory<T> = FactoryWithRequiredInput<T[], number>;

/**
 * Async version of ArrayFactory that returns a promise resolving to an array of items.
 */
export type AsyncArrayFactory<T> = AsyncMapFunction<ArrayFactory<T>>;

/**
 * Factory that generates a value for each input value.
 * Takes an array of input values and returns an array of output values.
 */
export type ArrayInputFactory<I, O> = FactoryWithRequiredInput<O[], I[]>;

/**
 * Async version of ArrayInputFactory that returns a promise resolving to an array of output values.
 */
export type AsyncArrayInputFactory<I, O> = AsyncMapFunction<ArrayInputFactory<I, O>>;

/**
 * Creates a new ArrayFactory that generates multiple values.
 *
 * @param factory - Per-item producer invoked once per requested element.
 * @returns Count-driven generator that materializes the requested number of items.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilKind factory
 * @dbxUtilTags array, factory, generate, make, build, create
 * @dbxUtilRelated array-input-factory, terminating-factory-from-array
 *
 * @__NO_SIDE_EFFECTS__
 */
export function arrayFactory<T>(factory: Factory<T> | FactoryWithIndex<T>): ArrayFactory<T> {
  return (count) => makeWithFactory(factory, count);
}

/**
 * Creates an ArrayInputFactory that transforms input values into output values.
 *
 * @param factory - Per-element producer invoked with each input value plus its index.
 * @returns Adapter that runs `factory` against every input element to produce the mapped output array.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilKind factory
 * @dbxUtilTags array, factory, transform, map, generate, build
 * @dbxUtilRelated array-factory
 *
 * @__NO_SIDE_EFFECTS__
 */
export function arrayInputFactory<O, I>(factory: FactoryWithRequiredInput<O, I>): ArrayInputFactory<I, O> {
  return (input: I[]) => makeWithFactoryInput<O, I>(factory, input);
}

/**
 * Creates a factory that returns the items from the input array and returns null after the factory function has exhausted all array values.
 *
 * The factory can only be used once as it maintains internal state.
 *
 * @param array - The source array to pull values from
 * @returns A factory function that returns items from the array or null when exhausted
 */
export function terminatingFactoryFromArray<T>(array: T[]): Factory<Maybe<T>>;

/**
 * Creates a factory that returns the items from the input array and returns the specified terminating value when the array is exhausted.
 *
 * @param array - The source array to pull values from
 * @param terminatingValue - The value to return when all array items have been consumed
 * @returns A factory function that returns items from the array or the terminating value when exhausted
 */
export function terminatingFactoryFromArray<T, E>(array: T[], terminatingValue: E): Factory<T | E>;
export function terminatingFactoryFromArray<T, E>(array: T[], terminatingValue?: E): Factory<T | E> {
  if (arguments.length === 1) {
    terminatingValue = null as unknown as E;
  }

  let index = 0;

  return () => {
    let result: T | E;

    if (array.length > index) {
      result = array[index];
      index += 1;
    } else {
      result = terminatingValue as E;
    }

    return result;
  };
}
