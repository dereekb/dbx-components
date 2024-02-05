import { type Factory, type FactoryWithRequiredInput } from '../getter';

export type StringFactory<K extends string = string> = Factory<K>;

export type ToStringFunction<T, K extends string = string> = FactoryWithRequiredInput<K, T>;

/**
 * Wraps another factory with a ToStringFactory function to generate strings from the original factory.
 *
 * @param factory
 * @param toStringFunction
 * @returns
 */
export function stringFactoryFromFactory<T, K extends string = string>(factory: Factory<T>, toStringFunction: ToStringFunction<T, K>): StringFactory<K> {
  return () => toStringFunction(factory());
}
