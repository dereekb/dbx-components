import { type Building } from './build';
import { type ReadValueFunction } from './map';
import { type Maybe } from './maybe.type';

/**
 * A comparator that returns true if the two input values are considered equivalent.
 */
export type EqualityComparatorFunction<T> = (a: T, b: T) => boolean;

/**
 * Wraps an {@link EqualityComparatorFunction} to safely handle `Maybe` values.
 *
 * The wrapped function delegates to the comparator only when both values are non-nullish.
 * When both are nullish, it uses strict equality (`===`), so `null === null` is `true`
 * but `null === undefined` is `false`.
 *
 * @param compare - the comparator to wrap
 *
 * @example
 * ```ts
 * const safeCompare = safeEqualityComparatorFunction((a: number, b: number) => a === b);
 * safeCompare(1, 1);       // true
 * safeCompare(null, null);  // true
 * safeCompare(null, undefined); // false
 * ```
 */
export function safeEqualityComparatorFunction<T>(compare: EqualityComparatorFunction<T>): EqualityComparatorFunction<Maybe<T>> {
  return (a: Maybe<T>, b: Maybe<T>) => (a != null && b != null ? compare(a, b) : a === b);
}

/**
 * Convenience function that safely compares two `Maybe` values using the provided comparator.
 *
 * Delegates to {@link safeEqualityComparatorFunction} internally, so nullish values are handled
 * without invoking the comparator.
 *
 * @param a - first value to compare
 * @param b - second value to compare
 * @param compare - the equality comparator for non-nullish values
 *
 * @example
 * ```ts
 * safeCompareEquality(0, 1, (a, b) => a === b);
 * // false
 *
 * safeCompareEquality(null, null, (a, b) => a === b);
 * // true (comparator is not invoked)
 * ```
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
   * The function used to extract comparable values from each input item.
   */
  readonly _readValues: ReadValueFunction<I, V>;
  /**
   * The equality comparator applied to the extracted values.
   */
  readonly _equalityComparator: EqualityComparatorFunction<V>;
};

/**
 * Creates a {@link CompareEqualityWithValueFromItemsFunction} that extracts values from items before comparing them.
 *
 * This is a convenience wrapper around {@link compareEqualityWithValueFromItemsFunctionFactory} that
 * accepts both the value reader and comparator in a single call.
 *
 * @param readValues - extracts the comparable value from each item
 * @param equalityComparator - compares the extracted values for equality
 */
export function compareEqualityWithValueFromItemsFunction<I, V>(readValues: ReadValueFunction<I, V>, equalityComparator: EqualityComparatorFunction<V>): CompareEqualityWithValueFromItemsFunction<I, V> {
  return compareEqualityWithValueFromItemsFunctionFactory(readValues)(equalityComparator);
}

/**
 * Function used to compare the values from the input items. Items might not be defined.
 */
export type CompareEqualityWithValueFromItemsFunctionFactory<I, V> = ((equalityComparator: EqualityComparatorFunction<V>) => CompareEqualityWithValueFromItemsFunction<I, V>) & Pick<CompareEqualityWithValueFromItemsFunction<I, V>, '_readValues'>;

/**
 * Creates a {@link CompareEqualityWithValueFromItemsFunctionFactory} that is pre-configured with a value reader.
 *
 * The returned factory accepts different equality comparators, allowing reuse of the same value extraction logic
 * with varying comparison strategies.
 *
 * @param readValues - extracts the comparable value from each item
 *
 * @example
 * ```ts
 * const factory = compareEqualityWithValueFromItemsFunctionFactory<number, number[]>((x) => [x]);
 * const fn = factory(iterablesAreSetEquivalent);
 *
 * fn(0, 0);           // true
 * fn(null, null);     // true
 * fn(undefined, undefined); // true
 * fn(0, 1);           // false
 * ```
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
