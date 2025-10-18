import { type Readable } from 'stream';
import { type StorageUploadOptions } from '../types';
import { type FirebaseStorageAccessorFile } from './accessor';
import { StorageFileUploadStreamUnsupportedError } from './error';

/**
 * Uploads a file using a Readable, using the uploadStream() method on the FirebaseStorageAccessorFile.
 *
 * If uploadStream is not supported, a StorageFileUploadStreamUnsupportedError will be thrown.
 *
 * @param file The file to upload to.
 * @param readableStream The stream to upload.
 * @param options The upload options.
 * @returns A promise that resolves when the upload is complete.
 */
export async function uploadFileWithStream<R = unknown>(file: FirebaseStorageAccessorFile<R>, readableStream: Readable, options?: StorageUploadOptions): Promise<void> {
  if (!file.uploadStream) {
    throw new StorageFileUploadStreamUnsupportedError();
  }

  const uploadStream = file.uploadStream(options);
  readableStream.pipe(uploadStream, { end: true });

  return new Promise((resolve, reject) => {
    uploadStream.on('finish', resolve);
    uploadStream.on('error', reject);
  });
}
