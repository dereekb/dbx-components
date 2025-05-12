import { StoredDataError, DataDoesNotExistError, DataIsExpiredError } from './storage.error';
import { type ReadStoredData } from './storage';
import { BaseError } from 'make-error';

describe('StoredDataError', () => {
  it('should be an instance of BaseError and StoredDataError.', () => {
    const error = new StoredDataError();
    expect(error).toBeInstanceOf(BaseError);
    expect(error).toBeInstanceOf(StoredDataError);
  });

  it('should have the correct message.', () => {
    const message = 'Test stored data error';
    const error = new StoredDataError(message);
    expect(error.message).toBe(message);
  });

  it('should have the name StoredDataError.', () => {
    const error = new StoredDataError();
    expect(error.name).toBe('StoredDataError');
  });
});

describe('DataDoesNotExistError', () => {
  it('should be an instance of StoredDataError and DataDoesNotExistError.', () => {
    const error = new DataDoesNotExistError();
    expect(error).toBeInstanceOf(StoredDataError);
    expect(error).toBeInstanceOf(DataDoesNotExistError);
  });

  it('should have the correct message.', () => {
    const message = 'Test data does not exist error';
    const error = new DataDoesNotExistError(message);
    expect(error.message).toBe(message);
  });

  it('should have the name DataDoesNotExistError.', () => {
    const error = new DataDoesNotExistError();
    expect(error.name).toBe('DataDoesNotExistError');
  });
});

describe('DataIsExpiredError', () => {
  const mockExpiredData: ReadStoredData<string> = {
    data: 'test data',
    storedAt: 0, // Some past time
    expired: true,
    convertedData: 'test data'
  };

  it('should be an instance of StoredDataError and DataIsExpiredError.', () => {
    const error = new DataIsExpiredError(mockExpiredData);
    expect(error).toBeInstanceOf(StoredDataError);
    expect(error).toBeInstanceOf(DataIsExpiredError);
  });

  it('should have the provided message.', () => {
    const message = 'Test data is expired error';
    const error = new DataIsExpiredError(mockExpiredData, message);
    expect(error.message).toBe(message);
  });

  it('should have a default message if none is provided.', () => {
    const error = new DataIsExpiredError(mockExpiredData);
    expect(error.message).toBe('Data has expired.');
  });

  it('should store the provided data.', () => {
    const error = new DataIsExpiredError(mockExpiredData);
    expect(error.data).toBe(mockExpiredData);
  });

  it('should have the name DataIsExpiredError.', () => {
    const error = new DataIsExpiredError(mockExpiredData);
    expect(error.name).toBe('DataIsExpiredError');
  });
});
