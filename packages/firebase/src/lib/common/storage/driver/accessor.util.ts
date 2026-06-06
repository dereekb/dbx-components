import { type Readable } from 'node:stream';
import { type StorageUploadOptions } from '../types';
import { type FirebaseStorageAccessorFile } from './accessor';
import { StorageFileUploadStreamUnsupportedError } from './error';

/**
 * Uploads data to a storage file by piping a readable stream into the file's writable upload stream.
 *
 * This is a server-side convenience — most client implementations don't support `uploadStream()`.
 *
 * @param file - Destination file accessor for the upload.
 * @param readableStream - Source stream piped into the upload.
 * @param options - Overrides for content type, metadata, etc., if any.
 * @returns Resolves once the upload stream has finished.
 * @throws {StorageFileUploadStreamUnsupportedError} When the file accessor does not support stream uploads.
 *
 * @example
 * ```ts
 * const file = storageContext.file('data/export.csv');
 * const readable = fs.createReadStream('/tmp/export.csv');
 * await uploadFileWithStream(file, readable, { contentType: 'text/csv' });
 * ```
 */
export async function uploadFileWithStream<R = unknown>(file: FirebaseStorageAccessorFile<R>, readableStream: Pick<Readable, 'pipe'>, options?: StorageUploadOptions): Promise<void> {
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
