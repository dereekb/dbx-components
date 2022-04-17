import { Maybe } from "../value/maybe";

// MARK: Types
export type IterableOrValue<T> = T | Iterable<T>;

// MARK: Functions
/**
 * Returns true if the input is an Iterable.
 * 
 * @param values 
 * @returns 
 */
export function isIterable<T = any>(values: any): values is Iterable<T> {
  if (values && values[Symbol.iterator]) {
    return true;
  } else {
    return false;
  }
}

/**
 * Returns the first value from the Iterable. If there are no values, returns undefined.
 * 
 * @param values 
 * @returns 
 */
export function firstValueFromIterable<T>(values: Iterable<T>): Maybe<T> {
  for (const value of values) {
    return value;
  }

  return undefined;
}


/**
 * Iterates over iterable values.
 * 
 * @param values 
 * @param fn 
 */
export function forEachInIterable<T>(values: Iterable<T>, fn: (value: T) => void): void {
  for (const value of values) {
    fn(value);
  }
}

/**
 * Uses the input iterable if it is defined.
 * 
 * @param values 
 * @param fn 
 */
export function useIterableOrValue<T>(values: Maybe<IterableOrValue<T>>, fn: (value: T) => void): void {
  if (values != null) {
    if (isIterable(values)) {
      forEachInIterable(values, fn);
    } else {
      fn(values);
    }
  }
}

/**
 * Find values within an iterable.
 * 
 * @param values 
 * @param fn 
 */
export function findInIterable<T>(values: Iterable<T>, fn: (value: T) => boolean): Maybe<T> {
  for (const value of values) {
    if (fn(value)) {
      return value;
    }
  }

  return undefined;
}
