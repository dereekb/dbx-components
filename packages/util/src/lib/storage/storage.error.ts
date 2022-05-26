import { BaseError } from 'make-error';
import { ReadStoredData } from './storage';

export class StoredDataError extends BaseError {
  constructor(message?: string) {
    super(message);
  }
}

export class DataDoesNotExistError extends StoredDataError {
  constructor(message?: string) {
    super(message);
  }
}

export class DataIsExpiredError<T> extends StoredDataError {
  constructor(public readonly data: ReadStoredData<T>, message?: string) {
    super(message);
  }
}
