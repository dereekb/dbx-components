import { findValuesFrom, type FindValuesFromInput } from '../set/set';
import { type ArrayOrValue, asArray, lastValue } from '../array/array';
import { objectHasKey } from '../object/object';
import { HashSet } from '../set/set.hashset';
import { type MinAndMaxFunction, minAndMaxFunction, type MinAndMaxFunctionResult, reverseCompareFn, type SortCompareFunction } from '../sort';
import { type FactoryWithRequiredInput } from '../getter/getter';
import { type Maybe } from './maybe.type';
import { separateValues } from '../grouping';
import { readKeysToMap } from '../map/map.key';
import { isSelectedDecisionFunctionFactory } from '../set/set.selection';
import { iterableToArray } from '../iterable/iterable';
import { type Building } from './build';
import { wrapNumberFunction, boundNumberFunction, type WrapNumberFunction } from '../number';
import { range } from '../array/array.number';
import { filterUniqueFunction, type FilterUniqueFunctionExcludeKeysInput } from '../array/array.unique';

/**
 * An integer that denotes which index an item is at.
 *
 * Is typically non-negative only.
 */
export type IndexNumber = number;

/**
 * The default index number when no index is set.
 *
 * Only applicable for non-negative indexes.
 */
export const UNSET_INDEX_NUMBER = -1;

export type UnsetIndexNumber = typeof UNSET_INDEX_NUMBER;

/**
 * Item that references an IndexNumber.
 */
export interface IndexRef {
  /**
   * Item's index number
   */
  i: IndexNumber;
}

/**
 * Convenience function for calling readKeysToMap() and keying the values by their index number.
 *
 * @param items - array of IndexRef items to index
 * @returns a Map keyed by each item's index number
 */
export function indexRefMap<T extends IndexRef>(items: T[]): Map<IndexNumber, T> {
  return readKeysToMap(items, (item) => item.i);
}

/**
 * IndexRef object that may not have an index set yet
 */
export type MaybeIndexRef<T extends IndexRef> = Omit<T, 'i'> & Partial<Pick<T, 'i'>>;

/**
 * Creates a SortCompareFunction that sorts IndexRef values in ascending order by their index number.
 *
 * @returns a compare function suitable for Array.sort()
 *
 * @example
 * ```ts
 * const items = [{ i: 4 }, { i: 0 }, { i: 2 }];
 * items.sort(sortAscendingIndexNumberRefFunction());
 * // items[0].i === 0
 * ```
 */
export function sortAscendingIndexNumberRefFunction<T extends IndexRef>(): SortCompareFunction<T> {
  return (a, b) => a.i - b.i;
}

/**
 * Returns an item's IndexNumber.
 */
export type ReadIndexFunction<T> = (value: T) => IndexNumber;

/**
 * Returns an item's index, if available.
 */
export type ReadMaybeIndexFunction<T> = (value: T) => Maybe<IndexNumber>;

/**
 * Reads an IndexNumber from an IndexRef.
 *
 * @param indexRef - the ref to read from
 * @returns the index number value
 */
export function readIndexNumber(indexRef: IndexRef): IndexNumber {
  return indexRef.i;
}

export interface IndexDeltaGroup<T> {
  // Input
  readonly inputItems: T[];
  readonly previousItems?: Maybe<T[]>;
  // Output
  /**
   * Items without an index.
   */
  readonly newItems: T[];
  /**
   * All items with an index.
   */
  readonly currentItems: T[];
  /**
   * Items from previousItems that have been removed.
   */
  readonly deletedItems?: T[];
}

/**
 * Function that separates items into new, current, and deleted groups based on their index assignment.
 */
export type IndexDeltaGroupFunction<T> = (inputItems: T[], previousItems?: Maybe<T[]>) => IndexDeltaGroup<T>;

/**
 * Creates an {@link IndexDeltaGroupFunction} that separates items into new (no index), current (has index),
 * and deleted (present in previous but missing from current) groups. Useful for computing deltas when
 * items are added or removed from an indexed collection.
 *
 * @param readIndex - reads an item's index, returning null/undefined for unindexed items
 * @returns a function that groups items by their index state
 *
 * @example
 * ```ts
 * const groupFn = indexDeltaGroupFunction<{ x: string; i?: number }>((x) => x.i);
 * const result = groupFn([{ x: 'a' }, { x: 'b', i: 0 }, { x: 'c', i: 1 }]);
 *
 * // result.newItems.length === 1     (item without an index)
 * // result.currentItems.length === 2 (items with indexes)
 * ```
 */
export function indexDeltaGroupFunction<T>(readIndex: ReadMaybeIndexFunction<T>): IndexDeltaGroupFunction<T> {
  return (inputItems: T[], previousItems?: Maybe<T[]>) => {
    const {
      excluded: newItems, // items without an index and treated as "new"
      included: currentItems
    } = separateValues(inputItems, (x) => {
      const index = readIndex(x);
      return index != null;
    });

    let deletedItems: T[] | undefined;

    if (previousItems != null) {
      // compute delta if available
      const currentItemsIndexMap = readKeysToMap(currentItems, readIndex);

      deletedItems = previousItems.filter((x) => {
        const index = readIndex(x);
        return index != null && !currentItemsIndexMap.has(index);
      });
    }

    return {
      inputItems,
      previousItems,
      newItems,
      currentItems,
      deletedItems
    };
  };
}

/**
 * Convenience function that creates and immediately invokes an {@link IndexDeltaGroupFunction}.
 *
 * @param readIndex - reads an item's index
 * @param inputItems - the current set of items
 * @param previousItems - the previous set of items for computing deletions
 * @returns the grouped delta result
 */
export function indexDeltaGroup<T>(readIndex: ReadMaybeIndexFunction<T>, inputItems: T[], previousItems?: Maybe<T[]>): IndexDeltaGroup<T> {
  return indexDeltaGroupFunction(readIndex)(inputItems, previousItems);
}

/**
 * Creates a SortCompareFunction that sorts items in ascending order using a custom index reader.
 *
 * @param readIndex - extracts the index number from each item
 * @returns a compare function suitable for Array.sort()
 */
export function sortByIndexAscendingCompareFunction<T>(readIndex: ReadIndexFunction<T>): SortCompareFunction<T> {
  return (a, b) => readIndex(a) - readIndex(b);
}

/**
 * Computes the next free index given the input values.
 *
 * Returns 0 if no values are present.
 */
export type ComputeNextFreeIndexFunction<T> = (values: T[]) => IndexNumber;

/**
 * Creates a {@link ComputeNextFreeIndexFunction} that finds the maximum index in the input and returns the next available one.
 * Returns 0 when the input is empty.
 *
 * @param readIndex - extracts the index number from each item
 * @param nextIndex - optional custom function to compute the next index from the max item; defaults to max + 1
 * @returns a function that computes the next free index for a given array
 *
 * @example
 * ```ts
 * const fn = computeNextFreeIndexFunction<IndexRef>((x) => x.i);
 * const nextIndex = fn([{ i: 0 }, { i: 1 }, { i: 5 }]);
 * // nextIndex === 6
 * ```
 */
export function computeNextFreeIndexFunction<T>(readIndex: ReadIndexFunction<T>, nextIndex?: (value: T) => IndexNumber): ComputeNextFreeIndexFunction<T> {
  const findMinMax = minAndMaxIndexItemsFunction<T>(readIndex);
  const readNextIndex = nextIndex ?? ((x) => readIndex(x) + 1); //return the max index + 1 by default.

  return (values: T[]) => {
    const minMax = findMinMax(values);
    const max = minMax?.max;

    if (max != null) {
      return readNextIndex(max);
    } else {
      return 0;
    }
  };
}

/**
 * Creates a {@link ComputeNextFreeIndexFunction} optimized for pre-sorted input arrays.
 * Instead of scanning all items for the maximum, it reads only the last element.
 *
 * @param readIndex - extracts the index number from each item
 * @param nextIndex - optional custom function to compute the next index from the last item; defaults to last + 1
 * @returns a function that computes the next free index from sorted arrays
 */
export function computeNextFreeIndexOnSortedValuesFunction<T>(readIndex: ReadIndexFunction<T>, nextIndex?: (value: T) => IndexNumber): ComputeNextFreeIndexFunction<T> {
  const readNextIndex = nextIndex ?? ((x) => readIndex(x) + 1); //return the max index + 1 by default.
  return (sortedValues: T[]) => {
    const lastValueInSorted = lastValue(sortedValues);

    if (lastValueInSorted != null) {
      return readNextIndex(lastValueInSorted);
    } else {
      return 0;
    }
  };
}

/**
 * Reads the min and max index from the input values.
 */
export type MinAndMaxIndexFunction<T> = ((values: Iterable<T>) => MinAndMaxFunctionResult<IndexNumber>) & {
  readonly _readIndex: ReadIndexFunction<T>;
};

/**
 * Creates a {@link MinAndMaxIndexFunction} that extracts the minimum and maximum index numbers from a collection.
 *
 * @param readIndex - extracts the index number from each item
 * @returns a function returning the min/max indexes, or null for empty input
 *
 * @example
 * ```ts
 * const fn = minAndMaxIndexFunction<IndexRef>((x) => x.i);
 * const result = fn([{ i: 3 }, { i: 0 }, { i: 5 }]);
 * // result?.min === 0, result?.max === 5
 * ```
 */
export function minAndMaxIndexFunction<T>(readIndex: ReadIndexFunction<T>): MinAndMaxIndexFunction<T> {
  const minAndMaxItems = minAndMaxIndexItemsFunction(readIndex);
  const fn = ((values: T[]) => {
    const result = minAndMaxItems(values);

    if (result != null) {
      const { min, max } = result;
      return { min: readIndex(min), max: readIndex(max) };
    } else {
      return null;
    }
  }) as Building<MinAndMaxIndexFunction<T>>;
  fn._readIndex = readIndex;
  return fn as MinAndMaxIndexFunction<T>;
}

/**
 * Returns the min and max index numbers from an array of IndexRef values.
 * Convenience wrapper around {@link minAndMaxIndexFunction} using {@link readIndexNumber}.
 *
 * @param values - the IndexRef items to scan
 * @returns the min/max indexes, or null for empty input
 */
export function minAndMaxIndex<T extends IndexRef>(values: T[]): MinAndMaxFunctionResult<IndexNumber> {
  return minAndMaxIndexFunction<T>(readIndexNumber)(values);
}

/**
 * Reads the items with the min and max index from the input values.
 */
export type MinAndMaxIndexItemsFunction<T> = MinAndMaxFunction<T> & {
  readonly _readIndex: ReadIndexFunction<T>;
};

/**
 * Creates a {@link MinAndMaxIndexItemsFunction} that returns the actual items (not just index numbers)
 * with the minimum and maximum index values.
 *
 * @param readIndex - extracts the index number from each item
 * @returns a function returning the min/max items, or null for empty input
 */
export function minAndMaxIndexItemsFunction<T>(readIndex: ReadIndexFunction<T>): MinAndMaxIndexItemsFunction<T> {
  const fn = minAndMaxFunction(readIndex) as Building<MinAndMaxIndexItemsFunction<T>>;
  fn._readIndex = readIndex;
  return fn as MinAndMaxIndexItemsFunction<T>;
}

/**
 * Creates a HashSet with items keyed by their IndexNumber, providing O(1) lookups by index.
 *
 * @param input - optional initial values to populate the set
 * @returns a HashSet keyed by index number
 */
export function hashSetForIndexed<T extends IndexRef>(input?: ArrayOrValue<T>): HashSet<IndexNumber, T> {
  const values = input != null ? asArray(input) : undefined;
  return new HashSet<IndexNumber, T>({ readKey: readIndexNumber }, values);
}

export interface FindItemsByIndexInput<T extends IndexRef> extends Pick<FindValuesFromInput<T, IndexNumber>, 'values' | 'exclude'> {
  /**
   * Indexes to find or exclude.
   */
  readonly indexes: ArrayOrValue<IndexNumber>;
}

/**
 * Returns all values whose index matches one of the specified indexes.
 *
 * @param config - specifies the values to search, indexes to match, and optional exclusion flag
 * @returns the matching items
 *
 * @example
 * ```ts
 * const values = [{ i: 0, name: '0' }, { i: 1, name: '1' }, { i: 2, name: '2' }];
 * const result = findItemsByIndex({ values, indexes: [1, 2] });
 * // result contains items with i === 1 and i === 2
 * ```
 */
export function findItemsByIndex<T extends IndexRef>(config: FindItemsByIndexInput<T>): T[] {
  const { indexes, values, exclude } = config;
  return findValuesFrom({
    values,
    exclude,
    readKey: readIndexNumber,
    keysToFind: indexes
  });
}

/**
 * Finds the best index match given the configured objects and returns the best match.
 */
export type FindBestIndexMatchFunction<T> = <I extends IndexRef>(value: I) => T;

/**
 * Creates a {@link FindBestIndexMatchFunction} from a set of IndexRef items.
 * Given an input index, returns the item with the highest index that is less than or equal to the input.
 *
 * @param items - the available match options; must not be empty
 * @returns a function that finds the best match for any input index
 * @throws {Error} When the input iterable is empty
 *
 * @example
 * ```ts
 * const options = [{ i: 0 }, { i: 5 }, { i: 10 }];
 * const fn = findBestIndexMatchFunction(options);
 *
 * fn({ i: 4 });  // returns { i: 0 }
 * fn({ i: 6 });  // returns { i: 5 }
 * fn({ i: 11 }); // returns { i: 10 }
 * ```
 */
export function findBestIndexMatchFunction<T extends IndexRef>(items: Iterable<T>): FindBestIndexMatchFunction<T> {
  // reverse the order so we can return the first item that is less than or equal to the input i
  const bestMatchArray = iterableToArray<T>(items, false).sort(reverseCompareFn(sortAscendingIndexNumberRefFunction()));
  const defaultMatch = lastValue(bestMatchArray);

  if (bestMatchArray.length === 0) {
    throw new Error('findBestIndexMatchFunction() input array cannot be empty.');
  } else if (bestMatchArray.length === 1) {
    return () => defaultMatch;
  } else {
    return (input) => {
      const { i } = input;
      const bestMatch = bestMatchArray.find((matchOption) => i >= matchOption.i);
      return (bestMatch ?? defaultMatch) as T;
    };
  }
}

/**
 * Finds the best match for the given index from the input array.
 * Returns the item with the highest index that is less than or equal to `i`.
 *
 * @param input - the available match options
 * @param i - the target index to match against
 * @returns the best matching item
 * @throws {Error} When the input array is empty
 */
export function findBestIndexMatch<T extends IndexRef>(input: T[], i: IndexNumber): T {
  return findBestIndexMatchFunction(input)({ i });
}

/**
 * Safe variant of {@link findBestIndexMatch} that returns undefined instead of throwing when input is empty or null.
 *
 * @param input - the available match options, or null/undefined
 * @param i - the target index to match against
 * @returns the best matching item, or undefined if input is empty/null
 */
export function safeFindBestIndexMatch<T extends IndexRef>(input: Maybe<T[]>, i: IndexNumber): Maybe<T> {
  return input != null && input.length > 0 ? findBestIndexMatch(input, i) : undefined;
}

/**
 * Pre-built filter function that removes duplicate items based on their index number,
 * keeping the first occurrence of each index.
 */
export const filterUniqueByIndex = filterUniqueFunction(readIndexNumber) as <T>(input: T[], exclude?: FilterUniqueFunctionExcludeKeysInput<T, IndexNumber>) => T[];

// MARK: IndexRange
/**
 * A min and max value that denote the maximum edges of a range of index values.
 */
export interface IndexRange {
  /**
   * Minimum index to consider. Inclusive.
   */
  readonly minIndex: IndexNumber;
  /**
   * Maximum index allowed. Typically exclusive.
   */
  readonly maxIndex: IndexNumber;
}

/**
 * Returns the IndexRange for the input value.
 */
export type ReadIndexRangeFunction<T> = FactoryWithRequiredInput<IndexRange, T>;

/**
 * Creates a SortCompareFunction that sorts items by their IndexRange in ascending order.
 * Sorts by minIndex first, then by maxIndex for items with equal minIndex values.
 *
 * @param readIndexRange - extracts the IndexRange from each item
 * @returns a compare function suitable for Array.sort()
 */
export function sortByIndexRangeAscendingCompareFunction<T>(readIndexRange: ReadIndexRangeFunction<T>): SortCompareFunction<T> {
  return (a, b) => {
    const ra = readIndexRange(a);
    const rb = readIndexRange(b);

    const comp = ra.minIndex - rb.minIndex; // sort by smaller minIndexes first

    if (comp === 0) {
      return ra.maxIndex - rb.maxIndex; // sort by larger maxIndexes first
    } else {
      return comp;
    }
  };
}

/**
 * IndexRange and value pair.
 */
export interface IndexRangeReaderPair<T = unknown> {
  readonly range: IndexRange;
  readonly value: T;
}

/**
 * Creates a IndexRangeReaderPair with the input value.
 */
export type IndexRangeReaderPairFactory<T> = FactoryWithRequiredInput<IndexRangeReaderPair<T>, T>;

/**
 * Creates a new {@link IndexRangeReaderPairFactory} that pairs each value with its computed IndexRange.
 *
 * @param reader - reads the IndexRange from the input value
 * @returns a factory that creates IndexRangeReaderPair instances
 */
export function indexRangeReaderPairFactory<T>(reader: ReadIndexRangeFunction<T>): IndexRangeReaderPairFactory<T> {
  return (value: T) => {
    const range = reader(value);
    return {
      range,
      value
    };
  };
}

/**
 * An IndexNumber representing a single index, or a full IndexRange. Used as flexible input for functions
 * that can accept either form.
 */
export type IndexRangeInput = IndexNumber | IndexRange;

/**
 * Normalizes an {@link IndexRangeInput} to a full {@link IndexRange}. When given a single number,
 * creates a range spanning that single index (minIndex = input, maxIndex = input + 1).
 *
 * @param input - a single index number or an IndexRange
 * @returns the normalized IndexRange
 */
export function indexRange(input: IndexRangeInput): IndexRange {
  if (typeof input === 'number') {
    return { minIndex: input, maxIndex: input + 1 };
  } else {
    return input;
  }
}

/**
 * Clamps an IndexNumber to fit within a given IndexRange (inclusive min, exclusive max).
 */
export type FitToIndexRangeFunction = (input: IndexNumber) => IndexNumber;

/**
 * Creates a {@link FitToIndexRangeFunction} that clamps index numbers to the given range boundaries.
 *
 * @param input - the range to clamp to
 * @returns a function that clamps any index to the range
 */
export function fitToIndexRangeFunction(input: IndexRange): FitToIndexRangeFunction {
  const { minIndex: min, maxIndex } = input;
  const max = maxIndex - 1;
  return boundNumberFunction<IndexNumber>({ min, max, wrap: false });
}

/**
 * Wraps an IndexNumber around to the other side of a range when it goes out of bounds.
 */
export type WrapIndexNumberFunction = WrapNumberFunction;

/**
 * Creates a {@link WrapIndexNumberFunction} that wraps index numbers around the range boundaries,
 * similar to modular arithmetic. Values that exceed the max wrap to the min side and vice versa.
 *
 * @param input - the index range to wrap within
 * @param fencePosts - whether to use fencepost semantics (maxIndex is exclusive); defaults to true
 * @returns a function that wraps any index into the range
 *
 * @example
 * ```ts
 * const wrap = wrapIndexRangeFunction({ minIndex: 0, maxIndex: 6 });
 * wrap(6);  // 0 (wraps from positive side)
 * wrap(-1); // 5 (wraps from negative side)
 * ```
 */
export function wrapIndexRangeFunction(input: IndexRange, fencePosts: boolean = true): WrapIndexNumberFunction {
  const { minIndex: min, maxIndex } = input;
  const max = maxIndex - 1;
  return wrapNumberFunction<IndexNumber>({ min, max, fencePosts });
}

/**
 * Checks whether an item's index falls within a configured range.
 */
export type IndexRefRangeCheckFunction<T> = (value: T) => boolean;

/**
 * Creates an {@link IndexRefRangeCheckFunction} that reads an item's index and checks whether it falls
 * within the specified range. For IndexRef types, the index is read from `i` automatically.
 *
 * @param input - the range or range config to check against
 */
export function indexRangeCheckReaderFunction<T extends IndexRef>(input: IndexRangeFunctionInput): IndexRefRangeCheckFunction<T>;
/**
 * @param input - the range or range config to check against
 * @param read - custom function to extract the index from the item
 */
export function indexRangeCheckReaderFunction<T>(input: IndexRangeFunctionInput, read: ReadIndexFunction<T>): IndexRefRangeCheckFunction<T>;
export function indexRangeCheckReaderFunction<T>(input: IndexRangeFunctionInput, read: ReadIndexFunction<T> = (x: T) => (x as unknown as IndexRef).i): IndexRefRangeCheckFunction<T> {
  const rangeCheck = indexRangeCheckFunction(input);
  return (value: T) => rangeCheck(read(value));
}

/**
 * Checks whether or not the input number is in the range.
 */
export type IndexRangeCheckFunction = (i: IndexNumber) => boolean;

export interface IndexRangeFunctionConfig {
  /**
   * IndexRange to check.
   */
  readonly indexRange: IndexRange;
  /**
   * Whether or not the max index is inclusive. False by default.
   */
  readonly inclusiveMaxIndex: boolean;
}

function indexRangeCheckFunctionConfigToIndexRange({ indexRange, inclusiveMaxIndex }: IndexRangeFunctionConfig): IndexRange {
  if (inclusiveMaxIndex) {
    const { minIndex, maxIndex: maxIndexInput } = indexRange;
    const maxIndex = inclusiveMaxIndex ? maxIndexInput + 1 : maxIndexInput;
    return { minIndex, maxIndex };
  } else {
    return indexRange;
  }
}

/**
 * Flexible input for range-checking functions: either a plain {@link IndexRange} or a full {@link IndexRangeFunctionConfig}
 * with inclusive/exclusive options.
 */
export type IndexRangeFunctionInput = IndexRange | IndexRangeFunctionConfig;

/**
 * Normalizes an {@link IndexRangeFunctionInput} to a full {@link IndexRangeFunctionConfig},
 * defaulting `inclusiveMaxIndex` to false when a plain IndexRange is provided.
 *
 * @param input - the range or config to normalize
 * @returns the normalized config
 */
export function asIndexRangeCheckFunctionConfig(input: IndexRangeFunctionInput): IndexRangeFunctionConfig {
  return objectHasKey<IndexRangeFunctionConfig>(input as IndexRangeFunctionConfig, 'indexRange') ? (input as IndexRangeFunctionConfig) : { indexRange: input as IndexRange, inclusiveMaxIndex: false };
}

/**
 * Creates an {@link IndexRangeCheckFunction} that tests whether an index number falls within the configured range.
 * The min is inclusive and the max is exclusive by default unless `inclusiveMaxIndex` is set.
 *
 * @param input - the range or range config to check against
 * @returns a predicate function for index numbers
 */
export function indexRangeCheckFunction(input: IndexRangeFunctionInput): IndexRangeCheckFunction {
  const { minIndex, maxIndex } = indexRangeCheckFunctionConfigToIndexRange(asIndexRangeCheckFunctionConfig(input));
  return (i) => i >= minIndex && i < maxIndex;
}

// MARK: Comparisons
/**
 * Returns true if the input index is contained within the configured IndexRange.
 */
export type IsIndexNumberInIndexRangeFunction = (index: IndexNumber) => boolean;

/**
 * Checks whether a single index number falls within the given IndexRange.
 *
 * @param index - the index number to test
 * @param indexRange - the range to test against
 * @param inclusiveMaxIndex - whether the max boundary is inclusive; defaults to false
 * @returns true if the index is within range
 */
export function isIndexNumberInIndexRange(index: IndexNumber, indexRange: IndexRange, inclusiveMaxIndex = false): boolean {
  return isIndexNumberInIndexRangeFunction({ indexRange, inclusiveMaxIndex })(index);
}

/**
 * Creates an {@link IsIndexNumberInIndexRangeFunction} bound to the given range configuration.
 *
 * @param input - the range or range config to bind
 * @returns a predicate that tests index numbers against the bound range
 */
export function isIndexNumberInIndexRangeFunction(input: IndexRangeFunctionInput): IsIndexNumberInIndexRangeFunction {
  const { minIndex, maxIndex } = indexRangeCheckFunctionConfigToIndexRange(asIndexRangeCheckFunctionConfig(input));
  return (index: IndexNumber) => {
    return index >= minIndex && index < maxIndex;
  };
}

/**
 * Returns true if the input IndexRange is contained within the configured IndexRange.
 */
export type IsIndexRangeInIndexRangeFunction = (indexRange: IndexRange) => boolean;

/**
 * Checks whether `compareIndexRange` is entirely contained within `indexRange`.
 *
 * @param compareIndexRange - the range to test
 * @param indexRange - the bounding range
 * @returns true if the compare range is fully contained
 */
export function isIndexRangeInIndexRange(compareIndexRange: IndexRange, indexRange: IndexRange): boolean {
  return isIndexRangeInIndexRangeFunction(indexRange)(compareIndexRange);
}

/**
 * Creates an {@link IsIndexRangeInIndexRangeFunction} bound to the given range configuration.
 *
 * @param input - the bounding range or range config to bind
 * @returns a predicate that tests whether index ranges are fully contained
 */
export function isIndexRangeInIndexRangeFunction(input: IndexRangeFunctionInput): IsIndexRangeInIndexRangeFunction {
  const { minIndex, maxIndex } = indexRangeCheckFunctionConfigToIndexRange(asIndexRangeCheckFunctionConfig(input));
  return (input: IndexRange) => {
    return input.minIndex >= minIndex && input.maxIndex <= maxIndex;
  };
}

/**
 * Returns true if the input IndexRange overlaps the configured IndexRange in any way.
 */
export type IndexRangeOverlapsIndexRangeFunction = (indexRange: IndexRange) => boolean;

/**
 * Checks whether `compareIndexRange` overlaps `indexRange` in any way (partial or full).
 *
 * @param compareIndexRange - the range to test for overlap
 * @param indexRange - the reference range
 * @returns true if any portion of the ranges overlap
 */
export function indexRangeOverlapsIndexRange(compareIndexRange: IndexRange, indexRange: IndexRange): boolean {
  return indexRangeOverlapsIndexRangeFunction(indexRange)(compareIndexRange);
}

/**
 * Creates an {@link IndexRangeOverlapsIndexRangeFunction} bound to the given range configuration.
 *
 * @param input - the reference range or range config to bind
 * @returns a predicate that tests for overlap with the bound range
 */
export function indexRangeOverlapsIndexRangeFunction(input: IndexRangeFunctionInput): IndexRangeOverlapsIndexRangeFunction {
  const { minIndex, maxIndex } = indexRangeCheckFunctionConfigToIndexRange(asIndexRangeCheckFunctionConfig(input));
  return (input: IndexRange) => {
    return input.minIndex <= maxIndex && input.maxIndex >= minIndex;
  };
}

/**
 * Returns an array of all IndexNumbers within the input IndexRange (minIndex inclusive, maxIndex exclusive).
 *
 * @param indexRange - the range to enumerate
 * @returns an array of sequential index numbers
 */
export function allIndexesInIndexRange(indexRange: IndexRange): IndexNumber[] {
  return range(indexRange.minIndex, indexRange.maxIndex);
}

/**
 * Configuration for {@link stepsFromIndexFunction}.
 */
export interface StepsFromIndexFunctionConfig {
  /**
   * The index range to step within.
   */
  readonly range: IndexRange;
  /**
   * Whether to clamp out-of-range start indexes into the range. When false, out-of-range starts return undefined.
   */
  readonly fitToRange?: boolean;
  /**
   * Whether to wrap around to the other side of the range when stepping past the boundaries.
   */
  readonly wrapAround?: boolean;
  /**
   * Whether to use fencepost semantics for wrapping. Defaults to true.
   */
  readonly fencePosts?: boolean;
  /**
   * Default number of steps to take. Defaults to 1.
   */
  readonly steps?: number;
}

/**
 * Steps forward or backward from a start index within a range, with optional wrap-around and fit-to-range behavior.
 * Exposes its bound config via the `_config` property.
 */
export type StepsFromIndexFunction = ((startIndex: number, wrapAround?: boolean, steps?: number) => Maybe<number>) & {
  readonly _config: StepsFromIndexFunctionConfig;
};

/**
 * Creates a {@link StepsFromIndexFunction} that computes the next index after stepping from a start position.
 * Returns undefined when the result falls outside the range (unless wrapping or fitting is enabled).
 *
 * @param config - stepping behavior configuration
 * @returns a function that computes the stepped index
 */
export function stepsFromIndexFunction(config: StepsFromIndexFunctionConfig): StepsFromIndexFunction {
  const { range, fitToRange = false, fencePosts = true, wrapAround: defaultWrapAround = false, steps: defaultStep = 1 } = config;
  const wrapNumber = wrapIndexRangeFunction(range, fencePosts);
  const fitNumberFunction = fitToRange ? fitToIndexRangeFunction(range) : (x: number) => x; // unused if fitToRange is not true

  const fn = ((startIndex: number, wrapAround = defaultWrapAround, steps = defaultStep) => {
    let nextIndex: Maybe<number>;

    if (!fitToRange && (startIndex < range.minIndex || startIndex >= range.maxIndex)) {
      nextIndex = undefined; // start indexes outside the range are considered invalid, unless fitToRange is true.
    } else {
      const stepIndex = startIndex + steps;

      // Perform directional wrapping
      if (fitToRange || wrapAround) {
        if (wrapAround) {
          // wrap around
          nextIndex = wrapNumber(stepIndex);
        } else {
          // fit to range
          nextIndex = fitNumberFunction(stepIndex);
        }
      } else if (stepIndex < range.minIndex || stepIndex >= range.maxIndex) {
        nextIndex = undefined; // out of bounds
      } else {
        nextIndex = stepIndex;
      }
    }

    return nextIndex;
  }) as Building<StepsFromIndexFunction>;
  fn._config = { range, fitToRange, wrapAround: defaultWrapAround, steps: defaultStep };
  return fn as StepsFromIndexFunction;
}

/**
 * Convenience function that steps from a start index within a range without pre-creating a reusable function.
 *
 * Start indexes outside the range return undefined. When `wrapAround` is true, out-of-bound results
 * wrap to the other side of the range (e.g., stepping past maxIndex wraps to minIndex).
 *
 * @param range - the index range to step within
 * @param startIndex - the starting position
 * @param step - number of steps to take (positive or negative); defaults to 1
 * @param wrapAround - whether to wrap out-of-bound results; defaults to false
 * @returns the resulting index, or undefined if out of bounds without wrapping
 */
export function stepsFromIndex(range: IndexRange, startIndex: number, step = 1, wrapAround = false): Maybe<number> {
  return stepsFromIndexFunction({ range })(startIndex, wrapAround, step);
}

// MARK: Selection
/**
 * Pre-built decision function factory for determining whether an IndexRef item is selected,
 * using the item's index number as the selection key.
 */
export const isSelectedIndexDecisionFunction = isSelectedDecisionFunctionFactory<IndexRef, IndexNumber>({ readKey: readIndexNumber });
