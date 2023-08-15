import { findValuesFrom, FindValuesFromInput } from '../set/set';
import { ArrayOrValue, asArray, lastValue } from '../array/array';
import { objectHasKey } from '../object/object';
import { HashSet } from '../set/set.hashset';
import { MinAndMax, MinAndMaxFunction, minAndMaxFunction, MinAndMaxFunctionResult, reverseCompareFn, SortCompareFunction } from '../sort';
import { FactoryWithRequiredInput } from '../getter/getter';
import { Maybe } from './maybe.type';
import { separateValues } from '../grouping';
import { readKeysToMap } from '../map/map.key';
import { isSelectedDecisionFunctionFactory } from '../set/set.selection';
import { iterableToArray } from '../iterable/iterable';
import { Building } from './build';
import { wrapNumberFunction, boundNumberFunction, WrapNumberFunction } from '../number';
import { range } from '../array/array.number';

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
 * Computes the next free index given the input values.
 */
export type ComputeNextFreeIndexFunction<T> = (values: T[]) => IndexNumber;

/**
 * Creates a new ComputeNextFreeIndexFunction.
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
 * Reads the min and max index from the input values.
 */
export type MinAndMaxIndexFunction<T> = ((values: Iterable<T>) => MinAndMaxFunctionResult<IndexNumber>) & {
  readonly _readIndex: ReadIndexFunction<T>;
};

/**
 * Returns a MinAndMaxIndexFunction.
 *
 * @param readIndex
 * @returns
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
 * Returns the min and max index value from the input IndexRef values.
 *
 * @param values
 * @returns
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
 * Returns a MinAndMaxIndexItemsFunction.
 *
 * @param readIndex
 * @returns
 */
export function minAndMaxIndexItemsFunction<T>(readIndex: ReadIndexFunction<T>): MinAndMaxIndexItemsFunction<T> {
  const fn = minAndMaxFunction(readIndex) as Building<MinAndMaxIndexItemsFunction<T>>;
  fn._readIndex = readIndex;
  return fn as MinAndMaxIndexItemsFunction<T>;
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

/**
 * Finds the best index match given the configured objects and returns the best match.
 */
export type FindBestIndexMatchFunction<T> = <I extends IndexRef>(value: I) => T;

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

export type FitToIndexRangeFunction = (input: IndexNumber) => IndexNumber;

export function fitToIndexRangeFunction(input: IndexRange): FitToIndexRangeFunction {
  const { minIndex: min, maxIndex } = input;
  const max = maxIndex - 1;
  return boundNumberFunction<IndexNumber>({ min, max, wrap: false });
}

export type WrapIndexNumberFunction = WrapNumberFunction;

/**
 * Creates a WrapNumberFunction.
 *
 * @param input
 * @param fencePosts
 * @returns
 */
export function wrapIndexRangeFunction(input: IndexRange, fencePosts: boolean = true): WrapIndexNumberFunction {
  const { minIndex: min, maxIndex } = input;
  const max = maxIndex - 1;
  return wrapNumberFunction<IndexNumber>({ min, max, fencePosts });
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

/**
 * Returns an array of all IndexNumbers within the input IndexRange.
 *
 * maxIndex is exclusive.
 *
 * @param indexRange
 * @returns
 */
export function allIndexesInIndexRange(indexRange: IndexRange): IndexNumber[] {
  return range(indexRange.minIndex, indexRange.maxIndex);
}

export interface StepsFromIndexFunctionConfig {
  readonly range: IndexRange;
  /**
   * Whether or not to fit start indexes that are outside of the range. If false, then returns undefined.
   */
  readonly fitToRange?: boolean;
  /**
   * Whether or not to wrap the index to the other side of the range when stepping outside the bounds of the range.
   */
  readonly wrapAround?: boolean;
  /**
   * Whether or not to use fencePosts. Defaults to true.
   */
  readonly fencePosts?: boolean;
  readonly steps?: number;
}

export type StepsFromIndexFunction = ((startIndex: number, wrapAround?: boolean, steps?: number) => Maybe<number>) & {
  readonly _config: StepsFromIndexFunctionConfig;
};

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
 * Steps to the next index in the given direction based on the number of steps to take.
 *
 * Starting indexes less than the minIndex are considered to not exist and will return undefined.
 *
 * When wrapAround is true, indexes that are larger than the max index will be used to find an index that is that many steps into the index range.
 *
 * For instance, an index of 5 on a range of 0 to 3 will return the index 1.
 */
export function stepsFromIndex(range: IndexRange, startIndex: number, step = 1, wrapAround = false): Maybe<number> {
  return stepsFromIndexFunction({ range })(startIndex, wrapAround, step);
}

// MARK: Selection
export const isSelectedIndexDecisionFunction = isSelectedDecisionFunctionFactory<IndexRef, IndexNumber>({ readKey: readIndexNumber });
