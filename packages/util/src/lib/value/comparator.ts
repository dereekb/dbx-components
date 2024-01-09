import { Building } from './build';
import { ReadValueFunction } from './map';
import { Maybe } from './maybe.type';

/**
 * A comparator that returns true if the two input values are considered equivalent.
 */
export type EqualityComparatorFunction<T> = (a: T, b: T) => boolean;

/**
 * Wraps a EqualityComparatorFunction that handles Maybe values and only uses the comparator when the input values are not null/undefined.
 *
 * @param compare
 * @returns
 */
export function safeEqualityComparatorFunction<T>(compare: EqualityComparatorFunction<T>): EqualityComparatorFunction<Maybe<T>> {
  return (a: Maybe<T>, b: Maybe<T>) => (a != null && b != null ? compare(a, b) : a === b);
}

/**
 * Safely compares two Maybe values.
 *
 * @param a
 * @param b
 * @param compare
 * @returns
 */
export function safeCompareEquality<T>(a: Maybe<T>, b: Maybe<T>, compare: EqualityComparatorFunction<T>): boolean {
  return safeEqualityComparatorFunction(compare)(a, b);
}

// MARK: Decision With Items
/**
 * Function used to compare the values from the input items. Items might not be defined.
 *
 * - If the items are both null or both undefined, the function will return true.
 * - If one is defined and one is undefined, it will return false.
 * - If one is undefined and one is null the function will return false.
 */
export type CompareEqualityWithValueFromItemsFunction<I, V> = ((a: Maybe<I>, b: Maybe<I>) => boolean) & {
  /**
   * Used to read the values from the input, if the input is defined.
   *
   * @param a
   * @returns
   */
  readonly _readValues: ReadValueFunction<I, V>;
  /**
   * Decision function.
   *
   * @param a
   * @param b
   * @returns
   */
  readonly _equalityComparator: EqualityComparatorFunction<V>;
};

/**
 * Creates a new CompareEqualityWithValueFromItemsFunction.
 *
 * Convenience function for calling compareEqualityWithValueFromItemsFunctionFactory() and passing the read values and values decision functions.
 *
 * @param readValues
 * @param equalityComparator
 * @returns
 */
export function compareEqualityWithValueFromItemsFunction<I, V>(readValues: ReadValueFunction<I, V>, equalityComparator: EqualityComparatorFunction<V>): CompareEqualityWithValueFromItemsFunction<I, V> {
  return compareEqualityWithValueFromItemsFunctionFactory(readValues)(equalityComparator);
}

/**
 * Function used to compare the values from the input items. Items might not be defined.
 */
export type CompareEqualityWithValueFromItemsFunctionFactory<I, V> = ((equalityComparator: EqualityComparatorFunction<V>) => CompareEqualityWithValueFromItemsFunction<I, V>) & Pick<CompareEqualityWithValueFromItemsFunction<I, V>, '_readValues'>;

/**
 * Creates a new CompareEqualityWithValueFromItemsFunctionFactory.
 *
 * @param readValues
 * @returns
 */
export function compareEqualityWithValueFromItemsFunctionFactory<I, V>(readValues: ReadValueFunction<I, V>): CompareEqualityWithValueFromItemsFunctionFactory<I, V> {
  const fn = ((equalityComparator: (a: V, b: V) => boolean) => {
    const fn = safeEqualityComparatorFunction((a: I, b: I) => {
      const vA = readValues(a);
      const vB = readValues(b);
      return equalityComparator(vA, vB);
    }) as Building<CompareEqualityWithValueFromItemsFunction<I, V>>;

    fn._readValues = readValues;
    fn._equalityComparator = equalityComparator;

    return fn;
  }) as Building<CompareEqualityWithValueFromItemsFunctionFactory<I, V>>;

  fn._readValues = readValues;
  return fn as CompareEqualityWithValueFromItemsFunctionFactory<I, V>;
}
