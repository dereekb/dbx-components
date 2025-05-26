import { filterMaybeArrayValues } from '../array';
import { cachedGetter, Getter, makeGetter } from '../getter';
import { makeValuesGroupMap } from '../grouping';
import { Maybe } from '../value/maybe.type';
import { SyncEntityCommonType, SyncEntityCommonTypeIdPair, SyncEntityCommonTypeIdPairFactoryInput, syncEntityCommonTypeIdPairFactory } from './sync.entity';
import { SyncEntityCommonTypeSynchronizer, SyncEntityCommonTypeSynchronizerFunctionContext, SyncEntityCommonTypeSynchronizerInstance, SyncEntityCommonTypeSynchronizerInstanceFunction } from './sync.entity.synchronizer';
import { SyncSourceClientContext, SyncSourceId, SyncSourceInfo } from './sync.source';

/**
 * The context type of source for an entity.
 *
 * - Global: The source is available to all contexts. Example: Configured API for the server.
 * - Context: The source is only available to a specific context. Example: Configured per-user OAuth client for a specific user.
 */
export type SyncEntityCommonTypeSynchronizerSourceContextType = 'global' | 'context';

/**
 * The flow type of source for an entity.
 *
 * - Primary: The general/primary source of truth for an entity. There should only be one primary source.
 * - Secondary: A secondary source for the entity that information can be pulled from and may be used to update the primary source.
 * - Replica: A replica of the primary source for the entity that is never used to update other sources.
 * - Unset: The flow type is not set. This is only used when a source is not configured properly and will be ignored.
 */
export type SyncEntityCommonTypeSynchronizerSourceFlowType = 'primary' | 'secondary' | 'replica' | 'unset';

/**
 * A declaration of a source for an entity type.
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

  interface SyncEntityCommonTypeSynchronizerInstanceSource {
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

  /**
   * Loads the relevant sources for the given entity and context.
   *
   * @param entitySourceContext The contextual information for the entity.
   * @returns The relevant sources for the entity.
   */
  function loadSources(entitySourceContext: BasicSyncEntityCommonTypeSynchronizerEntitySourceContextLoaderResult): SyncEntityCommonTypeSynchronizerInstanceSource[] {
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

    const relevantGlobalSources: SyncEntityCommonTypeSynchronizerInstanceSource[] = filterMaybeArrayValues(
      allGlobalSources.map((x) => {
        const sourceContext = globalMap.get(x.info.id);
        let result: Maybe<SyncEntityCommonTypeSynchronizerInstanceSource>;

        if (sourceContext != null) {
          result = {
            flowType: sourceContext.flowType ?? x.defaultFlowType ?? 'unset',
            source: x
          };
        }

        return result;
      })
    );

    // load/filter context sources
    const contextMap = new Map<SyncSourceId, BasicSyncEntityCommonTypeSynchronizerEntitySourceContext>(contextSources.map((x) => [x.sourceId, x]));

    const relevantContextSources: SyncEntityCommonTypeSynchronizerInstanceSource[] = filterMaybeArrayValues(
      allContextSources.map((x) => {
        const sourceContext = contextMap.get(x.info.id);
        let result: Maybe<SyncEntityCommonTypeSynchronizerInstanceSource>;

        if (sourceContext != null) {
          const flowType = sourceContext.flowType ?? x.defaultFlowType ?? 'unset';
          result = {
            flowType,
            source: x,
            context: sourceContext
          };
        }

        return result;
      })
    );

    const allSources = [...relevantGlobalSources, ...relevantContextSources];

    // sort by order

    return allSources;
  }

  const synchronizeInstance: SyncEntityCommonTypeSynchronizerInstanceFunction = async (input: SyncEntityCommonTypeIdPairFactoryInput) => {
    const syncEntityCommonTypeIdPair = syncEntityCommonTypeIdPairForType(input);
    const _loadRelevantSources = async () => {
      const entitySourceContext = await entitySourceContextLoader(syncEntityCommonTypeIdPair);
      const relevantSources: SyncEntityCommonTypeSynchronizerInstanceSource[] = loadSources(entitySourceContext);
      return relevantSources;
    };

    let loadRelevantSources: Getter<Promise<SyncEntityCommonTypeSynchronizerInstanceSource[]>>;

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

      // TODO: perfom synchronization

      return {
        targetPair: syncEntityCommonTypeIdPair,
        entitiesSynchronized: []
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
