import { Maybe, makeValuesGroupMap, filterMaybeArrayValues, sortByNumberFunction, Getter, cachedGetter, performAsyncTasks } from '@dereekb/util';
import { SyncEntityCommonType, SyncEntityCommonTypeIdPair, SyncEntityCommonTypeIdPairFactoryInput, syncEntityCommonTypeIdPairFactory } from './sync.entity';
import { SyncEntityCommonTypeSynchronizer, SyncEntityCommonTypeSynchronizerFunctionContext, SyncEntityCommonTypeSynchronizerInstance, SyncEntityCommonTypeSynchronizerInstanceFunction, SyncEntityCommonTypeSynchronizerSourceContextType, SyncEntityCommonTypeSynchronizerSourceFlowType } from './sync.entity.synchronizer';
import { SyncSourceClientContext, SyncSourceId, SyncSourceInfo } from './sync.source';
import { MultiplePrimarySyncSourceError, NoPrimarySyncSourceError, SynchronizationFailedError } from './sync.error';

/**
 * BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunction input
 */
export interface BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput {
  /**
   * The entity to synchronize.
   */
  readonly entity: SyncEntityCommonTypeIdPair;
  /**
   * The determined flow type of this source.
   */
  readonly flowType: SyncEntityCommonTypeSynchronizerSourceFlowType;
  /**
   * The source for this entity.
   */
  readonly source: BasicSyncEntityCommonTypeSynchronizerSource;
  /**
   * Additional context information.
   */
  readonly context?: Maybe<BasicSyncEntityCommonTypeSynchronizerEntitySourceContext>;
}

export interface BasicSyncEntityCommonTypeSynchronizerSourceSyncEntitySynchronizeContext {
  readonly deleted?: boolean;
}

/**
 * Creates a new BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityInstance for the input.
 */
export type BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunction = (input: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput) => Promise<BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityInstance>;

export interface BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityInstance {
  /**
   * Performs the create/update synchronization for the entity.
   *
   * The function should typically never throw an error.
   */
  synchronize(): Promise<BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityResult>;
  /**
   * Synchronizes the deletion of the entity.
   *
   * The function should typically never throw an error.
   */
  synchronizeDelete(): Promise<BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityResult>;
}

/**
 * The result of a synchronization. This return type/instance has different implications for different sources of different types.
 *
 * - nochange: The entity was unchanged.
 * - synchronized: The entity was synchronized.
 * - deleted: The entity was deleted or is already deleted. If this is a primary source then the entity will be deleted from all other sources. If this
 * is a secondary source then the synchronization will be restarted so the primary source(s) will be resynchronized again.
 * - failed: The entity was not synchronized due to a failure that was controlled.
 * - error: An unexpected error occurred during synchronization.
 */
export type BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityResultType = 'nochange' | 'synchronized' | 'deleted' | 'failed' | 'error';

/**
 * The result of synchronizing an entity.
 */
export interface BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityResult {
  /**
   * The type of result.
   */
  readonly type: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityResultType;
  /**
   * The error that occurred during synchronization, if one occured.
   */
  readonly error?: Maybe<unknown>;
}

/**
 * A declaration of a source for an entity type.
 *
 * A BasicSyncEntityCommonTypeSynchronizerSource is considered to be a target for synchronization between the current system/server and the SyncSource.
 */
export interface BasicSyncEntityCommonTypeSynchronizerSource {
  readonly info: SyncSourceInfo;
  /**
   * The context type of the source.
   */
  readonly contextType: SyncEntityCommonTypeSynchronizerSourceContextType;
  /**
   * The default flow type of the source.
   */
  readonly defaultFlowType?: Maybe<SyncEntityCommonTypeSynchronizerSourceFlowType>;
  readonly syncEntity: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunction;
}

export interface BasicSyncEntityCommonTypeSynchronizer extends SyncEntityCommonTypeSynchronizer {}

export interface BasicSyncEntityCommonTypeSynchronizerEntitySourceContextLoaderResult {
  /**
   * List of global sources for this entity.
   */
  readonly globalSources: (SyncSourceId | BasicSyncEntityCommonTypeSynchronizerEntitySourceGlobalContext)[];
  /**
   * List of context sources for this entity.
   */
  readonly contextSources: BasicSyncEntityCommonTypeSynchronizerEntitySourceContext[];
}

export interface BasicSyncEntityCommonTypeSynchronizerEntitySourceGlobalContext {
  /**
   * The source id.
   */
  readonly sourceId: SyncSourceId;
  /**
   * The flow type of the source. If not defined, will default to the source's default flow type.
   */
  readonly flowType?: Maybe<SyncEntityCommonTypeSynchronizerSourceFlowType>;
}

export interface BasicSyncEntityCommonTypeSynchronizerEntitySourceContext {
  readonly sourceId: SyncSourceId;
  readonly context: SyncSourceClientContext;
  /**
   * The flow type of the source. If not defined, will default to the source's default flow type.
   */
  readonly flowType?: Maybe<SyncEntityCommonTypeSynchronizerSourceFlowType>;
}

/**
 * Loads source contextual information for a specific entity.
 */
export type BasicSyncEntityCommonTypeSynchronizerEntitySourceContextLoader = (entity: SyncEntityCommonTypeIdPair) => Promise<BasicSyncEntityCommonTypeSynchronizerEntitySourceContextLoaderResult>;

export interface BasicSyncEntityCommonTypeSynchronizerConfig {
  readonly commonType: SyncEntityCommonType;
  /**
   * If true, the sources are considered to be dynamic and will be reloaded/configured each time the synchronizer is called.
   *
   * Defaults to false.
   */
  readonly dynamicSources?: boolean;
  /**
   * All sources for this entity type for this synchronizer.
   */
  readonly sources: BasicSyncEntityCommonTypeSynchronizerSource[];
  /**
   * Loads source contextual information for any source that requires context.
   */
  readonly entitySourceContextLoader: BasicSyncEntityCommonTypeSynchronizerEntitySourceContextLoader;
}

export function basicSyncEntityCommonTypeSynchronizerInstanceFactory(config: BasicSyncEntityCommonTypeSynchronizerConfig): BasicSyncEntityCommonTypeSynchronizer {
  const { commonType, sources, entitySourceContextLoader, dynamicSources = false } = config;
  const syncEntityCommonTypeIdPairForType = syncEntityCommonTypeIdPairFactory(commonType);

  const sourcesByContextType = makeValuesGroupMap(sources, (x) => x.contextType);
  const allGlobalSources = sourcesByContextType.get('global') ?? [];
  const allContextSources = sourcesByContextType.get('context') ?? [];

  /**
   * Loads the relevant sources for the given entity and context.
   *
   * @param entitySourceContext The contextual information for the entity.
   * @returns The relevant sources for the entity.
   */
  function loadSources(entity: SyncEntityCommonTypeIdPair, entitySourceContext: BasicSyncEntityCommonTypeSynchronizerEntitySourceContextLoaderResult): BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput[] {
    const { globalSources, contextSources } = entitySourceContext;

    // load/filter global sources
    const globalMap = new Map<SyncSourceId, BasicSyncEntityCommonTypeSynchronizerEntitySourceGlobalContext>(
      globalSources.map((x) => {
        let sourceId: SyncSourceId;
        let flowType: Maybe<SyncEntityCommonTypeSynchronizerSourceFlowType>;

        if (typeof x === 'string') {
          sourceId = x;
          flowType = 'unset';
        } else {
          sourceId = x.sourceId;
          flowType = x.flowType;
        }

        return [sourceId, { sourceId, flowType }];
      })
    );

    const relevantGlobalSources: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput[] = filterMaybeArrayValues(
      allGlobalSources.map((x) => {
        const sourceContext = globalMap.get(x.info.id);
        let result: Maybe<BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput>;

        if (sourceContext != null) {
          result = {
            entity,
            flowType: sourceContext.flowType ?? x.defaultFlowType ?? 'unset',
            source: x
          };
        }

        return result;
      })
    );

    // load/filter context sources
    const contextMap = new Map<SyncSourceId, BasicSyncEntityCommonTypeSynchronizerEntitySourceContext>(contextSources.map((x) => [x.sourceId, x]));

    const relevantContextSources: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput[] = filterMaybeArrayValues(
      allContextSources.map((x) => {
        const sourceContext = contextMap.get(x.info.id);
        let result: Maybe<BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput>;

        if (sourceContext != null) {
          const flowType = sourceContext.flowType ?? x.defaultFlowType ?? 'unset';
          result = {
            entity,
            flowType,
            source: x,
            context: sourceContext
          };
        }

        return result;
      })
    );

    const allSources = [...relevantGlobalSources, ...relevantContextSources];

    // sort by order, with primary first
    allSources.sort(
      sortByNumberFunction((x) => {
        let result: number;

        switch (x.flowType) {
          case 'primary':
            result = 1;
            break;
          case 'secondary':
            result = 2;
            break;
          case 'unset':
          default:
            result = 3;
            break;
        }

        return result;
      })
    );

    return allSources;
  }

  const synchronizeInstance: SyncEntityCommonTypeSynchronizerInstanceFunction = async (input: SyncEntityCommonTypeIdPairFactoryInput) => {
    const syncEntityCommonTypeIdPair = syncEntityCommonTypeIdPairForType(input);
    const _loadRelevantSources = async () => {
      const entitySourceContext = await entitySourceContextLoader(syncEntityCommonTypeIdPair);
      const relevantSources: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput[] = loadSources(syncEntityCommonTypeIdPair, entitySourceContext);
      return relevantSources;
    };

    let loadRelevantSources: Getter<Promise<BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityFunctionInput[]>>;

    if (dynamicSources) {
      // if dynamic, reload each time and do not cache
      loadRelevantSources = _loadRelevantSources;
    } else {
      // if not dynamic, make a cached getter
      loadRelevantSources = cachedGetter(_loadRelevantSources);
    }

    /**
     * Performs the synchonization
     */
    const synchronize: SyncEntityCommonTypeSynchronizerInstance['synchronize'] = async (context?: Maybe<SyncEntityCommonTypeSynchronizerFunctionContext>) => {
      const {} = context ?? {};
      const relevantSources = await loadRelevantSources();

      const syncEntityInstances = await Promise.all(relevantSources.map((x) => x.source.syncEntity(x).then((y) => [x, y] as const)));
      const sourcesByFlowType = makeValuesGroupMap(syncEntityInstances, (x) => x[0].flowType);

      const primarySources = sourcesByFlowType.get('primary') ?? [];
      const secondarySources = sourcesByFlowType.get('secondary') ?? [];
      const replicaSources = sourcesByFlowType.get('replica') ?? [];

      // assert primary sources count
      switch (primarySources.length) {
        case 0:
          throw new NoPrimarySyncSourceError(syncEntityCommonTypeIdPair);
        case 1:
          break;
        default:
          throw new MultiplePrimarySyncSourceError(syncEntityCommonTypeIdPair);
      }

      function synchronizeInstance(instance: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityInstance) {
        return instance.synchronize().catch((error) => {
          const errorResult: BasicSyncEntityCommonTypeSynchronizerSourceSyncEntityResult = {
            type: 'error',
            error
          };

          return errorResult;
        });
      }

      async function performSynchronizationOfSources() {
        // synchronize the primary source
        const primarySource = primarySources[0];
        const primarySyncResult = await synchronizeInstance(primarySource[1]);

        let deleted = false;

        switch (primarySyncResult.type) {
          case 'nochange':
          case 'synchronized':
            break;
          case 'deleted':
            deleted = true;
            break;
          case 'failed':
          case 'error':
            throw new SynchronizationFailedError(syncEntityCommonTypeIdPair, primarySyncResult.error);
        }

        // synchornize all secondary sources, one after the other

        // synchronize all replica sources concurrently
      }

      const result = await performSynchronizationOfSources();

      return {
        targetPair: syncEntityCommonTypeIdPair,
        entitiesSynchronized: [] // todo: pull from result...
      };
    };

    const instance: SyncEntityCommonTypeSynchronizerInstance = {
      entityPair: syncEntityCommonTypeIdPair,
      synchronize
    };

    return instance;
  };

  const result: BasicSyncEntityCommonTypeSynchronizer = {
    commonType,
    synchronizeInstance
  };

  return result;
}
