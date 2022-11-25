import { iterableToArray } from '../iterable';
import { PrimativeKey, ReadKeyFunction } from '../key';
import { DecisionFunction } from '../value';

/**
 * Factory that creates a DecisionFunction using the input "selected" values. That function returns true if the value's key is considered to be included in the selected values.
 */
export type IsSelectedDecisionFunctionFactory<T, K extends PrimativeKey = PrimativeKey> = (selectedValues: Iterable<K>) => DecisionFunction<T>;

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
 * Creates a IsSelectedDecisionFunctionFactory
 *
 * @param config
 * @returns
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
