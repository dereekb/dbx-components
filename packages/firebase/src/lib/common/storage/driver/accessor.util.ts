import { type Readable } from 'stream';
import { type StorageUploadOptions } from '../types';
import { type FirebaseStorageAccessorFile } from './accessor';
import { StorageFileUploadStreamUnsupportedError } from './error';

/**
 * Uploads data to a storage file by piping a readable stream into the file's writable upload stream.
 *
 * This is a server-side convenience — most client implementations don't support `uploadStream()`.
 *
 * @param file - the target file accessor to upload to
 * @param readableStream - the source stream to pipe
 * @param options - optional upload configuration (content type, metadata, etc.)
 * @returns a promise that resolves when the upload stream has finished
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
