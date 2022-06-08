import { Maybe } from '../value/maybe.type';

// MARK: Types
/**
 * An Iterable or a value.
 *
 * Note that strings are a valid Iterable, allowing iteration over characters.
 */
export type IterableOrValue<T> = T | Iterable<T>;

// MARK: Functions
export function asIterable<T = unknown>(values: IterableOrValue<T>, treatStringAsIterable?: boolean): Iterable<T> {
  let iterable: Iterable<T>;

  if (isIterable(values, treatStringAsIterable)) {
    iterable = values;
  } else {
    iterable = [values];
  }

  return iterable;
}

/**
 * Returns true if the input is an Iterable.
 *
 * Can specify whether or not to treat string values as iterable values. Is false by default.
 *
 * @param values
 * @param treatStringAsIterable
 * @returns
 */
export function isIterable<T = unknown>(values: unknown, treatStringAsIterable = false): values is Iterable<T> {
  if (values && (values as Iterable<T>)[Symbol.iterator] && (treatStringAsIterable || typeof values !== 'string')) {
    return true;
  } else {
    return false;
  }
}

/**
 * Returns true if there are values to iterate over.
 *
 * @param values
 * @returns
 */
export function isEmptyIterable<T = unknown>(values: Iterable<T>): boolean {
  for (const value of values) {
    return false;
  }

  return true;
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
export function useIterableOrValue<T>(values: Maybe<IterableOrValue<T>>, fn: (value: T) => void, treatStringAsIterable = false): void {
  if (values != null) {
    if (isIterable(values, treatStringAsIterable)) {
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
