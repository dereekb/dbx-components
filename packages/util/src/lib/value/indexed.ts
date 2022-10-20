import { findValuesFrom, FindValuesFromInput } from './../set/set';
import { ArrayOrValue, asArray } from './../array/array';
import { objectHasKey } from '../object/object';
import { HashSet } from '../set/set.hashset';
import { SortCompareFunction } from '../sort';

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
 * Reads an IndexNumber from an IndexRef.
 *
 * @param indexRef
 * @returns
 */
export function readIndexNumber(indexRef: IndexRef): IndexNumber {
  return indexRef.i;
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
