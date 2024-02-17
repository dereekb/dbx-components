import { type Factory, type FactoryWithIndex, type FactoryWithRequiredInput, makeWithFactory, makeWithFactoryInput } from '../getter/getter';
import { type AsyncMapFunction } from '../value/map';

/**
 * Factory that generates multiple values given a number of items to make.
 */
export type ArrayFactory<T> = FactoryWithRequiredInput<T[], number>;

/**
 * Async ArrayFactory
 */
export type AsyncArrayFactory<T> = AsyncMapFunction<ArrayFactory<T>>;

/**
 * Factory that generates a value for each input value.
 */
export type ArrayInputFactory<I, O> = FactoryWithRequiredInput<O[], I[]>;

/**
 * Async ArrayInputFactory
 */
export type AsyncArrayInputFactory<I, O> = AsyncMapFunction<ArrayInputFactory<I, O>>;

/**
 * Creates a new ArrayFactory.
 *
 * @param factory
 * @returns
 */
export function arrayFactory<T>(factory: Factory<T> | FactoryWithIndex<T>): ArrayFactory<T> {
  return (count) => makeWithFactory(factory, count);
}

/**
 * Creates a ArrayInputFactory.
 *
 * @param factory
 * @returns
 */
export function arrayInputFactory<O, I>(factory: FactoryWithRequiredInput<O, I>): ArrayInputFactory<I, O> {
  return (input: I[]) => makeWithFactoryInput<O, I>(factory, input);
}

/**
 * Creates a factory that returns the items from the input array and returns null after the factory function has exhausted all array values.
 *
 * The factory can only be used once.
 *
 * @param array
 */
export function terminatingFactoryFromArray<T>(array: T[]): Factory<T | null>;
/**
 *
 * Creates a factory that returns the items from the input array and returns the terminating value if the input array is empty.
 *
 * @param array
 * @param terminatingValue
 */
export function terminatingFactoryFromArray<T, E>(array: T[], terminatingValue: E): Factory<T | E>;
export function terminatingFactoryFromArray<T, E>(array: T[], terminatingValue?: E): Factory<T | E> {
  if (arguments.length === 1) {
    terminatingValue = null as any;
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
