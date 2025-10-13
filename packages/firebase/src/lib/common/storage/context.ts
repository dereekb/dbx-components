import { type FirebaseStorageAccessor } from './driver/accessor';
import { type FirebaseStorageDrivers } from './driver/driver';
import { type StorageBucketId, storagePathFactory, type StoragePathFactory, type StoragePathInput } from './storage';
import { type FirebaseStorage } from './types';

/**
 * A @dereekb/firebase FirebaseStorageContext. Wraps the main FirebaseStorage context and the drivers, as well as utility/convenience functions.
 */
export interface FirebaseStorageContext<F extends FirebaseStorage = FirebaseStorage> extends FirebaseStorageAccessor {
  readonly storage: F;
  readonly drivers: FirebaseStorageDrivers;
}

/**
 * Factory function for generating a FirebaseStorageContext given the input FirebaseStorage.
 */
export type FirebaseStorageContextFactory<F extends FirebaseStorage = FirebaseStorage> = (firebaseStorage: F, config?: FirebaseStorageContextFactoryConfig) => FirebaseStorageContext;

/**
 * firebaseStorageContextFactory() configuration
 */
export interface FirebaseStorageContextFactoryConfig {
  /**
   * The default bucket
   */
  readonly defaultBucketId?: StorageBucketId;
  /**
   * Whether or not to force using the default bucket id.
   */
  readonly forceBucket?: boolean;
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
    const defaultBucketId: StorageBucketId = inputDefaultBucketId || drivers.storageAccessorDriver.getDefaultBucket?.(firebaseStorage) || '';

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
