import { BaseError } from 'make-error';
import { type ReadStoredData } from './storage';

/**
 * Base error class for storage-related issues.
 */
export class StoredDataError extends BaseError {
  /**
   * Creates an instance of StoredDataError.
   * @param message Optional error message.
   */
  constructor(message?: string) {
    super(message);
  }
}

/**
 * Error thrown when requested data does not exist in storage.
 */
export class DataDoesNotExistError extends StoredDataError {
  /**
   * Creates an instance of DataDoesNotExistError.
   * @param message Optional error message.
   */
  constructor(message?: string) {
    super(message);
  }
}

/**
 * Error thrown when data exists in storage but is considered expired.
 *
 * @template T The type of the data that is expired.
 */
export class DataIsExpiredError<T> extends StoredDataError {
  /**
   * Creates an instance of DataIsExpiredError.
   * @param data The expired data, including metadata.
   * @param message Optional error message. If not provided, a default message will be used.
   */
  constructor(
    readonly data: ReadStoredData<T>,
    message?: string
  ) {
    super(message ?? 'Data has expired.');
  }
}
