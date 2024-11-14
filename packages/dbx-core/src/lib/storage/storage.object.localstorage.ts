import { FullStorageObject, Maybe, StorageObject, StorageObjectUtility, StoredDataStorageKey } from '@dereekb/util';

/**
 * StorageObject using LocalStorage.
 */
export class FullLocalStorageObject implements FullStorageObject {
  private readonly _localStorage: StorageObject;

  constructor(localStorage: StorageObject) {
    this._localStorage = localStorage;
  }

  get isPersistant(): boolean {
    return true;
  }

  get isAvailable(): boolean {
    const test = '_T_E_S_T_';

    try {
      // Tests setting and removing an item. These will throw an
      // exception if the localstorage is not available
      this._localStorage.setItem(test, test);
      this._localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  get length(): number {
    return this._localStorage.length;
  }

  getItem(key: StoredDataStorageKey): Maybe<string> {
    return this._localStorage.getItem(key);
  }

  setItem(key: StoredDataStorageKey, item: string): void {
    this._localStorage.setItem(key, item);
  }

  removeItem(key: StoredDataStorageKey): void {
    this._localStorage.removeItem(key);
  }

  key(index: number): string | null {
    return this._localStorage.key(index);
  }

  removeAll(): string[] {
    const keys = StorageObjectUtility.allKeysFromStorageObject(this);
    keys.forEach((x) => this.removeItem(x));
    return keys;
  }
}
