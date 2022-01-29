import { Maybe } from '../value';
import { range, filterMaybeValuesFn } from '../array';
import { StoredDataStorageKey } from './storage';

/**
 * Limited Class/Interface for storing string values synchronously.
 */
export abstract class SimpleStorageObject {

  abstract getItem(key: StoredDataStorageKey): Maybe<string>;

  abstract setItem(key: StoredDataStorageKey, item: Maybe<string>): void;

  abstract removeItem(key: StoredDataStorageKey): void;

}

/**
 * Synchronous Class/Interface for storing string values.
 *
 * Has the same interface as localStorage for the web.
 */
export abstract class StorageObject extends SimpleStorageObject {

  abstract readonly length: number;

  /**
   * Returns the string key for the index.
   *
   * Returns null if no key available.
   */
  abstract key(index: number): string | null;

}

export abstract class FullStorageObject extends StorageObject {

  abstract readonly isPersistant: boolean;

  abstract readonly isAvailable: boolean;

  abstract removeAll(): string[];

}

export class StorageObjectUtility {

  static allKeysFromStorageObject(storageObject: StorageObject, prefix?: string): StoredDataStorageKey[] {
    const length = storageObject.length;
    let result: StoredDataStorageKey[];

    if (length > 0) {
      result = range({ start: 0, end: length }).map((x) => storageObject.key(x)).filter(filterMaybeValuesFn);

      if (prefix) {
        result = result.filter((x) => x.startsWith(prefix));
      }
    } else {
      result = [];
    }

    return result;
  }

}
