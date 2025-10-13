import { type StorageDataStringType, type StorageUploadOptions } from '../types';
import { BaseError } from 'make-error';

// MARK: Upload Options
export function assertStorageUploadOptionsStringFormat(options?: StorageUploadOptions): StorageDataStringType {
  const stringFormat = options?.stringFormat;

  if (!stringFormat) {
    throw noStringFormatInStorageUploadOptionsError();
  }

  return stringFormat;
}

export function noStringFormatInStorageUploadOptionsError() {
  return new Error('stringFormat was missing a value in the StorageUploadOptions.');
}

// MARK: Stream Error
export class StorageFileUploadStreamUnsupportedError extends BaseError {
  constructor() {
    super('Failed to upload file using a stream. The file does not support upload streams.');
  }
}
