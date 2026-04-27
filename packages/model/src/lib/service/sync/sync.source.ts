/**
 * English name for a SyncSource.
 *
 * Is not used as a key.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-model:sync
 */
export type SyncSourceName = string;

/**
 * A unique identifier for a SyncSource.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-model:sync
 */
export type SyncSourceId = string;

/**
 * Information for a SyncSource.
 */
export interface SyncSourceInfo {
  readonly id: SyncSourceId;
  readonly name: SyncSourceName;
}

/**
 * A generic API/server that contains entities.
 */
export interface SyncSource {
  readonly info: SyncSourceInfo;
}

/**
 * Contextual information for a SyncSource.
 */
export interface SyncSourceClientContext {}

/**
 * Details for a SyncSource for a specific context, such as an OAuth user/client.
 */
export interface SyncSourceClientDetails<T = unknown> {
  readonly details: T;
}
