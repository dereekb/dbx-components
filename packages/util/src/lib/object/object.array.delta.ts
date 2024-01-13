import { type Maybe, type MaybeMap } from '../value/maybe.type';
import { type Building } from '../value/build';
import { type ObjectFieldEqualityChecker } from './object.equal';
import { assignValuesToPOJOFunction } from './object.filter.pojo';
import { objectHasKey } from './object';
import { type EmptyArray } from '../array/array';
import { KeyValueTypleValueFilter } from './object.filter.tuple';

/**
 * A partial "delta" of the given entry. It only contains values that changed from the last entry.
 *
 * - Undefined field values mean the entry should inherit the previous entry's values.
 * - Null field values in a field mean the value has been cleared and should be excluded from future entries.
 */
export type CompressedObjectDeltaArrayDeltaEntry<T extends object> = MaybeMap<T>;

/**
 * A compressed object array.
 *
 * The first object is always fully expanded. Objects are in order of the delta changes.
 */
export type CompressedObjectDeltaArray<T extends object> = [T, ...CompressedObjectDeltaArrayDeltaEntry<T>[]];

/**
 * Compresses the input objects array to a CompressedObjectDeltaArray.
 */
export type ObjectDeltaArrayCompressorCompressFunction<T extends object> = ((uncompressed: T[]) => CompressedObjectDeltaArray<T>) & ((uncompressed: EmptyArray) => EmptyArray);

/**
 * Expands a CompressedObjectDeltaArray to an array of objects.
 */
export type ObjectDeltaArrayCompressorExpandFunction<T extends object> = ((compressed: CompressedObjectDeltaArray<T>) => T[]) & ((compressed: EmptyArray) => EmptyArray);

/**
 * Configuration for an object delta array compressor.
 */
export interface ObjectDeltaArrayCompressorConfig<T extends object> {
  /**
   * Fields to capture as part of the compressor.
   */
  readonly equalityChecker: ObjectFieldEqualityChecker<T>;
}

/**
 * An object delta array compressor.
 */
export interface ObjectDeltaArrayCompressor<T extends object> {
  readonly _equalityChecker: ObjectFieldEqualityChecker<T>;
  readonly compress: ObjectDeltaArrayCompressorCompressFunction<T>;
  readonly expand: ObjectDeltaArrayCompressorExpandFunction<T>;
}

/**
 * Creates an object delta array compressor.
 *
 * @param compressor
 */
export function objectDeltaArrayCompressor<T extends object>(config: ObjectDeltaArrayCompressorConfig<T>): ObjectDeltaArrayCompressor<T> {
  const { equalityChecker: _equalityChecker } = config;
  const assignKnownValuesToCopy = assignValuesToPOJOFunction<T, keyof T>({ keysFilter: Array.from(_equalityChecker._fields.keys()), valueFilter: KeyValueTypleValueFilter.NULL });

  function compress(uncompressed: T[]) {
    // return an empty array if there is nothing to compress
    if (uncompressed.length === 0) {
      return [];
    }

    let current = assignKnownValuesToCopy({} as T, uncompressed[0]);
    const result: CompressedObjectDeltaArray<T> = [current];

    uncompressed.slice(1).forEach((next) => {
      const compressed = {} as Building<CompressedObjectDeltaArrayDeltaEntry<T>>;
      const fieldEqualityResult = _equalityChecker(current, next);

      // only append unequal fields
      fieldEqualityResult.unequalFields.forEach((field) => {
        const nextValue = next[field];
        let saveValue: Maybe<typeof nextValue>;

        if (nextValue == null) {
          // if null or undefined, check previous value
          const previousValue = current[field];

          if (previousValue == null) {
            saveValue = undefined; // "no change"
          } else {
            saveValue = null; // "clear"
          }
        } else {
          saveValue = nextValue;
        }

        (compressed as any)[field] = saveValue;
      });

      result.push(compressed as CompressedObjectDeltaArrayDeltaEntry<T>);
      current = next;
    });

    return result;
  }

  const allKeys = Array.from(_equalityChecker._fields.keys());

  function expand(compressed: CompressedObjectDeltaArray<T>): T[] {
    if (compressed.length === 0) {
      return [];
    }

    let current = assignKnownValuesToCopy({} as T, compressed[0]); // first one is never compressed.
    const result: T[] = [current];

    compressed.slice(1).forEach((next) => {
      const uncompressed = {} as Building<T>;

      allKeys.forEach((key) => {
        let setValue: any;

        if (objectHasKey(next as T, key)) {
          const nextValue = (next as CompressedObjectDeltaArrayDeltaEntry<T> as any)[key];

          if (nextValue === null) {
            // do nothing, since the value should be "undefined"
            setValue = undefined;
          } else {
            setValue = nextValue;
          }
        } else {
          setValue = current[key];
        }

        (uncompressed as any)[key] = setValue;
      });

      result.push(uncompressed as T);
      current = uncompressed as T;
    });

    return result;
  }

  return {
    _equalityChecker,
    compress: compress as ObjectDeltaArrayCompressorCompressFunction<T>,
    expand: expand as ObjectDeltaArrayCompressorExpandFunction<T>
  };
}
