import { type PrimativeKey, type ReadKeyFunction } from './key';
import { mapToObject } from './object/object';
import { type IndexRef } from './value/indexed';
import { type Building } from './value/build';
import { type EqualityComparatorFunction } from './value/comparator';
import { type DecisionFunction } from './value/decision';
import { type Maybe } from './value/maybe.type';

// MARK: Types
/**
 * Result of separating values into two groups based on an inclusion check.
 */
export interface SeparateResult<T> {
  included: T[];
  excluded: T[];
}

/**
 * A plain object where each key maps to an array of grouped values.
 */
export interface GroupingResult<T> {
  [key: string]: T[];
}

/**
 * A typed grouping result where keys are constrained to the keys of a known object type.
 */
export type KeyedGroupingResult<T, O> = {
  [K in keyof O]: T[];
};

/**
 * Result of pairing values by their key. Values that share a key form a pair; values with unique keys are unpaired.
 */
export interface PairsGroupingResult<T> {
  pairs: T[][];
  unpaired: T[];
}

/**
 * Configuration for comparing two arrays to determine if their contents differ.
 */
export interface ArrayContentsDifferentParams<T, K extends PrimativeKey = PrimativeKey> {
  /** Extracts a unique key from each item for pairing items across arrays. */
  groupKeyFn: ReadKeyFunction<T, K>;
  /** Compares two paired items for equality. */
  isEqual: EqualityComparatorFunction<T>;
}

/**
 * Configuration for RestoreOrderParams.
 */
export interface RestoreOrderParams<T, K extends number | string = number | string> {
  readKey: ReadKeyFunction<T, K>;
  /**
   * Optional function used to decide which value should be retained.
   */
  chooseRetainedValue?: (values: T[]) => T;
  /**
   * Whether or not new items should be excluded. If false, the new items are appended to the end of the result in the order they are accessed.
   *
   * By default this is false.
   */
  excludeNewItems?: boolean;
}

// MARK: Functions
/**
 * An array batch that carries its zero-based batch index via {@link IndexRef}.
 */
export type IndexedBatch<T> = T[] & Readonly<IndexRef>;

/**
 * Splits the input array into batches of a maximum size. Each batch carries its zero-based index as `.i`.
 *
 * @param input - The array to split into batches.
 * @param batchSize - Maximum number of items per batch.
 * @returns An array of {@link IndexedBatch} arrays.
 *
 * @example
 * ```ts
 * const result = batch(['a', 'b', 'c', 'd'], 2);
 * // result[0] => ['a', 'b'], result[0].i => 0
 * // result[1] => ['c', 'd'], result[1].i => 1
 * ```
 */
export function batch<T>(input: T[], batchSize: number): IndexedBatch<T>[] {
  const array: T[] = [...input]; // Copy array before splicing it.
  const batches: IndexedBatch<T>[] = [];
  let i = 0;

  while (array.length > 0) {
    const batch = array.splice(0, batchSize) as IndexedBatch<T>;
    (batch as Building<IndexedBatch<T>>).i = i;
    batches.push(batch);
    i += 1;
  }

  return batches;
}

export interface BatchCount {
  /**
   * Total number of items to make.
   */
  totalItems: number;
  /**
   * Size of each batch/expected max number of items to create per make call.
   */
  itemsPerBatch: number;
}

export interface BatchCalc extends BatchCount {
  batchCount: number;
  /**
   * Total number of full batches.
   */
  fullBatchCount: number;
  /**
   * The number of items not in a full batch.
   */
  remainder: number;
}

/**
 * Calculates batch metrics (count, full batches, remainder) from a {@link BatchCount} configuration.
 *
 * @param input - The total items and items-per-batch configuration.
 * @returns A {@link BatchCalc} with computed batch counts and remainder.
 */
export function batchCalc(input: BatchCount): BatchCalc {
  const { totalItems: total, itemsPerBatch: batchSize } = input;
  const batchCount = Math.ceil(total / batchSize);
  const remainder = total % batchSize;
  const fullBatchCount = remainder ? batchCount - 1 : batchCount;

  return {
    totalItems: input.totalItems,
    itemsPerBatch: input.itemsPerBatch,
    batchCount,
    fullBatchCount,
    remainder
  };
}

/**
 * Returns how many items are in the batch at the given index, accounting for a possible smaller remainder batch at the end.
 *
 * @param index - Zero-based batch index.
 * @param calc - Pre-computed batch calculation from {@link batchCalc}.
 * @returns The number of items in that batch.
 */
export function itemCountForBatchIndex(index: number, calc: BatchCalc): number {
  let itemCount: number;

  if (index < calc.fullBatchCount) {
    itemCount = calc.itemsPerBatch;
  } else {
    itemCount = calc.remainder;
  }

  return itemCount;
}

/**
 * Convenience wrapper for {@link restoreOrder} that derives order keys from a reference array of values
 * instead of requiring a separate keys array.
 *
 * @param orderValues - Values whose keys define the desired order.
 * @param values - Values to reorder.
 * @param params - Configuration including the key-reading function.
 * @returns The reordered values array.
 */
export function restoreOrderWithValues<T, K extends PrimativeKey = PrimativeKey>(orderValues: T[], values: T[], params: RestoreOrderParams<T, K>): T[] {
  const { readKey } = params;
  const orderKeys = orderValues.map((x) => readKey(x));
  return restoreOrder(orderKeys as K[], values, params);
}

/**
 * Reorders values to match a reference key ordering. Values not present in the order keys
 * are appended at the end (unless `excludeNewItems` is true). Duplicates are resolved via
 * the `chooseRetainedValue` function (defaults to keeping the first).
 *
 * @param orderKeys - Keys defining the desired order.
 * @param values - Values to reorder.
 * @param params - Configuration including key reader, duplicate handling, and new-item behavior.
 * @returns The reordered values array.
 *
 * @example
 * ```ts
 * const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
 * const order = ['c', 'a', 'b'];
 * restoreOrder(order, items, { readKey: (x) => x.key });
 * // [{ key: 'c' }, { key: 'a' }, { key: 'b' }]
 * ```
 */
export function restoreOrder<T, K extends PrimativeKey = PrimativeKey>(orderKeys: K[], values: T[], { readKey, chooseRetainedValue = (values: T[]) => values[0], excludeNewItems = false }: RestoreOrderParams<T, K>): T[] {
  const valuesMap = makeValuesGroupMap(values, readKey);
  const orderKeysMap = new Map<Maybe<K>, number>(orderKeys.map((x, i) => [x, i]));

  const restoredOrder: T[] = new Array<T>();
  const newItems: T[] = [];

  valuesMap.forEach((values: T[], key: Maybe<K>) => {
    const index = orderKeysMap.get(key);

    function getValue() {
      return values.length > 1 ? chooseRetainedValue(values) : values[0];
    }

    if (index != null) {
      restoredOrder[index] = getValue();
    } else if (!excludeNewItems) {
      newItems.push(getValue());
    }
  });

  const result = [...restoredOrder, ...newItems].filter((x) => x !== undefined); // Allow null to be passed.
  return result;
}

/**
 * Compares two arrays by pairing items with matching keys and checking equality.
 * Returns `true` if lengths differ, any items are unpaired, or any paired items are not equal.
 *
 * @param a - First array to compare.
 * @param b - Second array to compare.
 * @param params - Key extraction and equality functions.
 * @returns `true` if the array contents differ.
 */
export function arrayContentsDiffer<T, K extends PrimativeKey = PrimativeKey>(a: T[] = [], b: T[] = [], { groupKeyFn, isEqual }: ArrayContentsDifferentParams<T, K>): boolean {
  let areDifferent = false;

  if (a.length === b.length) {
    const pairs = pairGroupValues([...a, ...b], groupKeyFn);

    if (pairs.unpaired) {
      // Any unpaired items means there is a difference.
      areDifferent = true;
    } else {
      for (const [aa, bb] of pairs.pairs) {
        // If any item is not the same, break.
        if (!isEqual(aa, bb)) {
          areDifferent = true;
          break;
        }
      }
    }
  } else {
    areDifferent = true; // Different lengths, different content.
  }

  return areDifferent;
}

/**
 * Groups values by key, then separates them into pairs (values sharing a key) and unpaired (unique key).
 *
 * @param values - Values to group and pair.
 * @param groupKeyFn - Extracts the grouping key from each value.
 * @returns A {@link PairsGroupingResult} with paired and unpaired values.
 */
export function pairGroupValues<T, K extends PrimativeKey = PrimativeKey>(values: T[], groupKeyFn: ReadKeyFunction<T, K>): PairsGroupingResult<T> {
  const map = makeValuesGroupMap<T, K>(values, groupKeyFn);
  const pairs: T[][] = [];
  const unpaired: T[] = [];

  map.forEach((x: T[]) => {
    if (x.length === 1) {
      unpaired.push(x[0]);
    } else {
      pairs.push(x);
    }
  });

  return {
    pairs,
    unpaired
  };
}

/**
 * Creates an array of `[key, value]` tuples by extracting a key from each value.
 *
 * @param values - Values to create key pairs from.
 * @param keyFn - Extracts the key from each value.
 * @returns An array of `[key, value]` tuples.
 */
export function makeKeyPairs<T, K extends string | number = string | number>(values: T[], keyFn: ReadKeyFunction<T, K>): [Maybe<K>, T][] {
  return values.map((x) => [keyFn(x), x]);
}

/**
 * Separates values into included and excluded groups based on a decision function.
 *
 * @param values - Values to separate.
 * @param checkInclusion - Returns `true` for values that should be included.
 * @returns A {@link SeparateResult} with included and excluded arrays.
 */
export function separateValues<T>(values: T[], checkInclusion: DecisionFunction<T>): SeparateResult<T> {
  const result: KeyedGroupingResult<T, { in: unknown; out: unknown }> = groupValues(values, (x) => {
    return checkInclusion(x) ? 'in' : 'out';
  });

  return {
    included: result.in || [],
    excluded: result.out || []
  };
}

/**
 * Groups values by key into a plain object. Convenience wrapper around {@link makeValuesGroupMap} that returns a POJO instead of a Map.
 *
 * @param values - Values to group.
 * @param groupKeyFn - Extracts the grouping key from each value.
 * @returns A plain object mapping each key to its array of values.
 */
export function groupValues<T, R, K extends PrimativeKey & keyof R>(values: T[], groupKeyFn: ReadKeyFunction<T, K>): KeyedGroupingResult<T, R>;
export function groupValues<T, K extends PrimativeKey = PrimativeKey>(values: T[], groupKeyFn: ReadKeyFunction<T, K>): GroupingResult<T>;
export function groupValues<T, R, K extends PrimativeKey & keyof R>(values: Maybe<T[]>, groupKeyFn: ReadKeyFunction<T, K>): KeyedGroupingResult<T, R>;
export function groupValues<T, K extends PrimativeKey = PrimativeKey>(values: Maybe<T[]>, groupKeyFn: ReadKeyFunction<T, K>): GroupingResult<T>;
export function groupValues<T, K extends PrimativeKey = PrimativeKey>(values: Maybe<T[]>, groupKeyFn: ReadKeyFunction<T, K>): GroupingResult<T> {
  const map = makeValuesGroupMap<T, K>(values, groupKeyFn);
  return mapToObject(map as Map<PropertyKey, T[]>);
}

/**
 * Groups values by key into a Map. Each key maps to the array of values that produced that key.
 *
 * @param values - Values to group.
 * @param groupKeyFn - Extracts the grouping key from each value.
 * @returns A Map from each key to its array of values.
 *
 * @example
 * ```ts
 * const items = [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }];
 * const map = makeValuesGroupMap(items, (x) => x.type);
 * // Map { 'a' => [{ type: 'a', v: 1 }, { type: 'a', v: 3 }], 'b' => [{ type: 'b', v: 2 }] }
 * ```
 */
export function makeValuesGroupMap<T, K extends PrimativeKey = PrimativeKey>(values: T[], groupKeyFn: ReadKeyFunction<T, K>): Map<Maybe<K>, T[]>;
export function makeValuesGroupMap<T, K extends PrimativeKey = PrimativeKey>(values: Maybe<T[]>, groupKeyFn: ReadKeyFunction<T, K>): Map<Maybe<K>, T[]>;
export function makeValuesGroupMap<T, K extends PrimativeKey = PrimativeKey>(values: Maybe<T[]>, groupKeyFn: ReadKeyFunction<T, K>): Map<Maybe<K>, T[]> {
  const map = new Map<Maybe<K>, T[]>();

  if (values != null) {
    values.forEach((x) => {
      const key = groupKeyFn(x);
      const array = map.get(key);

      if (array != null) {
        array.push(x);
      } else {
        map.set(key, [x]);
      }
    });
  }

  return map;
}
