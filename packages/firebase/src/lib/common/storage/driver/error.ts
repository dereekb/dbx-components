import { StorageDataStringType, StorageUploadOptions } from '../types';

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
