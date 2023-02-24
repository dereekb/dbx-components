/**
 * Synchronization state enum that defines whether or not an object is synchronized.
 */
export enum SyncState {
  /**
   * The object is out of sync.
   */
  OUT_OF_SYNC = 0,
  /**
   * The object is synced.
   */
  SYNCED = 1
}

/**
 * Whether or not the object is synchronized.
 */
export type SyncStateBoolean = boolean;
