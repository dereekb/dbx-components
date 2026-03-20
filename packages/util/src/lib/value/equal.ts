import { existsInIterable, isIterable, type IterableOrValue, takeValuesFromIterable } from './../iterable/iterable';
import { type EqualityComparatorFunction } from './comparator';

/**
 * Used to check if the input object is considered equal to the current context.
 */
export type IsEqualContext<T = unknown> = (x: T) => boolean;

/**
 * Similar to IsEqualContext, but supports an array of objects.
 *
 * Used to check if the input object or array of objects are considered equal to the current context.
 */
export type AreEqualContext<T = unknown> = (x: IterableOrValue<T>) => boolean;

/**
 * Creates an {@link IsEqualContext} that captures a reference value and uses the provided comparator
 * to check whether subsequent values are equal to it.
 *
 * @param contextValue - the reference value to compare against
 * @param fn - the equality comparator
 * @returns a function that checks whether a given value equals the captured reference
 *
 * @example
 * ```ts
 * const isEqual = (a: number, b: number) => a === b;
 * const context = isEqualContext(0, isEqual);
 *
 * context(0);  // true
 * context(10); // false
 * ```
 */
export function isEqualContext<T>(contextValue: T, fn: EqualityComparatorFunction<T>): IsEqualContext<T> {
  return (value) => {
    return fn(contextValue, value);
  };
}

/**
 * Creates an {@link AreEqualContext} that checks whether a single value or all values in an iterable
 * are equal to the captured reference value.
 *
 * Returns `true` only if every value in the input matches the context value according to the comparator.
 *
 * @param contextValue - the reference value to compare against
 * @param fn - the equality comparator
 * @returns a function that checks whether all input values equal the captured reference
 *
 * @example
 * ```ts
 * const isEqual = (a: number, b: number) => a === b;
 * const context = areEqualContext(0, isEqual);
 *
 * context([0, 0, 0]); // true
 * context([0, 1, 2]); // false
 * ```
 */
export function areEqualContext<T>(contextValue: T, fn: EqualityComparatorFunction<T>): AreEqualContext<T> {
  const isEqual = isEqualContext(contextValue, fn);

  return (input: IterableOrValue<T>) => {
    let areEqual = false;

    if (isIterable(input)) {
      areEqual = !existsInIterable(input, (x) => !isEqual(x));
    } else {
      areEqual = isEqual(input);
    }

    return areEqual;
  };
}

/**
 * Returns `true` if all values in the input are equal according to the provided comparator.
 *
 * Empty iterables and single-value inputs return `true` by default, since there is nothing to contradict equality.
 * Uses the first value as the reference and checks all remaining values against it.
 *
 * @param values - the values to compare
 * @param fn - the equality comparator
 * @returns `true` if all values are equal to each other, or if fewer than two values are provided
 *
 * @example
 * ```ts
 * const isEqual = (a: unknown, b: unknown) => a === b;
 *
 * allObjectsAreEqual([undefined, undefined, undefined], isEqual);
 * // true
 *
 * allObjectsAreEqual([undefined, 'test', undefined], isEqual);
 * // false
 * ```
 */
export function allObjectsAreEqual<T>(values: IterableOrValue<T>, fn: EqualityComparatorFunction<T>): boolean {
  if (isIterable(values)) {
    const firstValues = takeValuesFromIterable(values, 2);
    return firstValues.length > 1 ? areEqualContext(firstValues[0], fn)(values) : true;
  }

  return true;
}
