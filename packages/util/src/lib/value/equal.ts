import { existsInIterable, isIterable, IterableOrValue, takeValuesFromIterable } from './../iterable/iterable';
import { EqualityComparatorFunction } from './comparator';

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
 * Creates an IsEqualContext
 *
 * @param contextValue
 * @param fn
 * @returns
 */
export function isEqualContext<T>(contextValue: T, fn: EqualityComparatorFunction<T>): IsEqualContext<T> {
  return (value) => {
    return fn(contextValue, value);
  };
}

/**
 * Creates an AreEqualContext
 *
 * @param contextValue
 * @param fn
 * @returns
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
 * Returns true if all input values are equal.
 *
 * Arrays that are empty or have one value will return true by default.
 *
 * @param values
 * @param fn
 * @returns
 */
export function allObjectsAreEqual<T>(values: IterableOrValue<T>, fn: EqualityComparatorFunction<T>): boolean {
  if (isIterable(values)) {
    const firstValues = takeValuesFromIterable(values, 2);
    return firstValues.length > 1 ? areEqualContext(firstValues[0], fn)(values) : true;
  }

  return true;
}
