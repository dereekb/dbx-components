import { type UnixDateTimeNumber } from '../date/date';

/**
 * String representation of data that is stored.
 */
export type StoredDataString = string;
/**
 * Key used for accessing stored data.
 */
export type StoredDataStorageKey = string;

/**
 * Interface for data that has been stored, including metadata about its storage time.
 */
export interface StoredData {
  /**
   * The Unix timestamp (in milliseconds) when the data was stored.
   * Undefined if the storage time is not known or not applicable.
   */
  readonly storedAt: UnixDateTimeNumber | undefined;
  /**
   * The actual data stored, as a string.
   */
  readonly data: StoredDataString;
}

/**
 * Interface for retrieved stored data that has been processed.
 * Extends StoredData with information about expiration and the converted data form.
 *
 * @template T The type of the converted data.
 */
export interface ReadStoredData<T> extends StoredData {
  /**
   * Whether the stored data is considered expired.
   */
  readonly expired: boolean;
  /**
   * The data after being converted from its string representation to type T.
   */
  readonly convertedData: T;
}
