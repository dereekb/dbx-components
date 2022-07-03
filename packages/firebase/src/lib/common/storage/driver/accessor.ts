import { StorageBucketId } from './../storage';
import { StoragePath, StoragePathRef } from '../storage';
import { FirebaseStorage, StorageClientUploadBytesInput, StorageDeleteFileOptions, StorageDownloadUrl, StorageMetadata, StorageUploadInput, StorageUploadOptions, StorageUploadResult, StorageUploadTask } from '../types';
import { Maybe } from '@dereekb/util';

/**
 * Generic interface for accessing data from a file at the given path.
 */
export interface FirebaseStorageAccessorFile<R extends unknown = unknown> extends StoragePathRef {
  /**
   * Returns the underlying reference type.
   */
  readonly reference: R;
  /**
   * Returns true if the file exists.
   */
  exists(): Promise<boolean>;
  /**
   *
   */
  getDownloadUrl(): Promise<StorageDownloadUrl>;
  /**
   * Returns the metadata from the input objects.
   */
  getMetadata(): Promise<StorageMetadata>;
  /**
   * Downloads the data as an ArrayBuffer.
   */
  getBytes(maxDownloadSizeBytes?: number): Promise<ArrayBuffer>;
  /**
   * Downloads the data as a Blob.
   *
   * Available only in the browser.
   */
  getBlob?(maxDownloadSizeBytes?: number): Promise<Blob>;
  /**
   * Returns a ReadableStream of the bytes.
   *
   * Available only in NodeJS.
   */
  getStream?(maxDownloadSizeBytes?: number): NodeJS.ReadableStream;
  /**
   * Uploads data to the file's path.
   */
  upload(data: StorageUploadInput, options?: StorageUploadOptions): Promise<StorageUploadResult>;
  /**
   * Uploads data to the file's path using a resumable.
   *
   * Optional implementation.
   */
  uploadResumable?(data: StorageClientUploadBytesInput, options?: StorageUploadOptions): StorageUploadTask;
  /**
   * Returns a WritableStream that can be written to.
   *
   * Optional implementation.
   */
  uploadStream?(options?: StorageUploadOptions): NodeJS.WritableStream;
  /**
   * Deletes the file.
   *
   * Throws an error if the file does not exist.
   */
  delete(options?: StorageDeleteFileOptions): Promise<void>;
}

/**
 * Generic interface for accessing "folder" information at the given path.
 */
export interface FirebaseStorageAccessorFolder<R extends unknown = unknown> extends StoragePathRef {
  readonly reference: R;
  // todo: list files, etc.
}

export type FirebaseStorageAccessorDriverDefaultBucketFunction = (storage: FirebaseStorage) => Maybe<StorageBucketId>;
export type FirebaseStorageAccessorDriverFileFunction<R extends unknown = unknown> = (storage: FirebaseStorage, path: StoragePath) => FirebaseStorageAccessorFile<R>;
export type FirebaseStorageAccessorDriverFolderFunction<R extends unknown = unknown> = (storage: FirebaseStorage, path: StoragePath) => FirebaseStorageAccessorFolder<R>;

/**
 * A driver to use for storage functionality.
 */
export interface FirebaseStorageAccessorDriver {
  /**
   * Returns the default bucketId for the input storage.
   */
  readonly defaultBucket?: FirebaseStorageAccessorDriverDefaultBucketFunction;
  readonly file: FirebaseStorageAccessorDriverFileFunction;
  readonly folder: FirebaseStorageAccessorDriverFolderFunction;
}

/**
 * Ref to a StorageAccessorDriver.
 */
export interface FirebaseStorageAccessorDriverRef {
  readonly storageAccessorDriver: FirebaseStorageAccessorDriver;
}
