import { BaseError } from 'make-error';
import { SyncEntity, SyncEntityCommonType, SyncEntityCommonTypeIdPair, SyncEntityCommonTypeIdPairFactoryInput } from './sync.entity';
import { Maybe } from '../value/maybe.type';
import { SyncSourceId } from './sync.source';

/**
 * Error thrown when the common type is not known/registered.
 */
export class UnregisteredSyncEntityCommonTypeError extends BaseError {
  constructor(public readonly commonType: SyncEntityCommonType) {
    super(`The common type "${commonType}" is not registered.`);
  }
}

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
 * Specific entity synchronization information within a SyncEntityCommonTypeSynchronizationResult.
 */
export interface SyncEntityCommonTypeSynchronizationEntityResult {
  readonly entity: SyncEntity;
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
