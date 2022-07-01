import { GoogleCloudStorageFilePath, StorageFilePath } from '../storage';
import { FirebaseStorage, StorageDownloadUrl } from '../types';

export type FirebaseStorageAccessorDriverGetDownloadUrlFunction = (storage: FirebaseStorage, path: StorageFilePath) => Promise<StorageDownloadUrl>;

/**
 * A driver to use for storage functionality.
 */
export interface FirebaseStorageAccessorDriver {
  readonly getDownloadUrl: FirebaseStorageAccessorDriverGetDownloadUrlFunction;
}

/**
 * Ref to a StorageAccessorDriver.
 */
export interface FirebaseStorageAccessorDriverRef {
  storageAccessorDriver: FirebaseStorageAccessorDriver;
}
