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

/**
 * Whether or not the object needs to be synchronized.
 *
 * This is used in cases where the boolean is only ever true, and is generally undefined on the object when false.
 */
export type NeedsSyncBoolean = boolean;
