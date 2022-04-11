import { ConversionFunction } from "../value";
import { Getter } from "./getter";

// MARK: Map
export type MapGetterFactory<I, O> = (input: Getter<I>) => Getter<O>;

/**
 * Maps the input getter.
 * 
 * @param input 
 */
export function mapGetter<I, O>(input: Getter<I>, mapFn: ConversionFunction<I, O>): Getter<O> {
  return mapGetterFactory(mapFn)(input);
}

/**
 * Creates a MapGetter
 * 
 * @param input 
 */
export function mapGetterFactory<I, O>(mapFn: ConversionFunction<I, O>): MapGetterFactory<I, O> {
  return (getter: Getter<I>) => {
    return () => mapFn(getter());
  };
}
