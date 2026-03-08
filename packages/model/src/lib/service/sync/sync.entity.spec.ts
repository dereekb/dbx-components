import { syncEntityCommonTypeIdPairFactory, syncEntityFactory, type SyncEntityCommonTypeIdPair } from './sync.entity';
import { type SyncSourceInfo } from './sync.source';

describe('syncEntityCommonTypeIdPairFactory()', () => {
  const commonType = 'user';
  const factory = syncEntityCommonTypeIdPairFactory(commonType);

  it('should wrap a string input into a pair with the configured common type', () => {
    const result = factory('abc123');

    expect(result.commonType).toBe(commonType);
    expect(result.commonId).toBe('abc123');
  });

  it('should pass through an existing pair as-is', () => {
    const pair: SyncEntityCommonTypeIdPair = { commonType: 'order', commonId: 'xyz' };
    const result = factory(pair);

    expect(result).toBe(pair);
    expect(result.commonType).toBe('order');
    expect(result.commonId).toBe('xyz');
  });
});

describe('syncEntityFactory()', () => {
  const sourceInfo: SyncSourceInfo = { id: 'api', name: 'External API' };

  describe('with default id factory', () => {
    const factory = syncEntityFactory({ sourceInfo });

    it('should create a SyncEntity using commonId as the entity id', () => {
      const pair: SyncEntityCommonTypeIdPair = { commonType: 'user', commonId: 'abc123' };
      const entity = factory(pair);

      expect(entity.id).toBe('abc123');
      expect(entity.commonType).toBe('user');
      expect(entity.commonId).toBe('abc123');
      expect(entity.sourceInfo).toBe(sourceInfo);
    });
  });

  describe('with custom id factory', () => {
    const factory = syncEntityFactory({
      sourceInfo,
      idFactory: (commonId) => `custom-${commonId}`
    });

    it('should create a SyncEntity using the custom id factory', () => {
      const pair: SyncEntityCommonTypeIdPair = { commonType: 'user', commonId: 'abc123' };
      const entity = factory(pair);

      expect(entity.id).toBe('custom-abc123');
      expect(entity.commonType).toBe('user');
      expect(entity.commonId).toBe('abc123');
      expect(entity.sourceInfo).toBe(sourceInfo);
    });
  });
});
