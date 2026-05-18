import { MemoryStorageInstance, type StorageObject } from '@dereekb/util';
import { FullLocalStorageObject } from './storage.object.localstorage';

describe('FullLocalStorageObject', () => {
  describe('isAvailable', () => {
    it('should return true when the underlying storage accepts setItem/removeItem', () => {
      const storage = new FullLocalStorageObject(new MemoryStorageInstance());
      expect(storage.isAvailable).toBe(true);
    });

    it('should return false when the underlying storage throws on setItem', () => {
      const throwingStorage: StorageObject = new MemoryStorageInstance();
      throwingStorage.setItem = () => {
        throw new Error('quota exceeded');
      };

      const storage = new FullLocalStorageObject(throwingStorage);
      expect(storage.isAvailable).toBe(false);
    });
  });
});
