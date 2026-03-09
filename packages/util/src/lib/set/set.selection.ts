import { type PrimativeKey, type ReadKeyFunction } from '../key';
import { type DecisionFunction } from '../value';

/**
 * Factory that creates a DecisionFunction using the input "selected" values. That function returns true if the value's key is considered to be included in the selected values.
 */
export type IsSelectedDecisionFunctionFactory<T, K extends PrimativeKey = PrimativeKey> = (selectedValues: Iterable<K>) => DecisionFunction<T>;

/**
 * Configuration for {@link isSelectedDecisionFunctionFactory}.
 */
export interface IsSelectedDecisionFunctionConfig<T, K extends PrimativeKey = PrimativeKey> {
  /**
   * Reads the key from the input value.
   */
  readKey: ReadKeyFunction<T, K>;
  /**
   * Default value to use if readKey returns no key.
   *
   * Defaults to false.
   */
  defaultIfKeyNull?: boolean;
}

/**
 * Creates an {@link IsSelectedDecisionFunctionFactory} that produces decision functions
 * checking whether a value's key is included in a set of selected values.
 *
 * @param config - Configuration with the key reader and default behavior.
 * @returns A factory that creates decision functions from a set of selected keys.
 */
export function isSelectedDecisionFunctionFactory<T, K extends PrimativeKey = PrimativeKey>(config: IsSelectedDecisionFunctionConfig<T, K>): IsSelectedDecisionFunctionFactory<T, K> {
  const { readKey, defaultIfKeyNull = false } = config;

  return (selectedValues: Iterable<K>) => {
    const selectedValuesSet = new Set(selectedValues);

    return (value: T) => {
      const key = readKey(value);
      return key != null ? selectedValuesSet.has(key) : defaultIfKeyNull;
    };
  };
}
