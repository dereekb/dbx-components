import { forEachInIterable } from './iterable';

/**
 * Maps each value in an iterable through a function and returns the results as an array.
 *
 * @param values - Source items to feed through the mapper.
 * @param fn - Per-element transform applied to every value.
 * @returns Mapped results collected in iteration order.
 */
export function mapIterable<I, O>(values: Iterable<I>, fn: (value: I) => O): O[] {
  const mapping: O[] = [];
  forEachInIterable(values, (value) => mapping.push(fn(value)));
  return mapping;
}
