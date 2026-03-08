import { forEachInIterable } from './iterable';

/**
 * Maps each value in an iterable through a function and returns the results as an array.
 *
 * @param values - The iterable to map over
 * @param fn - The mapping function to apply to each value
 * @returns An array of mapped results
 */
export function mapIterable<I, O>(values: Iterable<I>, fn: (value: I) => O): O[] {
  const mapping: O[] = [];
  forEachInIterable(values, (value) => mapping.push(fn(value)));
  return mapping;
}
