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
 * Function to iterate over iterable values.
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
 * Function to use the input iterable if it is defined.
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
