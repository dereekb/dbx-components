import { objectHasKey } from '../object/object';
import { Maybe } from '../value/maybe.type';
import { StorageObject } from './storage.object';

export class MemoryStorageInstance implements StorageObject {
  private _length = 0;
  private _storage: { [key: string]: string } = {};

  get length(): number {
    return this._length;
  }

  key(index: number): string {
    return Object.keys(this._storage)[index] ?? null;
  }

  hasKey(key: string): boolean {
    return objectHasKey(this._storage, key);
  }

  getItem(key: string): Maybe<string> {
    return this._storage[key] ?? null;
  }

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

  removeItem(key: string): void {
    if (this.hasKey(key)) {
      delete this._storage[key]; // Remove the property
      this._length = this._length - 1;
    }
  }

  clear(): void {
    this._storage = {};
    this._length = 0;
  }
}

export const SHARED_MEMORY_STORAGE = new MemoryStorageInstance();
