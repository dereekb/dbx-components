import { SyncEntity, SyncEntityCommonType, SyncEntityCommonTypeIdPair, SyncEntityCommonTypeIdPairFactoryInput } from './sync.entity';
import { Maybe } from '@dereekb/util';
import { UnregisteredSyncEntityCommonTypeError } from './sync.error';

/**
 * The context type of source for an entity.
 *
 * - Global: The source is available to all contexts. Example: Configured API for the server.
 * - Context: The source is only available to a specific context. Example: Configured per-user OAuth client for a specific user.
 */
export type SyncEntityCommonTypeSynchronizerSourceContextType = 'global' | 'context';

/**
 * The flow type of source for an entity. These are used to determine the order of synchronization.
 *
 * - Primary: The general/primary source of truth for an entity. There should typically only be one primary source.
 * When a primary source returns deleted, then all other sources will be notified for deletion.
 *
 * - Secondary: A secondary source for the entity that information can be pulled from and may be used to update the primary source.
 * When a secondary source returns deleted, then the synchronization will be restarted so the primary source(s) will be synchronized again to confirm the deletion.
 *
 * - Replica: A replica of the primary source for the entity that is never used to update other sources.
 * - Unset: The flow type is not set. This is only used when a source is not configured properly and will be ignored.
 */
export type SyncEntityCommonTypeSynchronizerSourceFlowType = 'primary' | 'secondary' | 'replica' | 'unset';

/**
 * The base synchronizer for entities.
 */
export interface SyncEntitySynchronizer {
  /**
   * List of common types that can be synchronized by this synchronizer.
   */
  readonly commonTypes: SyncEntityCommonType[];
  /**
   * Returns the synchronizer for the given common type.
   *
   * Throws an error if the common type is not registered.
   *
   * @param input The common type to synchronize.
   * @returns The synchronizer for the common type.
   */
  commonTypeSynchronizer(input: SyncEntityCommonType): SyncEntityCommonTypeSynchronizer;
  /**
   * Creates a new synchronizer instance for the input entity.
   *
   * Throws an error if the common type is not registered.
   *
   * @param input The common type and id of the entity to synchronize.
   * @returns The synchronizer instance for the entity.
   */
  synchronizeInstance(input: SyncEntityCommonTypeSynchronizerInstanceInput): Promise<SyncEntityCommonTypeSynchronizerInstance>;
}

export interface SyncEntitySynchronizerConfig {
  readonly commonTypeSynchronizers: SyncEntityCommonTypeSynchronizer[];
}

export function syncEntitySynchronizer(config: SyncEntitySynchronizerConfig): SyncEntitySynchronizer {
  const map = new Map<SyncEntityCommonType, SyncEntityCommonTypeSynchronizer>(config.commonTypeSynchronizers.map((x) => [x.commonType, x]));
  const commonTypes = Array.from(map.keys());

  const commonTypeSynchronizer = (input: SyncEntityCommonType): SyncEntityCommonTypeSynchronizer => {
    const synchronizer = map.get(input);

    if (!synchronizer) {
      throw new UnregisteredSyncEntityCommonTypeError(input);
    }

    return synchronizer;
  };

  return {
    commonTypes,
    commonTypeSynchronizer,
    synchronizeInstance: (input: SyncEntityCommonTypeIdPair) => {
      const synchronizer = commonTypeSynchronizer(input.commonType);
      return synchronizer.synchronizeInstance(input);
    }
  };
}

export type SyncEntityCommonTypeSynchronizerInstanceInput = SyncEntityCommonTypeIdPairFactoryInput;
export type SyncEntityCommonTypeSynchronizerInstanceFunction = (input: SyncEntityCommonTypeSynchronizerInstanceInput) => Promise<SyncEntityCommonTypeSynchronizerInstance>;

/**
 * Used for creating a new synchronization strategy for entities of a specific common type.
 */
export interface SyncEntityCommonTypeSynchronizer {
  /**
   * The common type for the entity.
   */
  readonly commonType: SyncEntityCommonType;
  /**
   * Creates a new synchronizer for the entity.
   *
   * @param input The common type and id of the entity to synchronize.
   * @returns The synchronizer for the entity.
   */
  readonly synchronizeInstance: SyncEntityCommonTypeSynchronizerInstanceFunction;
}

/**
 * The result of synchronizing an entity.
 */
export interface SyncEntityCommonTypeSynchronizationResult {
  readonly targetPair: SyncEntityCommonTypeIdPair;
  readonly entitiesSynchronized: SyncEntityCommonTypeSynchronizationEntityResult[];
}

/**
 * The result of a synchronization. This return type/instance has different implications for different sources of different types.
 *
 * - nochange: The entity was unchanged.
 * - synchronized: The entity was synchronized.
 * - deleted: The entity was deleted or is already deleted. If this is a primary source then the entity will be deleted from all other sources. If this
 * is a secondary source then the synchronization will be restarted so the primary source(s) will be resynchronized again.
 * - failed: The entity was not synchronized due to a failure that was controlled. Unless this is a primary source, should not cancel the synchronization of other sources.
 * - error: An unexpected error occurred during synchronization.
 */
export type SyncEntityCommonTypeSynchronizationEntityResultType = 'nochange' | 'synchronized' | 'deleted' | 'failed' | 'error';

/**
 * Specific entity synchronization information within a SyncEntityCommonTypeSynchronizationResult.
 */
export interface SyncEntityCommonTypeSynchronizationEntityResult {
  /**
   * The entity that was synchronized.
   *
   * For results with the "error" result type, the actual id may not be provided or accurate.
   */
  readonly entity: SyncEntity;
  /**
   * The type of result.
   */
  readonly type: SyncEntityCommonTypeSynchronizationEntityResultType;
  /**
   * The error that occurred during synchronization, if one occured.
   */
  readonly error?: Maybe<unknown>;
}

export interface SyncEntityCommonTypeSynchronizerFunctionContext {}

/**
 * Performs the synchronization process for the given entity.
 *
 * @returns A promise that resolves when the synchronization is complete.
 */
export type SyncEntityCommonTypeSynchronizerFunction = (context?: Maybe<SyncEntityCommonTypeSynchronizerFunctionContext>) => Promise<SyncEntityCommonTypeSynchronizationResult>;

/**
 * A concrete instance that refernces a specific entity to synchronize.
 */
export interface SyncEntityCommonTypeSynchronizerInstance {
  readonly entityPair: SyncEntityCommonTypeIdPair;
  /**
   * Performs the synchronization process for the given entity.
   *
   * @returns A promise that resolves when the synchronization is complete.
   */
  readonly synchronize: SyncEntityCommonTypeSynchronizerFunction;
}
