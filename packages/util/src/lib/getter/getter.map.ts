import { type MapFunction } from '../value/map';
import { type Getter } from './getter';

// MARK: Map
export type MapGetterFactory<I, O> = (input: Getter<I>) => Getter<O>;

/**
 * Maps the input getter.
 *
 * @param input
 */
export function mapGetter<I, O>(input: Getter<I>, mapFn: MapFunction<I, O>): Getter<O> {
  return mapGetterFactory(mapFn)(input);
}

/**
 * Creates a MapGetter
 *
 * @param input
 */
export function mapGetterFactory<I, O>(mapFn: MapFunction<I, O>): MapGetterFactory<I, O> {
  return (getter: Getter<I>) => {
    return () => mapFn(getter());
  };
}
