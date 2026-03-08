import { syncEntitySynchronizer, type SyncEntityCommonTypeSynchronizer, type SyncEntityCommonTypeSynchronizerInstance } from './sync.entity.synchronizer';
import { UnregisteredSyncEntityCommonTypeError } from './sync.error';
import { type SyncEntityCommonTypeIdPair } from './sync.entity';

describe('syncEntitySynchronizer()', () => {
  const userCommonType = 'user';
  const orderCommonType = 'order';

  const mockUserSynchronizer: SyncEntityCommonTypeSynchronizer = {
    commonType: userCommonType,
    synchronizeInstance: async (input) => {
      const pair: SyncEntityCommonTypeIdPair = typeof input === 'string' ? { commonType: userCommonType, commonId: input } : input;

      const instance: SyncEntityCommonTypeSynchronizerInstance = {
        entityPair: pair,
        synchronize: async () => ({
          targetPair: pair,
          entitiesSynchronized: []
        })
      };

      return instance;
    }
  };

  const mockOrderSynchronizer: SyncEntityCommonTypeSynchronizer = {
    commonType: orderCommonType,
    synchronizeInstance: async (input) => {
      const pair: SyncEntityCommonTypeIdPair = typeof input === 'string' ? { commonType: orderCommonType, commonId: input } : input;

      const instance: SyncEntityCommonTypeSynchronizerInstance = {
        entityPair: pair,
        synchronize: async () => ({
          targetPair: pair,
          entitiesSynchronized: []
        })
      };

      return instance;
    }
  };

  const synchronizer = syncEntitySynchronizer({
    commonTypeSynchronizers: [mockUserSynchronizer, mockOrderSynchronizer]
  });

  describe('commonTypes', () => {
    it('should list all registered common types', () => {
      expect(synchronizer.commonTypes).toContain(userCommonType);
      expect(synchronizer.commonTypes).toContain(orderCommonType);
      expect(synchronizer.commonTypes).toHaveLength(2);
    });
  });

  describe('commonTypeSynchronizer()', () => {
    it('should return the synchronizer for a registered common type', () => {
      const result = synchronizer.commonTypeSynchronizer(userCommonType);
      expect(result).toBe(mockUserSynchronizer);
    });

    it('should throw UnregisteredSyncEntityCommonTypeError for an unknown type', () => {
      expect(() => synchronizer.commonTypeSynchronizer('unknown')).toThrow(UnregisteredSyncEntityCommonTypeError);
    });
  });

  describe('synchronizeInstance()', () => {
    it('should delegate to the correct common type synchronizer', async () => {
      const pair: SyncEntityCommonTypeIdPair = { commonType: userCommonType, commonId: '123' };
      const instance = await synchronizer.synchronizeInstance(pair);

      expect(instance).toBeDefined();
      expect(instance.entityPair).toEqual(pair);
    });

    it('should throw for an unknown common type', async () => {
      const pair: SyncEntityCommonTypeIdPair = { commonType: 'unknown', commonId: '123' };

      await expect(async () => synchronizer.synchronizeInstance(pair)).rejects.toThrow(UnregisteredSyncEntityCommonTypeError);
    });
  });
});
