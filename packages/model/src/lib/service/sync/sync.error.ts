import { BaseError } from 'make-error';
import { type SyncEntityCommonType, type SyncEntityCommonTypeIdPair } from './sync.entity';

/**
 * Error thrown when the common type is not known/registered.
 */
export class UnregisteredSyncEntityCommonTypeError extends BaseError {
  constructor(public readonly commonType: SyncEntityCommonType) {
    super(`The common type "${commonType}" is not registered.`);
  }
}

/**
 * Error thrown when no primary sync source is found for an entity.
 */
export class NoPrimarySyncSourceError extends BaseError {
  constructor(public readonly entity: SyncEntityCommonTypeIdPair) {
    super(`No primary sync source found for entity "${entity.commonType}:${entity.commonId}".`);
  }
}

/**
 * Error thrown when multiple primary sync sources are found for an entity.
 */
export class MultiplePrimarySyncSourceError extends BaseError {
  constructor(public readonly entity: SyncEntityCommonTypeIdPair) {
    super(`Multiple primary sync sources found for entity "${entity.commonType}:${entity.commonId}".`);
  }
}

/**
 * Error thrown when a synchronization fails for an entity.
 */
export class SynchronizationFailedError extends BaseError {
  constructor(
    public readonly entity: SyncEntityCommonTypeIdPair,
    readonly error: unknown
  ) {
    super(`Synchronization failed for entity "${entity.commonType}:${entity.commonId}". Error: ${error}`);
  }
}
