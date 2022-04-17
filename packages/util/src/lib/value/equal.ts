import { asArray } from '../array';
import { findInIterable, firstValueFromIterable, isIterable, IterableOrValue } from './../iterable/iterable';

/**
 * Function used for equivalence comparisons on an object.
 */
export type IsEqualFunction<T = any> = (a: T, b: T) => boolean;

/**
 * Used to check if the input object is considered equal to the current context.
 */
export type IsEqualContext<T = any> = (x: T) => boolean;

/**
 * Similar to IsEqualContext, but supports an array of objects.
 * 
 * Used to check if the input object or array of objects are considered equal to the current context.
 */
export type AreEqualContext<T = any> = (x: IterableOrValue<T>) => boolean;

/**
 * Creates an IsEqualContext
 * 
 * @param contextValue 
 * @param fn 
 * @returns 
 */
export function isEqualContext<T>(contextValue: T, fn: IsEqualFunction<T>): IsEqualContext<T> {
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
export function areEqualContext<T>(contextValue: T, fn: IsEqualFunction<T>): AreEqualContext<T> {
  const isEqual = isEqualContext(contextValue, fn);

  return (input: IterableOrValue<T>) => {
    let areEqual = false;

    if (isIterable(input)) {
      const findResult = findInIterable(input, (x) => !isEqual(x));
      areEqual = findResult == null;
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
export function allObjectsAreEqual<T>(values: IterableOrValue<T>, fn: IsEqualFunction<T>): boolean {
  if (isIterable(values)) {
    const firstValue = firstValueFromIterable(values);
    return (firstValue != null) ? areEqualContext(firstValue, fn)(values) : true;
  }
  
  return true;
}
