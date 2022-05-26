import { forEachInIterable } from './iterable';

/**
 * map utility function for an iterable that maps and places the results into an array.
 *
 * @param values
 * @param fn
 * @returns
 */
export function mapIterable<I, O>(values: Iterable<I>, fn: (value: I) => O): O[] {
  const mapping: O[] = [];
  forEachInIterable(values, (value) => mapping.push(fn(value)));
  return mapping;
}
