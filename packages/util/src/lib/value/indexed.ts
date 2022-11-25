import { findValuesFrom, FindValuesFromInput } from './../set/set';
import { ArrayOrValue, asArray } from './../array/array';
import { objectHasKey } from '../object/object';
import { HashSet } from '../set/set.hashset';
import { SortCompareFunction } from '../sort';
import { FactoryWithRequiredInput } from '../getter';
import { Maybe } from './maybe.type';
import { separateValues } from '../grouping';
import { readKeysToMap } from '../map/map.key';
import { isSelectedDecisionFunctionFactory } from '../set';

/**
 * A number that denotes which index an item is at.
 */
export type IndexNumber = number;

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
 * IndexRef object that may not have an index set yet
 */
export type MaybeIndexRef<T extends IndexRef> = Omit<T, 'i'> & Partial<Pick<T, 'i'>>;

/**
 * Creates a SortCompareFunction<T> that sorts by index on IndexRef values.
 *
 * @param input
 * @returns
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
 * @param indexRef
 * @returns
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

export type IndexDeltaGroupFunction<T> = (inputItems: T[], previousItems?: Maybe<T[]>) => IndexDeltaGroup<T>;

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

export function indexDeltaGroup<T>(readIndex: ReadMaybeIndexFunction<T>, inputItems: T[], previousItems?: Maybe<T[]>): IndexDeltaGroup<T> {
  return indexDeltaGroupFunction(readIndex)(inputItems, previousItems);
}

/**
 * Creates a SortCompareFunction<T> that sorts by the read index.
 *
 * @param input
 * @returns
 */
export function sortByIndexAscendingCompareFunction<T>(readIndex: ReadIndexFunction<T>): SortCompareFunction<T> {
  return (a, b) => readIndex(a) - readIndex(b);
}

/**
 * Creates a HashSet with items keyed by their IndexNumber for the input values.
 *
 * @param input
 * @returns
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
 * Convenience function to return all values that match one of the input indexes.
 *
 * @param values
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

// MARK: IndexRange
/**
 * A min and max value that denote the maximum edges of a range of index values.
 */
export interface IndexRange {
  /**
   * Minimum index to consider. Inclusive.
   */
  minIndex: IndexNumber;
  /**
   * Maximum index allowed. Typically exclusive.
   */
  maxIndex: IndexNumber;
}

/**
 * Returns the IndexRange for the input value.
 */
export type ReadIndexRangeFunction<T> = FactoryWithRequiredInput<IndexRange, T>;

/**
 * Creates a SortCompareFunction<T> that sorts by the read index.
 *
 * @param input
 * @returns
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
  range: IndexRange;
  value: T;
}

/**
 * Creates a IndexRangeReaderPair with the input value.
 */
export type IndexRangeReaderPairFactory<T> = FactoryWithRequiredInput<IndexRangeReaderPair<T>, T>;

/**
 * Creates a new IndexRangeReaderPairFactory
 *
 * @param reader
 * @returns
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
 * An IndexNumber that represenst a range of a single index, or an IndexRange.
 */
export type IndexRangeInput = IndexNumber | IndexRange;

/**
 * Creates an IndexRange from the input.
 *
 * @param input
 * @returns
 */
export function indexRange(input: IndexRangeInput): IndexRange {
  if (typeof input === 'number') {
    return { minIndex: input, maxIndex: input + 1 };
  } else {
    return input;
  }
}

/**
 * Checks whether or not the input number is in the range.
 */
export type IndexRefRangeCheckFunction<T> = (value: T) => boolean;

/**
 * Creates an IndexRefRangeCheckFunction
 *
 * @param range
 */
export function indexRangeCheckReaderFunction<T extends IndexRef>(input: IndexRangeFunctionInput): IndexRefRangeCheckFunction<T>;
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
  indexRange: IndexRange;
  /**
   * Whether or not the max index is inclusive. False by default.
   */
  inclusiveMaxIndex: boolean;
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

export type IndexRangeFunctionInput = IndexRange | IndexRangeFunctionConfig;

export function asIndexRangeCheckFunctionConfig(input: IndexRangeFunctionInput): IndexRangeFunctionConfig {
  return objectHasKey<IndexRangeFunctionConfig>(input as IndexRangeFunctionConfig, 'indexRange') ? (input as IndexRangeFunctionConfig) : { indexRange: input as IndexRange, inclusiveMaxIndex: false };
}

/**
 * Creates an IndexRangeCheckFunction
 *
 * @param range
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

export function isIndexNumberInIndexRange(index: IndexNumber, indexRange: IndexRange, inclusiveMaxIndex = false): boolean {
  return isIndexNumberInIndexRangeFunction({ indexRange, inclusiveMaxIndex })(index);
}

/**
 * Creates an IsIndexNumberInIndexRangeFunction
 *
 * @param indexRange
 * @returns
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

export function isIndexRangeInIndexRange(compareIndexRange: IndexRange, indexRange: IndexRange): boolean {
  return isIndexRangeInIndexRangeFunction(indexRange)(compareIndexRange);
}

/**
 * Creates an IsIndexRangeInIndexRangeFunction
 *
 * @param indexRange
 * @returns
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

export function indexRangeOverlapsIndexRange(compareIndexRange: IndexRange, indexRange: IndexRange): boolean {
  return indexRangeOverlapsIndexRangeFunction(indexRange)(compareIndexRange);
}

/**
 * Creates an IndexRangeOverlapsIndexRangeFunction
 *
 * @param indexRange
 * @returns
 */
export function indexRangeOverlapsIndexRangeFunction(input: IndexRangeFunctionInput): IndexRangeOverlapsIndexRangeFunction {
  const { minIndex, maxIndex } = indexRangeCheckFunctionConfigToIndexRange(asIndexRangeCheckFunctionConfig(input));
  return (input: IndexRange) => {
    return input.minIndex <= maxIndex && input.maxIndex >= minIndex;
  };
}

// MARK: Selection
export const isSelectedIndexDecisionFunction = isSelectedDecisionFunctionFactory<IndexRef, IndexNumber>({ readKey: readIndexNumber });
