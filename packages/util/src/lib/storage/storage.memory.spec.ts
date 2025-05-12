import { MemoryStorageInstance, SHARED_MEMORY_STORAGE } from './storage.memory';

describe('MemoryStorageInstance', () => {
  let storage: MemoryStorageInstance;

  beforeEach(() => {
    storage = new MemoryStorageInstance();
  });

  it('should be an instance of MemoryStorageInstance', () => {
    expect(storage).toBeInstanceOf(MemoryStorageInstance);
  });

  describe('setItem()', () => {
    it('should add an item and increase length.', () => {
      storage.setItem('testKey', 'testValue');
      expect(storage.length).toBe(1);
      expect(storage.getItem('testKey')).toBe('testValue');
    });

    it('should update an existing item and length should remain the same.', () => {
      storage.setItem('testKey', 'initialValue');
      storage.setItem('testKey', 'updatedValue');
      expect(storage.length).toBe(1);
      expect(storage.getItem('testKey')).toBe('updatedValue');
    });

    it('should remove an item if value is null.', () => {
      storage.setItem('testKey', 'testValue');
      storage.setItem('testKey', null);
      expect(storage.length).toBe(0);
      expect(storage.getItem('testKey')).toBeNull();
    });

    it('should remove an item if value is undefined.', () => {
      storage.setItem('testKey', 'testValue');
      storage.setItem('testKey', undefined);
      expect(storage.length).toBe(0);
      expect(storage.getItem('testKey')).toBeNull();
    });
  });

  describe('getItem()', () => {
    it('should return the value for an existing key.', () => {
      storage.setItem('testKey', 'testValue');
      expect(storage.getItem('testKey')).toBe('testValue');
    });

    it('should return null for a non-existent key.', () => {
      expect(storage.getItem('nonExistentKey')).toBeNull();
    });
  });

  describe('removeItem()', () => {
    it('should remove an existing item and decrease length.', () => {
      storage.setItem('testKey', 'testValue');
      storage.removeItem('testKey');
      expect(storage.length).toBe(0);
      expect(storage.getItem('testKey')).toBeNull();
    });

    it('should do nothing if key does not exist.', () => {
      storage.setItem('actualKey', 'value');
      storage.removeItem('nonExistentKey');
      expect(storage.length).toBe(1);
    });
  });

  describe('length', () => {
    it('should return 0 for an empty storage.', () => {
      expect(storage.length).toBe(0);
    });

    it('should return the correct number of items.', () => {
      storage.setItem('key1', 'value1');
      storage.setItem('key2', 'value2');
      expect(storage.length).toBe(2);
    });
  });

  describe('key()', () => {
    it('should return the key at the specified index.', () => {
      storage.setItem('keyA', 'valueA');
      storage.setItem('keyB', 'valueB');
      // Note: Order depends on Object.keys(), which is generally insertion order for non-integer keys
      // but not strictly guaranteed by JS spec for all engines/scenarios. Test assumes typical behavior.
      const keys = [storage.key(0), storage.key(1)].sort();
      expect(keys).toEqual(['keyA', 'keyB'].sort());
    });

    it('should return null if index is out of bounds.', () => {
      storage.setItem('keyA', 'valueA');
      expect(storage.key(1)).toBeNull();
      expect(storage.key(-1)).toBeNull();
    });
  });

  describe('hasKey()', () => {
    it('should return true if the key exists.', () => {
      storage.setItem('testKey', 'testValue');
      expect(storage.hasKey('testKey')).toBe(true);
    });

    it('should return false if the key does not exist.', () => {
      expect(storage.hasKey('nonExistentKey')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all items and set length to 0.', () => {
      storage.setItem('key1', 'value1');
      storage.setItem('key2', 'value2');
      storage.clear();
      expect(storage.length).toBe(0);
      expect(storage.getItem('key1')).toBeNull();
      expect(storage.getItem('key2')).toBeNull();
      expect(storage.key(0)).toBeNull();
    });
  });
});

describe('SHARED_MEMORY_STORAGE', () => {
  it('should be an instance of MemoryStorageInstance.', () => {
    expect(SHARED_MEMORY_STORAGE).toBeInstanceOf(MemoryStorageInstance);
  });

  it('should allow items to be set and retrieved.', () => {
    // Test with a unique key to avoid interference if tests run in parallel or share context (though jest typically isolates)
    const uniqueKey = `shared_test_${Date.now()}`;
    SHARED_MEMORY_STORAGE.setItem(uniqueKey, 'sharedValue');
    expect(SHARED_MEMORY_STORAGE.getItem(uniqueKey)).toBe('sharedValue');
    SHARED_MEMORY_STORAGE.removeItem(uniqueKey); // Clean up
    expect(SHARED_MEMORY_STORAGE.getItem(uniqueKey)).toBeNull();
  });
});
