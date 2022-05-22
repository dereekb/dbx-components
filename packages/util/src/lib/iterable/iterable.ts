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
export function isIterable<T = unknown>(values: unknown): values is Iterable<T> {
  if (values && (values as Iterable<T>)[Symbol.iterator]) {
    return true;
  } else {
    return false;
  }
}

/**
 * Returns the first value from the Iterable. If there are no values, returns undefined. Order is not guranteed.
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
 * Takes items from the iterable in the order they are read. Order is not guranteed.
 * 
 * @param values 
 * @param count 
 * @returns 
 */
export function takeValuesFromIterable<T>(values: Iterable<T>, count: number): T[] {
  const result: T[] = [];

  for (const value of values) {
    if (result.length < count) {
      result.push(value);
    } else {
      break;
    }
  }

  return result;
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
 * Find the first matching value in the Iterable.
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

/**
 * Whether or not the value exists in the iterable.
 * 
 * @param values 
 * @param fn 
 * @returns 
 */
export function existsInIterable<T>(values: Iterable<T>, fn: (value: T) => boolean): boolean {
  for (const value of values) {
    if (fn(value)) {
      return true;
    }
  }

  return false;
}
