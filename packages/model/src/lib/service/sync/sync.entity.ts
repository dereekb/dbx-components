import { type FactoryWithRequiredInput, MAP_IDENTITY, type Maybe, type UniqueModel } from '@dereekb/util';
import { type SyncSourceInfo } from './sync.source';

/**
 * A unique identifier for an entity on a specific server.
 */
export type SyncEntityId = string;

/**
 * A common type for an entity that is shared/used between all systems for an entity that should be synchronized.
 */
export type SyncEntityCommonType = string;

/**
 * A common identifier for an entity that is shared/used between all systems for an entity that should be synchronized.
 *
 * This identifier should be used for retrieving a similar entity from any server.
 */
export type SyncEntityCommonId = string;

/**
 * A pair of common type and common id for an entity.
 */
export interface SyncEntityCommonTypeIdPair {
  readonly commonType: SyncEntityCommonType;
  readonly commonId: SyncEntityCommonId;
}

export type SyncEntityCommonTypeIdPairFactoryInput = SyncEntityCommonTypeIdPair | SyncEntityCommonId;
export type SyncEntityCommonTypeIdPairFactory = (input: SyncEntityCommonTypeIdPairFactoryInput) => SyncEntityCommonTypeIdPair;

/**
 * Creates a factory that normalizes a {@link SyncEntityCommonTypeIdPairFactoryInput} into a full {@link SyncEntityCommonTypeIdPair}.
 *
 * If the input is a string, it is treated as a commonId and paired with the given commonType.
 * If the input is already a pair, it is returned as-is.
 *
 * @param commonType - the default common type to use when input is a plain string
 * @returns a factory function that produces SyncEntityCommonTypeIdPair instances
 *
 * @example
 * ```typescript
 * const factory = syncEntityCommonTypeIdPairFactory('user');
 * factory('abc123');  // { commonType: 'user', commonId: 'abc123' }
 * factory({ commonType: 'user', commonId: 'abc123' });  // passed through as-is
 * ```
 */
export function syncEntityCommonTypeIdPairFactory(commonType: SyncEntityCommonType): SyncEntityCommonTypeIdPairFactory {
  return (input: SyncEntityCommonTypeIdPairFactoryInput) => {
    let result: SyncEntityCommonTypeIdPair;

    if (typeof input === 'string') {
      result = {
        commonType,
        commonId: input
      };
    } else {
      result = input;
    }

    return result;
  };
}

/**
 * Represents a single entity that can be synchronized between different servers.
 */
export interface SyncEntity extends UniqueModel, SyncEntityCommonTypeIdPair {
  /**
   * The unique identifier for the entity on the server.
   */
  readonly id: SyncEntityId;
  /**
   * The server information for the entity.
   */
  readonly sourceInfo: SyncSourceInfo;
}

/**
 * Configuration for syncEntityFactory().
 */
export interface SyncEntityFactoryConfig {
  /**
   * The source information to attach to the entity.
   */
  readonly sourceInfo: SyncSourceInfo;
  /**
   * Optional factory for generating the entity's id from the common id.
   */
  readonly idFactory?: Maybe<(commonId: SyncEntityCommonId) => SyncEntityId>;
}

/**
 * Factory for creating a SyncEntity.
 */
export type SyncEntityFactory = FactoryWithRequiredInput<SyncEntity, SyncEntityCommonTypeIdPair>;

/**
 * Creates a {@link SyncEntityFactory} that produces {@link SyncEntity} instances from a common type/id pair.
 *
 * The factory attaches the configured source info and optionally transforms the commonId into an entity id
 * using the provided idFactory (defaults to identity).
 *
 * @param config - source info and optional id factory
 * @returns a factory that creates SyncEntity instances
 *
 * @example
 * ```typescript
 * const factory = syncEntityFactory({
 *   sourceInfo: { id: 'api', name: 'External API' }
 * });
 *
 * const entity = factory({ commonType: 'user', commonId: 'abc123' });
 * // entity.id === 'abc123', entity.sourceInfo.id === 'api'
 * ```
 */
export function syncEntityFactory(config: SyncEntityFactoryConfig): SyncEntityFactory {
  const { idFactory: inputIdFactory, sourceInfo } = config;
  const idFactory = inputIdFactory ?? MAP_IDENTITY;

  return (input: SyncEntityCommonTypeIdPair) => {
    const { commonType, commonId } = input;
    const id = idFactory(commonId);

    return {
      commonType,
      commonId,
      id,
      sourceInfo
    };
  };
}
