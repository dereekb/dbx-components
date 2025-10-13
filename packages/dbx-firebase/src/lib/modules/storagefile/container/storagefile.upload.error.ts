import { BaseError } from 'make-error';
import { StorageFileUploadFilesFinalResult } from './storagefile.upload.handler';

/**
 * Error that is thrown when a single file fails to upload.
 */
export class StorageFileUploadFilesError extends BaseError {
  readonly result: StorageFileUploadFilesFinalResult;

  constructor(result: StorageFileUploadFilesFinalResult) {
    super('Failed to upload all files.');
    this.result = result;
  }
}
