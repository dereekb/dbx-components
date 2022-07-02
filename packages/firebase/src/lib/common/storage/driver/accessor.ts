import { StorageBucketId } from './../storage';
import { StoragePath, StoragePathRef } from '../storage';
import { FirebaseStorage, StorageDownloadUrl } from '../types';
import { Maybe } from '@dereekb/util';

/**
 * Generic interface for accessing data from a file at the given path.
 */
export interface FirebaseStorageAccessorFile<R extends unknown = unknown> extends StoragePathRef {
  /**
   * Returns the underlying reference type.
   */
  readonly reference: R;
  getDownloadUrl(): Promise<StorageDownloadUrl>;
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
