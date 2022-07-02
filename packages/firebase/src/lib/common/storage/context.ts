import { FirebaseStorageAccessorFile, FirebaseStorageAccessorFolder } from './driver/accessor';
import { FirebaseStorageDrivers } from './driver/driver';
import { StorageBucketId, StoragePath, storagePathFactory, StoragePathFactory, StoragePathInput, StorageSlashPathRef } from './storage';
import { FirebaseStorage } from './types';

/**
 * A @dereekb/firebase FirebaseStorageContext. Wraps the main FirebaseStorage context and the drivers, as well as utility/convenience functions.
 */
export interface FirebaseStorageContext<F extends FirebaseStorage = FirebaseStorage> {
  readonly storage: F;
  readonly drivers: FirebaseStorageDrivers;
  defaultBucket: () => StorageBucketId;
  file(path: StoragePathInput): FirebaseStorageAccessorFile;
  folder(path: StoragePathInput): FirebaseStorageAccessorFolder;
}

/**
 * Factory function for generating a FirebaseStorageContext given the input FirebaseStorage.
 */
export type FirebaseStorageContextFactory<F extends FirebaseStorage = FirebaseStorage> = (firebaseStorage: F, config?: FirebaseStorageContextFactoryConfig) => FirebaseStorageContext;

export interface FirebaseStorageContextFactoryConfig {
  /**
   * The default bucket
   */
  defaultBucketId?: StorageBucketId;
  /**
   * Whether or not to force using the default bucket id.
   */
  forceBucket?: boolean;
}

/**
 * Creates a new FirebaseStorageContextFactory given the input FirebaseStorageDrivers.
 *
 * @param drivers
 * @returns
 */
export function firebaseStorageContextFactory<F extends FirebaseStorage = FirebaseStorage>(drivers: FirebaseStorageDrivers): FirebaseStorageContextFactory<F> {
  return (firebaseStorage: F, config?: FirebaseStorageContextFactoryConfig) => {
    const { defaultBucketId: inputDefaultBucketId, forceBucket = false } = config ?? {};
    const defaultBucketId: StorageBucketId = inputDefaultBucketId || drivers.storageAccessorDriver.defaultBucket?.(firebaseStorage) || '';

    if (!defaultBucketId) {
      throw new Error('Could not resolve a default bucket id for the firebaseStorageContextFactory(). Supply a defaultBucketId.');
    }

    const storagePathBuilder: StoragePathFactory = storagePathFactory({
      bucketId: defaultBucketId,
      replaceBucket: forceBucket
    });

    const context: FirebaseStorageContext<F> = {
      storage: firebaseStorage,
      drivers,
      defaultBucket: () => defaultBucketId,
      file: (path: StoragePathInput) => drivers.storageAccessorDriver.file(firebaseStorage, storagePathBuilder(path)),
      folder: (path: StoragePathInput) => drivers.storageAccessorDriver.folder(firebaseStorage, storagePathBuilder(path))
    };

    return context;
  };
}
