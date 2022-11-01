import { IndexNumber, ReadIndexRangeFunction, indexRangeReaderPairFactory, sortByIndexRangeAscendingCompareFunction } from '../value/indexed';
import { Maybe } from '../value/maybe.type';

/**
 * Returns a value given the input index if any value responds to the index.
 */
export type RangedIndexedValuesArrayAccessor<T> = (index: IndexNumber) => Maybe<T>;

export type RangedIndexedValuesArrayAccessorFactory<T> = (values: T[]) => RangedIndexedValuesArrayAccessor<T>;

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
 * Returns a value given the input index. Always returns a value.
 */
export type IndexedValuesArrayAccessor<T> = (index: IndexNumber) => T;

export type IndexedValuesArrayAccessorFactory<T> = (values: T[]) => IndexedValuesArrayAccessor<T>;

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
export interface RangedIndexValuesArrayAccessorInfo<T> {
  readonly prev?: Maybe<T>;
  readonly match?: Maybe<T>;
  readonly next?: Maybe<T>;
}

export type RangedIndexedValuesArrayInfoAccessor<T> = (index: IndexNumber) => RangedIndexValuesArrayAccessorInfo<T>;

export type RangedIndexedValuesArrayInfoAccessorFactory<T> = (values: T[]) => RangedIndexedValuesArrayInfoAccessor<T>;

export interface RangedIndexedValuesArrayInfoAccessorFactoryConfig<T> {
  /**
   * Reads the index range. The IndexRange is treated as exclusive.
   */
  readonly readIndexRange: ReadIndexRangeFunction<T>;
}

export function rangedIndexedValuesArrayAccessorInfoFactory<T>(config: RangedIndexedValuesArrayInfoAccessorFactoryConfig<T>): RangedIndexedValuesArrayInfoAccessorFactory<T> {
  const pairFactory = indexRangeReaderPairFactory(config.readIndexRange);
  return (values: T[]) => {
    if (values.length === 0) {
      return () => ({}); // no pairs to match on
    } else {
      // pairs sorted in ascending order
      const pairs = values.map(pairFactory).sort(sortByIndexRangeAscendingCompareFunction((x) => x.range));

      return (index: IndexNumber) => {
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
  };
}
