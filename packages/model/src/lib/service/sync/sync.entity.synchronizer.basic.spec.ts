import { SyncEntity, SyncEntityCommonTypeIdPair, syncEntityFactory } from './sync.entity';
import { SyncEntityCommonTypeSynchronizationEntityResult, SyncEntityCommonTypeSynchronizationEntityResultType } from './sync.entity.synchronizer';
import { BasicSyncEntityCommonTypeSynchronizerEntitySourceContextLoaderResult, basicSyncEntityCommonTypeSynchronizerInstanceFactory, BasicSyncEntityCommonTypeSynchronizerSource, BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput, BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityInstance, BasicSyncEntityCommonTypeSynchronizerSourceSyncEntitySynchronizeFunction } from './sync.entity.synchronizer.basic';
import { SyncSourceInfo } from './sync.source';

const SYSTEM_SOURCE_ID = 'system';
const SYSTEM_SOURCE_NAME = 'System';

const SYSTEM_SOURCE_INFO: SyncSourceInfo = {
  id: SYSTEM_SOURCE_ID,
  name: SYSTEM_SOURCE_NAME
};

const SOURCE_SYSTEM_ENTITY_FACTORY = syncEntityFactory({
  sourceInfo: SYSTEM_SOURCE_INFO
});

const SOURCE_A_ID = 'sourceA';
const SOURCE_A_NAME = 'Source A';

const SOURCE_A_INFO: SyncSourceInfo = {
  id: SOURCE_A_ID,
  name: SOURCE_A_NAME
};

const SOURCE_A_ENTITY_FACTORY = syncEntityFactory({
  idFactory: (x) => `${x}-sourceA`,
  sourceInfo: SOURCE_A_INFO
});

const SOURCE_B_ID = 'sourceB';
const SOURCE_B_NAME = 'Source B';

const SOURCE_C_ID = 'sourceC';
const SOURCE_C_NAME = 'Source C';

const COMMON_TYPE = 'test';

describe('basicSyncEntityCommonTypeSynchronizerInstanceFactory()', () => {
  describe('instance', () => {
    const testSystemItemResultType: SyncEntityCommonTypeSynchronizationEntityResultType = 'synchronized';
    const testSourceAItemResultType: SyncEntityCommonTypeSynchronizationEntityResultType = 'synchronized';

    const sources: BasicSyncEntityCommonTypeSynchronizerSource[] = [
      // system
      {
        info: SYSTEM_SOURCE_INFO,
        contextType: 'global',
        syncEntityInstance: async (input: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput): Promise<BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityInstance> => {
          const entity: SyncEntity = SOURCE_SYSTEM_ENTITY_FACTORY(input.entityCommonTypeIdPair);

          const synchronize: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntitySynchronizeFunction = async () => {
            const result: SyncEntityCommonTypeSynchronizationEntityResult = {
              type: testSystemItemResultType,
              entity
            };

            return result;
          };

          const instance: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityInstance = {
            synchronize,
            synchronizeDelete: synchronize
          };

          return instance;
        }
      },
      /**
       * source A
       *
       * A example source with no default flow type and requires a context.
       */
      {
        info: SOURCE_A_INFO,
        contextType: 'context',
        syncEntityInstance: async (input: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput): Promise<BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityInstance> => {
          const { entityCommonTypeIdPair, flowType, source, context } = input;
          const entity: SyncEntity = SOURCE_A_ENTITY_FACTORY(entityCommonTypeIdPair);

          const synchronize: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntitySynchronizeFunction = async () => {
            // performs the actual synchronization
            const result: SyncEntityCommonTypeSynchronizationEntityResult = {
              type: testSourceAItemResultType,
              entity
            };

            return result;
          };

          const synchronizeDelete: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntitySynchronizeFunction = async () => {
            // performs the actual synchronization
            const result: SyncEntityCommonTypeSynchronizationEntityResult = {
              type: 'deleted',
              entity
            };

            return result;
          };

          const instance: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityInstance = {
            synchronize,
            synchronizeDelete
          };

          return instance;
        }
      }
    ];

    describe('only replica sources', () => {
      const factory = basicSyncEntityCommonTypeSynchronizerInstanceFactory({
        commonType: COMMON_TYPE,
        sources,
        entitySourceContextLoader: async (entity: SyncEntityCommonTypeIdPair) => {
          // example: loads the context source details

          const result: BasicSyncEntityCommonTypeSynchronizerEntitySourceContextLoaderResult = {
            // global sources
            globalSources: [
              {
                sourceId: SYSTEM_SOURCE_ID,
                flowType: 'primary'
              }
            ],
            // context details
            contextSources: [
              {
                sourceId: SOURCE_A_ID,
                flowType: 'replica',
                context: {
                  // TODO: ...
                }
              }
            ]
          };

          return result;
        }
      });

      describe('synchronize()', () => {
        it('should synchronize the entity', async () => {
          const commonEntity: SyncEntityCommonTypeIdPair = {
            commonId: 'test',
            commonType: COMMON_TYPE
          };

          const instance = await factory.synchronizeInstance(commonEntity);
          const result = await instance.synchronize();

          expect(result.targetPair).toBe(commonEntity);
          expect(result.entitiesSynchronized).toHaveLength(2);
          expect(result.entitiesSynchronized[0].type).toBe('synchronized');
          expect(result.entitiesSynchronized[0].entity.id).toBe(SOURCE_SYSTEM_ENTITY_FACTORY(commonEntity).id);
          expect(result.entitiesSynchronized[1].type).toBe('synchronized');
          expect(result.entitiesSynchronized[1].entity.id).toBe(SOURCE_A_ENTITY_FACTORY(commonEntity).id);
        });
      });
    });

    describe('only secondary sources', () => {
      const factory = basicSyncEntityCommonTypeSynchronizerInstanceFactory({
        commonType: COMMON_TYPE,
        sources,
        entitySourceContextLoader: async (entity: SyncEntityCommonTypeIdPair) => {
          // example: loads the context source details

          const result: BasicSyncEntityCommonTypeSynchronizerEntitySourceContextLoaderResult = {
            // global sources
            globalSources: [
              {
                sourceId: SYSTEM_SOURCE_ID,
                flowType: 'primary'
              }
            ],
            // context details
            contextSources: [
              {
                sourceId: SOURCE_A_ID,
                flowType: 'secondary',
                context: {
                  // TODO: ...
                }
              }
            ]
          };

          return result;
        }
      });

      describe('synchronize()', () => {
        it('should synchronize the entity', async () => {
          const commonEntity: SyncEntityCommonTypeIdPair = {
            commonId: 'test',
            commonType: COMMON_TYPE
          };

          const instance = await factory.synchronizeInstance(commonEntity);
          const result = await instance.synchronize();

          expect(result.targetPair).toBe(commonEntity);
          expect(result.entitiesSynchronized).toHaveLength(2);
          expect(result.entitiesSynchronized[0].type).toBe('synchronized');
          expect(result.entitiesSynchronized[0].entity.id).toBe(SOURCE_SYSTEM_ENTITY_FACTORY(commonEntity).id);
          expect(result.entitiesSynchronized[1].type).toBe('synchronized');
          expect(result.entitiesSynchronized[1].entity.id).toBe(SOURCE_A_ENTITY_FACTORY(commonEntity).id);
        });
      });
    });
  });
});
