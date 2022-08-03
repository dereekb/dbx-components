import { objectHasKey } from '@dereekb/util';
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
 * Creates a SortCompareFunction<T> that sorts by the read index.
 *
 * @param input
 * @returns
 */
export function sortByIndexAscendingCompareFunction<T>(readIndex: ReadIndexFunction<T>): SortCompareFunction<T> {
  return (a, b) => readIndex(a) - readIndex(b);
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
 * Checks whether or not the input number is in the range.
 */
export type IndexRefRangeCheckFunction<T> = (value: T) => boolean;

/**
 * Creates an IndexRefRangeCheckFunction
 *
 * @param range
 */
export function indexRangeCheckReaderFunction<T extends IndexRef>(input: IndexRangeCheckFunctionInput): IndexRefRangeCheckFunction<T>;
export function indexRangeCheckReaderFunction<T>(input: IndexRangeCheckFunctionInput, read: ReadIndexFunction<T>): IndexRefRangeCheckFunction<T>;
export function indexRangeCheckReaderFunction<T>(input: IndexRangeCheckFunctionInput, read: ReadIndexFunction<T> = (x: T) => (x as unknown as IndexRef).i): IndexRefRangeCheckFunction<T> {
  const rangeCheck = indexRangeCheckFunction(input);
  return (value: T) => rangeCheck(read(value));
}

/**
 * Checks whether or not the input number is in the range.
 */
export type IndexRangeCheckFunction = (i: number) => boolean;

export interface IndexRangeCheckFunctionConfig {
  /**
   * IndexRange to check.
   */
  range: IndexRange;
  /**
   * Whether or not the max index is inclusive. False by default.
   */
  inclusiveMaxIndex: boolean;
}

export type IndexRangeCheckFunctionInput = IndexRange | IndexRangeCheckFunctionConfig;

/**
 * Creates an IndexRangeCheckFunction
 *
 * @param range
 */
export function indexRangeCheckFunction(input: IndexRangeCheckFunctionInput): IndexRangeCheckFunction {
  const { range, inclusiveMaxIndex } = objectHasKey(input, 'range') ? (input as IndexRangeCheckFunctionConfig) : { range: input as IndexRange, inclusiveMaxIndex: false };
  const { minIndex, maxIndex } = range;

  if (inclusiveMaxIndex) {
    return (i) => i >= minIndex && i <= maxIndex;
  } else {
    return (i) => i >= minIndex && i < maxIndex;
  }
}
