import { UniqueModel } from '@dereekb/util';
import { SyncSourceInfo } from './sync.source';

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

export function syncEntityCommonTypeIdPairFactory(commonType: SyncEntityCommonType): SyncEntityCommonTypeIdPairFactory {
  return (input: SyncEntityCommonTypeIdPairFactoryInput) => {
    if (typeof input === 'string') {
      return {
        commonType,
        commonId: input
      };
    } else {
      return input;
    }
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
