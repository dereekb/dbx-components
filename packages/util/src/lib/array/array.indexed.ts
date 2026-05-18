import { type IndexNumber, type IndexRange, type ReadIndexRangeFunction, indexRangeReaderPairFactory, sortByIndexRangeAscendingCompareFunction, stepsFromIndex } from '../value/indexed';
import { type Maybe } from '../value/maybe.type';
import { type ArrayFindDecisionFunction } from './array.find';

/**
 * Creates an IndexRange for the input array, spanning from index 0 to the array's length.
 *
 * @param array - Source whose length defines the maxIndex boundary.
 * @returns Range pair spanning index 0 through the array's length.
 */
export function indexRangeForArray<T>(array: T[]): IndexRange {
  return { minIndex: 0, maxIndex: array.length };
}

/**
 * Finds a value in the array using the provided decision function, then returns the value at the next index.
 *
 * @param array - Source to scan; nullish input short-circuits with undefined.
 * @param find - Predicate that locates the anchor element to step from.
 * @param wrapAround - When true, stepping past the end resumes from index 0.
 * @param steps - Forward step count from the matched element; defaults to 1.
 * @returns Element after the anchor, or undefined when the anchor or its step target falls outside the array.
 */
// eslint-disable-next-line @typescript-eslint/max-params
export function findNext<T>(array: Maybe<T[]>, find: ArrayFindDecisionFunction<T>, wrapAround = false, steps?: number): Maybe<T> {
  let result: Maybe<T>;

  if (array) {
    const index = array.findIndex((v, i, arr) => find(v, i, arr));
    const nextIndex = getArrayNextIndex(array, index, wrapAround, steps);

    if (nextIndex != null) {
      result = array[nextIndex];
    }
  }

  return result;
}

/**
 * Returns the next index of an element in the input array based on the input index.
 *
 * Indexes less than 0 are considered to not exist.
 *
 * When wrapAround is true, indexes that are larger than the entire array will be used to find an index that is that many steps into the array.
 * For instance, an index of 5 on an array of length 3 will return the index 1.
 *
 * @param array - Source whose bounds anchor the step computation.
 * @param index - Current position from which to advance.
 * @param wrapAround - When true, stepping past the end resumes from index 0.
 * @param steps - Forward step count from the current index.
 * @returns Stepped index when `index` is inside the array; otherwise undefined.
 */
// eslint-disable-next-line @typescript-eslint/max-params
export function getArrayNextIndex<T>(array: T[], index: number, wrapAround = false, steps = 1): Maybe<number> {
  let nextIndex: Maybe<number>;
  const arrayLength = array.length;

  if (index >= 0 && index <= arrayLength - 1) {
    nextIndex = stepsFromIndex(indexRangeForArray(array), index, steps, wrapAround);
  }

  return nextIndex;
}

/**
 * Accessor function that returns a value for the given index if any value's range contains that index.
 */
export type RangedIndexedValuesArrayAccessor<T> = (index: IndexNumber) => Maybe<T>;

/**
 * Factory function that creates a {@link RangedIndexedValuesArrayAccessor} from an array of values.
 */
export type RangedIndexedValuesArrayAccessorFactory<T> = (values: T[]) => RangedIndexedValuesArrayAccessor<T>;

/**
 * Creates a factory that produces {@link RangedIndexedValuesArrayAccessor} instances.
 *
 * Each accessor maps an index to the value whose range contains that index, or undefined if no range matches.
 *
 * @param readIndexRange - Function that reads the index range from each value.
 * @returns A factory that creates ranged accessors from arrays of values.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilKind factory
 * @dbxUtilTags array, indexed, range, accessor, factory, lookup
 * @dbxUtilRelated indexed-values-array-accessor-factory, ranged-indexed-values-array-accessor-info-factory
 *
 * @__NO_SIDE_EFFECTS__
 */
export function rangedIndexedValuesArrayAccessorFactory<T>(readIndexRange: ReadIndexRangeFunction<T>): RangedIndexedValuesArrayAccessorFactory<T> {
  const readInfoFactory = rangedIndexedValuesArrayAccessorInfoFactory({
    readIndexRange
  });

  return (values) => {
    const readInfo = readInfoFactory(values);

    return (index) => {
      const result = readInfo(index);
      return result.match; // only return matches
    };
  };
}

/**
 * Accessor function that returns a value for the given index. Always returns a value by falling back to the nearest neighbor.
 */
export type IndexedValuesArrayAccessor<T> = (index: IndexNumber) => T;

/**
 * Factory function that creates an {@link IndexedValuesArrayAccessor} from an array of values.
 */
export type IndexedValuesArrayAccessorFactory<T> = (values: T[]) => IndexedValuesArrayAccessor<T>;

/**
 * Creates a factory that produces {@link IndexedValuesArrayAccessor} instances.
 *
 * Each accessor maps an index to the matching value, falling back to the previous value, then the next value.
 * This guarantees a value is always returned.
 *
 * @param readIndexRange - Function that reads the index range from each value.
 * @returns A factory that creates indexed accessors from arrays of values.
 * @throws {Error} If the provided values array is empty.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilKind factory
 * @dbxUtilTags array, indexed, range, accessor, factory, fallback
 * @dbxUtilRelated ranged-indexed-values-array-accessor-factory, ranged-indexed-values-array-accessor-info-factory
 *
 * @__NO_SIDE_EFFECTS__
 */
export function indexedValuesArrayAccessorFactory<T>(readIndexRange: ReadIndexRangeFunction<T>): IndexedValuesArrayAccessorFactory<T> {
  const readInfoFactory = rangedIndexedValuesArrayAccessorInfoFactory({
    readIndexRange
  });

  return (values) => {
    if (values.length === 0) {
      throw new Error('Requires atleast one value to be defined.');
    }

    const readInfo = readInfoFactory(values);

    return (index) => {
      const result = readInfo(index);
      // Return the exact match, otherwise return the previous value, otherwise return the next/final value.
      return result.match ?? result.prev ?? (result.next as T);
    };
  };
}

// MARK: RangedIndexedValuesArrayInfoAccessor
/**
 * Contains the match result for a ranged index lookup, including the matched value and its neighbors.
 */
export interface RangedIndexValuesArrayAccessorInfo<T> {
  /**
   * The value from the range immediately before the matched or queried range.
   */
  readonly prev?: Maybe<T>;
  /**
   * The value whose range contains the queried index, or undefined if no range matched.
   */
  readonly match?: Maybe<T>;
  /**
   * The value from the range immediately after the matched or queried range.
   */
  readonly next?: Maybe<T>;
}

/**
 * Accessor function that returns detailed match info (match, previous, and next values) for the given index.
 */
export type RangedIndexedValuesArrayInfoAccessor<T> = (index: IndexNumber) => RangedIndexValuesArrayAccessorInfo<T>;

/**
 * Factory function that creates a {@link RangedIndexedValuesArrayInfoAccessor} from an array of values.
 */
export type RangedIndexedValuesArrayInfoAccessorFactory<T> = (values: T[]) => RangedIndexedValuesArrayInfoAccessor<T>;

/**
 * Configuration for {@link rangedIndexedValuesArrayAccessorInfoFactory}.
 */
export interface RangedIndexedValuesArrayInfoAccessorFactoryConfig<T> {
  /**
   * Reads the index range from a value. The IndexRange is treated as exclusive.
   */
  readonly readIndexRange: ReadIndexRangeFunction<T>;
}

/**
 * Creates a factory that produces {@link RangedIndexedValuesArrayInfoAccessor} instances.
 *
 * Each accessor sorts the values by their index ranges in ascending order, then for a given index
 * returns the matching value along with its previous and next neighbors.
 *
 * @param config - Configuration containing the index range reader function.
 * @returns A factory that creates ranged info accessors from arrays of values.
 *
 * @dbxUtil
 * @dbxUtilCategory array
 * @dbxUtilKind factory
 * @dbxUtilTags array, indexed, range, accessor, info, factory, neighbors
 * @dbxUtilRelated ranged-indexed-values-array-accessor-factory, indexed-values-array-accessor-factory
 *
 * @__NO_SIDE_EFFECTS__
 */
export function rangedIndexedValuesArrayAccessorInfoFactory<T>(config: RangedIndexedValuesArrayInfoAccessorFactoryConfig<T>): RangedIndexedValuesArrayInfoAccessorFactory<T> {
  const pairFactory = indexRangeReaderPairFactory(config.readIndexRange);
  return (values: T[]) => {
    let accessor: (index: IndexNumber) => RangedIndexValuesArrayAccessorInfo<T>;

    if (values.length === 0) {
      accessor = () => ({}); // no pairs to match on
    } else {
      // pairs sorted in ascending order
      const pairs = values.map(pairFactory).sort(sortByIndexRangeAscendingCompareFunction((x) => x.range));

      accessor = (index: IndexNumber) => {
        // find the first item that fits the
        let matchIndex: IndexNumber = -1;
        let i: IndexNumber;

        for (i = 0; i < pairs.length; i += 1) {
          const comparison = pairs[i];

          if (comparison.range.minIndex <= index) {
            if (comparison.range.maxIndex > index) {
              matchIndex = i;
              break;
            }
            // continue otherwise.
          } else {
            break; // outside the min index, is not within these values at all
          }
        }

        let match: Maybe<T>;
        let prev: Maybe<T>;
        let next: Maybe<T>;

        if (matchIndex === -1) {
          // no match
          match = undefined;

          // use i otherwise
          prev = pairs[i - 1]?.value;
          next = pairs[i]?.value;
        } else {
          match = pairs[matchIndex]?.value;
          prev = pairs[matchIndex - 1]?.value;
          next = pairs[matchIndex + 1]?.value;
        }

        const info: RangedIndexValuesArrayAccessorInfo<T> = {
          prev,
          match,
          next
        };

        return info;
      };
    }

    return accessor;
  };
}
