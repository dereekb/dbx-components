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
   * Minimum index to consider, inclusive.
   */
  minIndex: IndexNumber;
  /**
   * Maximum index allowed, exclusive.
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
export function indexRangeCheckReaderFunction<T extends IndexRef>(range: IndexRange): IndexRefRangeCheckFunction<T>;
export function indexRangeCheckReaderFunction<T>(range: IndexRange, read: ReadIndexFunction<T>): IndexRefRangeCheckFunction<T>;
export function indexRangeCheckReaderFunction<T>(range: IndexRange, read: ReadIndexFunction<T> = (x: T) => (x as unknown as IndexRef).i): IndexRefRangeCheckFunction<T> {
  const rangeCheck = indexRangeCheckFunction(range);
  return (value: T) => rangeCheck(read(value));
}

/**
 * Checks whether or not the input number is in the range.
 */
export type IndexRangeCheckFunction = (i: number) => boolean;

/**
 * Creates an IndexRangeCheckFunction
 *
 * @param range
 */
export function indexRangeCheckFunction(range: IndexRange): IndexRangeCheckFunction {
  const { minIndex, maxIndex } = range;
  return (i) => i >= minIndex && i < maxIndex;
}
