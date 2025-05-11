import { objectHasKey } from '../object/object';
import { type Maybe } from '../value/maybe.type';
import { type StorageObject } from './storage.object';

/**
 * A StorageObject implementation that stores data in memory.
 * This is not persistent and will be cleared when the JavaScript context is lost.
 */
export class MemoryStorageInstance implements StorageObject {
  private _length = 0;
  private _storage: { [key: string]: string } = {};

  /**
   * The number of items stored.
   */
  get length(): number {
    return this._length;
  }

  /**
   * Returns the key at the given index.
   * @param index The index of the key to retrieve.
   * @returns The key string if found, otherwise null.
   */
  key(index: number): string {
    return Object.keys(this._storage)[index] ?? null;
  }

  /**
   * Checks if a key exists in the storage.
   * @param key The key to check.
   * @returns True if the key exists, false otherwise.
   */
  hasKey(key: string): boolean {
    return objectHasKey(this._storage, key);
  }

  /**
   * Retrieves an item from storage.
   * @param key The key of the item to retrieve.
   * @returns The item string if found, otherwise null or undefined.
   */
  getItem(key: string): Maybe<string> {
    return this._storage[key] ?? null;
  }

  /**
   * Sets an item in storage.
   * If the item is null or undefined, the key will be removed.
   * @param key The key of the item to set.
   * @param item The item string to store.
   */
  setItem(key: string, item: Maybe<string>): void {
    if (item == null) {
      this.removeItem(key);
    } else {
      if (!this.hasKey(key)) {
        this._length = this._length + 1;
      }

      this._storage[key] = String(item);
    }
  }

  /**
   * Removes an item from storage.
   * @param key The key of the item to remove.
   */
  removeItem(key: string): void {
    if (this.hasKey(key)) {
      delete this._storage[key]; // Remove the property
      this._length = this._length - 1;
    }
  }

  /**
   * Clears all items from the storage.
   */
  clear(): void {
    this._storage = {};
    this._length = 0;
  }
}

/**
 * A shared, global instance of MemoryStorageInstance.
 * Useful for singleton-like access to an in-memory store throughout an application.
 */
export const SHARED_MEMORY_STORAGE = new MemoryStorageInstance();
