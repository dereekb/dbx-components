import { type PrimativeKey, type ReadKeyFunction } from './key';
import { mapToObject } from './object/object';
import { type IndexRef } from './value/indexed';
import { type Building } from './value/build';
import { type EqualityComparatorFunction } from './value/comparator';
import { type DecisionFunction } from './value/decision';
import { type Maybe } from './value/maybe.type';

// MARK: Types
export interface SeparateResult<T> {
  included: T[];
  excluded: T[];
}

export interface GroupingResult<T> {
  [key: string]: T[];
}

export type KeyedGroupingResult<T, O> = {
  [K in keyof O]: T[];
};

export interface PairsGroupingResult<T> {
  pairs: T[][];
  unpaired: T[];
}

export interface ArrayContentsDifferentParams<T, K extends PrimativeKey = PrimativeKey> {
  groupKeyFn: ReadKeyFunction<T, K>;
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
export type IndexedBatch<T> = T[] & Readonly<IndexRef>;

/**
 * Batches items from the input array into several batches of a maximum size.
 *
 * @param array
 * @param batchSize
 * @returns
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
 * Calculates a BatchCount given the input.
 *
 * @param input
 * @returns
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
 * Convenience function for calling restoreOrder with two arrays of values, instead of an array of keys and array of values.
 *
 * @param orderValues
 * @param values
 * @param params
 * @returns
 */
export function restoreOrderWithValues<T, K extends PrimativeKey = PrimativeKey>(orderValues: T[], values: T[], params: RestoreOrderParams<T, K>): T[] {
  const { readKey } = params;
  const orderKeys = orderValues.map((x) => readKey(x));
  return restoreOrder(orderKeys as K[], values, params);
}

/**
 * Restores the order to the input values based on their keys.
 *
 * Duplicate values are passed to the chooseRetainedValue function past. When no function is provided, duplicates are ignored.
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
 * Returns true if the input differs from eachother.
 *
 * Input items are uniquely keyed in some fashion. The same items are paired up.
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
 * Creates a tuples array of key and value pairs.
 *
 * @param values
 * @param keyFn
 * @returns
 */
export function makeKeyPairs<T, K extends string | number = string | number>(values: T[], keyFn: ReadKeyFunction<T, K>): [Maybe<K>, T][] {
  return values.map((x) => [keyFn(x), x]);
}

/**
 * Separates the input values into an included and excluded group.
 *
 * @param values
 * @param checkInclusion
 * @returns
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
 * Convenience function for makeValuesGroupMap that returns a POJO instead of a Map.
 *
 * @param values
 * @param groupKeyFn
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
 * Reads keys from the values in the arrays, and groups them together into a Map.
 *
 * @param values
 * @param groupKeyFn
 * @returns
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
