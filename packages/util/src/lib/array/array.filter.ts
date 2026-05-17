import { type MapFunction } from '../value/map';
import { type DecisionFunction } from '../value/decision';
import { copyArray } from './array';
import { expandIndexSet, findBestIndexSetPair, findToIndexSet } from './array.index';
import { forEachInIterable } from '../iterable/iterable';
import { sortByNumberFunction } from '../number/sort';
import { type AscendingSortCompareFunction } from '../sort';

/**
 * Filters the input values by distance while maintaining the original order of elements.
 * Values that are too close to each other (based on the minDistance parameter) will be filtered out.
 *
 * Items whose extracted value is null are excluded from the result.
 *
 * If order is irrelevant, use filterValuesByDistanceNoOrder() instead.
 *
 * @param input - The array of values to filter
 * @param minDistance - The minimum distance required between values (inclusive)
 * @param getValue - Function that extracts a numeric value from each item for distance comparison
 * @returns A filtered array with only values that are at least minDistance apart, in their original input order
 */
export function filterValuesByDistance<T>(input: T[], minDistance: number, getValue: (value: T) => number | null): T[] {
  // Tag each non-null value with its original index so we can restore order after the distance filter.
  const tagged: [{ readonly item: T; readonly index: number }, number][] = [];

  for (let i = 0, n = input.length; i < n; i += 1) {
    const item = input[i];
    const value = getValue(item);

    if (value != null) {
      tagged.push([{ item, index: i }, value]);
    }
  }

  const kept = _filterValuesByDistance(tagged, minDistance, (x) => x[0]);
  kept.sort((a, b) => a.index - b.index);
  return kept.map((x) => x.item);
}

/**
 * Filters the input values by an arbitrary "distance"/difference from each other and returns the values sorted by their determined distance.
 *
 * This is useful in cases where many values are too "close" to each other (generally items that share the same time, or within seconds of each other), and
 * we are only interested in seeing one of those items.
 *
 * @param input - The array of values to filter
 * @param minDistance - The minimum distance required between values (inclusive)
 * @param getValue - Function that extracts a numeric value from each item for distance comparison
 * @returns A filtered array with only values that are at least minDistance apart, sorted by the extracted value
 */
export function filterValuesByDistanceNoOrder<T>(input: T[], minDistance: number, getValue: (value: T) => number | null): T[] {
  const values: [T, number][] = input.map((x) => [x, getValue(x)] as [T, number | null]).filter((x): x is [T, number] => x[1] != null);
  return _filterValuesByDistance(values, minDistance, (x) => x[0]);
}

// TODO(FUTURE): Can add a "mergeValuesByDistance" too to merge together values that are too close together.

/**
 * Internal helper function for filtering values by distance.
 *
 * @param values - Array of tuples containing the original value and its numeric representation
 * @param minDistance - The minimum distance required between values (inclusive).
 * @param toOutputValue - Function to convert a value-number tuple to the output format
 * @returns A filtered array with only values that are at least minDistance apart
 */
function _filterValuesByDistance<T, Y>(values: [T, number][], minDistance: number, toOutputValue: (value: [T, number]) => Y): Y[] {
  let filtered: Y[];

  // Exit if nothing to do.
  if (values.length === 0) {
    filtered = [];
  } else if (values.length === 1) {
    filtered = [toOutputValue(values[0])];
  } else {
    // Sort values
    values.sort(sortByNumberFunction((x) => x[1]));

    let prev = values[0];
    filtered = [toOutputValue(prev)];

    for (let i = 1, n = values.length; i < n; i += 1) {
      const current = values[i];
      const distance = Math.abs(current[1] - prev[1]);

      if (distance >= minDistance) {
        filtered.push(toOutputValue(current));
        prev = current;
      }
    }
  }

  return filtered;
}

/**
 * Strategy used by {@link applyBestFit} and {@link makeBestFit} to pick the best-fit item and transform the rest.
 */
export interface BestFitConfig<T> {
  /**
   * Function that determines which items are candidates for the best fit.
   */
  readonly filter: (value: T) => boolean;
  /**
   * AscendingSortCompareFunction to compare two values to determine which is the best fit.
   */
  readonly compare: AscendingSortCompareFunction<T>;
  /**
   * Function that transforms non-best-fit items.
   */
  readonly updateNonBestFit: (value: T) => T;
}

/**
 * Same as applyBestFit, but returns a new array, rather than modifying the existing array.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, best-fit, filter, sort, immutable
 * @dbxUtilRelated apply-best-fit, find-best-index-set-pair
 *
 * @param input - The array to filter for the best fit.
 * @param config - The best-fit strategy ({@link BestFitConfig}).
 * @returns A new array with only the best fit item and transformed non-best-fit items.
 * @__NO_SIDE_EFFECTS__
 */
export function makeBestFit<T>(input: T[], config: BestFitConfig<T>): T[] {
  return applyBestFit<T>(copyArray(input), config);
}

/**
 * Used for updating an array so that a single element becomes the "best fit" in whatever context is provided.
 *
 * For instance, if two items are selected but only one can be selected by design, this function can be used to
 * pick the best fit, and update the input array.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilTags array, best-fit, filter, sort, mutable, in-place
 * @dbxUtilRelated make-best-fit, find-best-index-set-pair
 *
 * @param input - The array to modify in-place.
 * @param config - The best-fit strategy ({@link BestFitConfig}).
 * @returns The modified input array with only the best fit item and transformed non-best-fit items.
 */
export function applyBestFit<T>(input: T[], config: BestFitConfig<T>): T[] {
  const { filter, compare, updateNonBestFit } = config;
  const matchIndexSet = findToIndexSet(input, filter);

  if (matchIndexSet.length > 1) {
    const expansion = expandIndexSet(input, matchIndexSet);
    const bestPair = findBestIndexSetPair(expansion, compare);

    expansion.forEach(({ i, item }) => {
      if (i !== bestPair.i) {
        input[i] = updateNonBestFit(item as T); // Update value on input.
      }
    });
  }

  return input;
}

// MARK: Filter and Map
/**
 * Filters and maps the input values to an array.
 * Combines filtering and mapping operations into a single pass over the data.
 */
export type FilterAndMapFunction<I, O> = MapFunction<Iterable<I>, O[]>;

/**
 * Creates a function that filters the input values and maps all matching values to a new value.
 * This is a higher-order function that combines filtering and mapping operations.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilKind factory
 * @dbxUtilTags array, filter, map, transform, factory, iterable
 * @dbxUtilRelated array-decision-function
 *
 * @param decisionFunction - Function that determines which items to include in the result
 * @param mapFunction - Function that transforms each included item
 * @returns A function that takes an iterable of input values and returns an array of transformed values
 * @__NO_SIDE_EFFECTS__
 */
export function filterAndMapFunction<I, O>(decisionFunction: DecisionFunction<I>, mapFunction: MapFunction<I, O>): FilterAndMapFunction<I, O> {
  return (values: Iterable<I>) => {
    const result: O[] = [];

    forEachInIterable(values, (x) => {
      if (decisionFunction(x)) {
        result.push(mapFunction(x));
      }
    });

    return result;
  };
}
