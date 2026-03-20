import { type StorageDataStringType, type StorageUploadOptions } from '../types';
import { BaseError } from 'make-error';

// MARK: Upload Options
/**
 * Extracts and asserts that a `stringFormat` is present in the upload options.
 *
 * Required when the upload input is a string, since the format (raw, base64, etc.) must be explicit.
 *
 * @param options - the upload options to extract from
 * @returns the {@link StorageDataStringType} extracted from the options
 * @throws {Error} When `stringFormat` is not set in the options.
 */
export function assertStorageUploadOptionsStringFormat(options?: StorageUploadOptions): StorageDataStringType {
  const stringFormat = options?.stringFormat;

  if (!stringFormat) {
    throw noStringFormatInStorageUploadOptionsError();
  }

  return stringFormat;
}

/**
 * Creates an error indicating that `stringFormat` was missing from upload options.
 *
 * @returns an {@link Error} describing the missing `stringFormat` in upload options
 */
export function noStringFormatInStorageUploadOptionsError() {
  return new Error('stringFormat was missing a value in the StorageUploadOptions.');
}

// MARK: Stream Error
/**
 * Thrown when attempting to use `uploadStream()` on a file accessor that does not support it.
 *
 * Stream uploads are typically only available on server-side (Google Cloud Storage) implementations.
 */
export class StorageFileUploadStreamUnsupportedError extends BaseError {
  constructor() {
    super('Failed to upload file using a stream. The file does not support upload streams.');
  }
}
