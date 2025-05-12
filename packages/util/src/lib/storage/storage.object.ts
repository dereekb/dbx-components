import { type Maybe } from '../value/maybe.type';
import { range } from '../array/array.number';
import { type StoredDataStorageKey } from './storage';
import { hasNonNullValue } from '../value/maybe';

/**
 * Limited Class/Interface for storing string values synchronously.
 */
export abstract class SimpleStorageObject {
  /**
   * Retrieves an item from storage.
   * @param key The key of the item to retrieve.
   * @returns The item string if found, otherwise null or undefined.
   */
  abstract getItem(key: StoredDataStorageKey): Maybe<string>;

  /**
   * Sets an item in storage.
   * @param key The key of the item to set.
   * @param item The item string to store. If null or undefined, the item may be removed depending on implementation.
   */
  abstract setItem(key: StoredDataStorageKey, item: Maybe<string>): void;

  /**
   * Removes an item from storage.
   * @param key The key of the item to remove.
   */
  abstract removeItem(key: StoredDataStorageKey): void;
}

/**
 * Synchronous Class/Interface for storing string values.
 *
 * Has the same interface as localStorage for the web.
 */
export abstract class StorageObject extends SimpleStorageObject {
  /**
   * The number of items stored in the storage object.
   */
  abstract readonly length: number;

  /**
   * Returns the string key for the index.
   *
   * Returns null if no key available.
   * @param index The index of the key to retrieve.
   * @returns The key string if found, otherwise null.
   */
  abstract key(index: number): string | null;
}

/**
 * Extended synchronous Class/Interface for storing string values with additional properties.
 */
export abstract class FullStorageObject extends StorageObject {
  /**
   * Whether or not the storage is persistant.
   */
  abstract readonly isPersistant: boolean;

  /**
   * Whether or not the storage is available for use.
   */
  abstract readonly isAvailable: boolean;

  /**
   * Removes all items from storage.
   * @returns An array of keys that were removed.
   */
  abstract removeAll(): string[];
}

/**
 * Utility class for working with StorageObject instances.
 */
export class StorageObjectUtility {
  /**
   * Retrieves all keys from a StorageObject, optionally filtering by a prefix.
   *
   * @param storageObject The StorageObject to retrieve keys from.
   * @param prefix Optional prefix to filter keys by.
   * @returns An array of StoredDataStorageKey.
   */
  static allKeysFromStorageObject(storageObject: StorageObject, prefix?: string): StoredDataStorageKey[] {
    const length = storageObject.length;
    let result: StoredDataStorageKey[];

    if (length > 0) {
      result = range({ start: 0, end: length })
        .map((x) => storageObject.key(x))
        .filter(hasNonNullValue);

      if (prefix) {
        result = result.filter((x) => x.startsWith(prefix));
      }
    } else {
      result = [];
    }

    return result;
  }
}
