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
