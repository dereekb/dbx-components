import { type MapFunction } from '../value/map';
import { type Getter } from './getter';

// MARK: Map
/**
 * Factory that transforms a Getter of type I into a Getter of type O.
 */
export type MapGetterFactory<I, O> = (input: Getter<I>) => Getter<O>;

/**
 * Creates a new Getter that applies a mapping function to the result of the input Getter.
 *
 * @param input - The source Getter
 * @param mapFn - The mapping function to apply to the getter's value
 * @returns A new Getter that returns the mapped value
 */
export function mapGetter<I, O>(input: Getter<I>, mapFn: MapFunction<I, O>): Getter<O> {
  return mapGetterFactory(mapFn)(input);
}

/**
 * Creates a factory that wraps Getters with a mapping function.
 *
 * @param mapFn - The mapping function to apply
 * @returns A factory that transforms Getters of type I to Getters of type O
 */
export function mapGetterFactory<I, O>(mapFn: MapFunction<I, O>): MapGetterFactory<I, O> {
  return (getter: Getter<I>) => {
    return () => mapFn(getter());
  };
}
