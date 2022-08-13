import { IndexNumber, IndexRef, IndexRangeInput, indexRange } from '../value/indexed';
import { Maybe } from '../value/maybe.type';

/**
 * A set of number corresponding to items in an array.
 *
 * This is useful for cases where you need the items in their index in the array.
 */
export type IndexSet = IndexNumber[];

export type IndexSetPairSet<T> = IndexSetPair<T>[];

export interface IndexSetPair<T> extends IndexRef {
  item: Maybe<T>;
}

/**
 * Runs a filter on an array and returns an IndexSet for values that match.
 *
 * @param input
 * @param filter
 * @returns
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

export function expandIndexSet<T>(input: T[], indexSet: IndexSet): IndexSetPairSet<T> {
  return indexSet.map((i) => ({ i, item: input[i] }));
}

/**
 * Finds the best item in the input array using the compare function, and returns an IndexSetPair value.
 *
 * @param input
 * @param compare
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
 * Finds the best item in the input IndexSetPairSet, and returns it.
 *
 * @param input
 * @param compare
 * @returns
 */
export function findBestIndexSetPair<T>(input: IndexSetPairSet<T>, compare: (a: T, b: T) => number): IndexSetPair<T> {
  let best = input[0];

  for (let i = 1; i < input.length; i += 1) {
    const next = input[i];

    if (best.item == null || (next.item != null && compare(best.item, next.item) < 0)) {
      best = next;
    }
  }

  return best;
}

/**
 * Slices a configured index range from the input array.
 */
export type SliceIndexRangeFunction<T> = (input: T[]) => T[];

export function sliceIndexRangeFunction<T>(inputRange: IndexRangeInput): SliceIndexRangeFunction<T> {
  const range = indexRange(inputRange);
  return (input: T[]) => input.slice(range.minIndex, range.maxIndex);
}
