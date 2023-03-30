import { forEachInIterable, iterableToMap } from '../iterable';
import { PrimativeKey, ReadKeyFunction } from '../key';
import { addToSetCopy } from './set';

/**
 * How the value's presence changed from one set to the next.
 */
export enum SetDeltaChange {
  REMOVED = -1,
  NONE = 0, // No change
  ADDED = 1
}

/**
 * Returns true if the next value has been modified compared to the past value.
 */
export type SetValueIsModifiedFunction<T> = (past: T, next: T) => boolean;

export interface SetDeltaChangePair<T, K extends PrimativeKey = PrimativeKey> {
  /**
   * Key for this pair
   */
  readonly key: K;
  /**
   * Value as it was in the past set, if applicable.
   */
  readonly pastValue?: T;
  /**
   * Value as it was in the next set, if applicable.
   */
  readonly nextValue?: T;
  /**
   * Evaluated value.
   */
  readonly value: T;
  /**
   * How the value changed.
   */
  readonly change: SetDeltaChange;
  /**
   * Whether or not the value was modified.
   */
  readonly isModified?: boolean;
}

/**
 * Function that builds an array of changes based on the values in the past array to the next array.
 */
export type SetDeltaFunction<T, K extends PrimativeKey = PrimativeKey> = (past: Iterable<T>, next: Iterable<T>) => SetDeltaChangePair<T, K>[];

export interface SetDeltaFunctionConfig<T, K extends PrimativeKey = PrimativeKey> {
  /**
   * Reads the identifying key from each input value.
   */
  readKey: ReadKeyFunction<T, K>;
  /**
   * Whether or not the value is modified.
   */
  isModifiedFunction?: SetValueIsModifiedFunction<T>;
}

export function setDeltaFunction<T>(config: SetDeltaFunctionConfig<T>): SetDeltaFunction<T> {
  const { readKey, isModifiedFunction = () => undefined } = config;

  return (past: Iterable<T>, next: Iterable<T>) => {
    const result: SetDeltaChangePair<T>[] = [];

    const pastMap = iterableToMap(past, readKey);
    const nextMap = iterableToMap(next, readKey);

    const pastMapKeys = new Set(pastMap.keys());
    const nextMapKeys = new Set(nextMap.keys());

    const allKeys = addToSetCopy(pastMapKeys, nextMapKeys);

    forEachInIterable(allKeys, (key) => {
      // skip values with no key
      if (key == null) {
        return;
      }

      const inPast = pastMapKeys.has(key);
      const inNext = nextMapKeys.has(key);

      let change: SetDeltaChange;

      if (inNext && inPast) {
        change = SetDeltaChange.NONE;
      } else if (inPast) {
        change = SetDeltaChange.REMOVED;
      } else {
        change = SetDeltaChange.ADDED;
      }

      const pastValue = inPast ? pastMap.get(key) : undefined;
      const nextValue = inNext ? nextMap.get(key) : undefined;

      const isModified = pastValue && nextValue ? isModifiedFunction(pastValue, nextValue) : undefined;

      result.push({
        key,
        pastValue,
        nextValue,
        change,
        isModified,
        value: (nextValue ?? pastValue) as T
      });
    });

    return result;
  };
}

/**
 * Keys mapped by their change type.
 */
export interface SetDeltaChangeKeys<K extends PrimativeKey = PrimativeKey> {
  readonly removed: K[];
  readonly none: K[];
  readonly added: K[];
}

/**
 * Creates a SetDeltaChangeKeys from the input SetDeltaChangePair values.
 *
 * @param pairs
 * @returns
 */
export function setDeltaChangeKeys<T, K extends PrimativeKey = PrimativeKey>(pairs: SetDeltaChangePair<T, K>[]): SetDeltaChangeKeys<K> {
  const removed: K[] = [];
  const none: K[] = [];
  const added: K[] = [];

  pairs.forEach((x) => {
    switch (x.change) {
      case SetDeltaChange.ADDED:
        added.push(x.key);
        break;
      case SetDeltaChange.NONE:
        none.push(x.key);
        break;
      case SetDeltaChange.REMOVED:
        removed.push(x.key);
        break;
    }
  });

  return {
    removed,
    none,
    added
  };
}

/**
 * Pre-configured SetDeltaFunction for PrimativeKey values.
 */
export const primativeValuesDelta = setDeltaFunction<PrimativeKey>({ readKey: (x) => x }) as <T extends PrimativeKey>(past: Iterable<T>, next: Iterable<T>) => SetDeltaChangePair<T>[];
