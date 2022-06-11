import { Factory, FactoryWithIndex, FactoryWithRequiredInput, makeWithFactory, makeWithFactoryInput } from '../getter/getter';

/**
 * Factory that generates multiple values given a number of items to make.
 */
export type ArrayFactory<T> = FactoryWithRequiredInput<T[], number>;

/**
 * Factory that generates a value for each input value.
 */
export type ArrayInputFactory<I, O> = FactoryWithRequiredInput<O[], I[]>;

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
