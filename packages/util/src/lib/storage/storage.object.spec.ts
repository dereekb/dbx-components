import { StorageObject, StorageObjectUtility } from './storage.object';
import { type Maybe } from '../value/maybe.type';
import { StoredDataStorageKey } from './storage';

// Mock StorageObject implementation for testing
class MockStorageObject extends StorageObject {
  private store = new Map<string, string>();
  private keyOrder: StoredDataStorageKey[] = [];

  getItem(key: StoredDataStorageKey): Maybe<string> {
    return this.store.get(key);
  }

  setItem(key: StoredDataStorageKey, item: Maybe<string>): void {
    if (item != null) {
      if (!this.store.has(key)) {
        this.keyOrder.push(key);
      }
      this.store.set(key, item);
    } else {
      this.removeItem(key);
    }
  }

  removeItem(key: StoredDataStorageKey): void {
    if (this.store.has(key)) {
      this.store.delete(key);
      this.keyOrder = this.keyOrder.filter((k) => k !== key);
    }
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return this.keyOrder[index] || null;
  }

  // Helper to clear for tests
  clear(): void {
    this.store.clear();
    this.keyOrder = [];
  }
}

describe('StorageObjectUtility', () => {
  let mockStorage: MockStorageObject;

  beforeEach(() => {
    mockStorage = new MockStorageObject();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  describe('allKeysFromStorageObject()', () => {
    it('should return an empty array if storage is empty.', () => {
      const keys = StorageObjectUtility.allKeysFromStorageObject(mockStorage);
      expect(keys).toEqual([]);
    });

    it('should return all keys if storage is not empty.', () => {
      mockStorage.setItem('a', '1');
      mockStorage.setItem('b', '2');
      const keys = StorageObjectUtility.allKeysFromStorageObject(mockStorage);
      expect(keys.sort()).toEqual(['a', 'b'].sort());
    });

    it('should filter keys by prefix if provided.', () => {
      mockStorage.setItem('test_a', '1');
      mockStorage.setItem('test_b', '2');
      mockStorage.setItem('other_c', '3');
      const keys = StorageObjectUtility.allKeysFromStorageObject(mockStorage, 'test_');
      expect(keys.sort()).toEqual(['test_a', 'test_b'].sort());
    });

    it('should return an empty array if prefix matches no keys.', () => {
      mockStorage.setItem('a', '1');
      mockStorage.setItem('b', '2');
      const keys = StorageObjectUtility.allKeysFromStorageObject(mockStorage, 'nonexistent_');
      expect(keys).toEqual([]);
    });

    it('should return all keys if prefix matches all keys (or is empty).', () => {
      mockStorage.setItem('match_a', '1');
      mockStorage.setItem('match_b', '2');
      let keys = StorageObjectUtility.allKeysFromStorageObject(mockStorage, 'match_');
      expect(keys.sort()).toEqual(['match_a', 'match_b'].sort());

      keys = StorageObjectUtility.allKeysFromStorageObject(mockStorage, '');
      expect(keys.sort()).toEqual(['match_a', 'match_b'].sort());
    });

    it('should filter out null keys returned by storageObject.key().', () => {
      mockStorage.setItem('a', '1');
      mockStorage.setItem('b', '2');
      // Simulate a scenario where key(index) might return null for a valid index (e.g. sparse array or faulty implementation)
      // For our MockStorageObject, this means directly manipulating keyOrder to include nulls which is not typical
      // but tests the robustness of allKeysFromStorageObject's filter
      Object.defineProperty(mockStorage, 'key', {
        value: (index: number) => (index === 0 ? 'a' : index === 1 ? null : 'b'), // Intentionally return null for one key
        configurable: true
      });
      Object.defineProperty(mockStorage, 'length', { get: () => 3, configurable: true }); // Simulate length including the 'null' key position

      const keys = StorageObjectUtility.allKeysFromStorageObject(mockStorage);
      // Only 'a' and 'b' should be returned as 'null' is filtered out by hasNonNullValue
      expect(keys.sort()).toEqual(['a', 'b'].sort());

      // Restore original properties if needed, though beforeEach handles mockStorage re-creation
    });
  });
});
