import { type AscendingSortCompareFunction } from '../sort';
import { type IndexNumber, type IndexRef, type IndexRangeInput, indexRange } from '../value/indexed';
import { type Maybe } from '../value/maybe.type';

/**
 * A set of index numbers corresponding to items in an array.
 *
 * This is useful for cases where you need to reference items by their position in the array.
 */
export type IndexSet = IndexNumber[];

/**
 * An array of {@link IndexSetPair} values, associating array items with their indices.
 */
export type IndexSetPairSet<T> = IndexSetPair<T>[];

/**
 * Pairs an array item with its index position.
 */
export interface IndexSetPair<T> extends IndexRef {
  /** The item at the index, or undefined if no item exists at that position. */
  item: Maybe<T>;
}

/**
 * Runs a filter on an array and returns an {@link IndexSet} containing the indices of values that match.
 *
 * @param input - array to search through
 * @param filter - predicate function to test each value
 * @returns an {@link IndexSet} of indices for matching values
 */
export function findToIndexSet<T>(input: T[], filter: (value: T) => boolean): IndexSet {
  const filterIndexes: IndexNumber[] = [];

  input.forEach((x, i) => {
    if (filter(x)) {
      filterIndexes.push(i);
    }
  });

  return filterIndexes;
}

/**
 * Expands an {@link IndexSet} into an {@link IndexSetPairSet} by pairing each index with the corresponding item from the input array.
 *
 * @param input - source array to retrieve items from
 * @param indexSet - set of indices to expand
 * @returns an {@link IndexSetPairSet} pairing each index with its corresponding item
 */
export function expandIndexSet<T>(input: T[], indexSet: IndexSet): IndexSetPairSet<T> {
  return indexSet.map((i) => ({ i, item: input[i] }));
}

/**
 * Finds the best item in the input array using the compare function, and returns an {@link IndexSetPair} value.
 *
 * The comparison follows ascending sort conventions: a negative return value from the compare function
 * indicates the second argument is "better" than the first.
 *
 * @param input - array of items to search through
 * @param compare - comparison function used to determine the best item
 * @returns an {@link IndexSetPair} containing the best item and its index
 */
export function findBest<T>(input: T[], compare: (a: T, b: T) => number): IndexSetPair<T> {
  let bestIndex = 0;
  let best = input[0];

  for (let i = 1; i < input.length; i += 1) {
    const next = input[i];

    if (next != null && compare(best, next) < 0) {
      bestIndex = i;
      best = next;
    }
  }

  return {
    i: bestIndex,
    item: best
  };
}

/**
 * Finds the best item in the input {@link IndexSetPairSet} using the compare function, and returns it.
 *
 * Pairs with null/undefined items are skipped in favor of pairs with defined items.
 *
 * @param input - set of index-item pairs to search through
 * @param compare - ascending sort comparison function used to determine the best item
 * @returns the {@link IndexSetPair} containing the best item
 */
export function findBestIndexSetPair<T>(input: IndexSetPairSet<T>, compare: AscendingSortCompareFunction<T>): IndexSetPair<T> {
  let best = input[0];

  for (let i = 1; i < input.length; i += 1) {
    const next = input[i];

    // set default if best.item is null/unset
    if (next.item != null && (best.item == null || compare(best.item, next.item) < 0)) {
      best = next;
    }
  }

  return best;
}

/**
 * A function that slices a pre-configured index range from an input array.
 *
 * @param input - array to slice
 * @returns the sliced portion of the array
 */
export type SliceIndexRangeFunction<T> = (input: T[]) => T[];

/**
 * Creates a {@link SliceIndexRangeFunction} that slices the specified index range from any input array.
 *
 * @param inputRange - the index range configuration to use for slicing
 * @returns a function that slices the configured range from an input array
 */
export function sliceIndexRangeFunction<T>(inputRange: IndexRangeInput): SliceIndexRangeFunction<T> {
  const range = indexRange(inputRange);
  return (input: T[]) => input.slice(range.minIndex, range.maxIndex);
}
