import { type FirebaseStorageAccessor } from './driver/accessor';
import { type FirebaseStorageDrivers } from './driver/driver';
import { type StorageBucketId, storagePathFactory, type StoragePathFactory, type StoragePathInput } from './storage';
import { type FirebaseStorage } from './types';

/**
 * Central context for Firebase Cloud Storage operations within `@dereekb/firebase`.
 *
 * Wraps the underlying {@link FirebaseStorage} instance and its {@link FirebaseStorageDrivers},
 * while exposing convenience methods for file/folder access via {@link FirebaseStorageAccessor}.
 *
 * Created by {@link firebaseStorageContextFactory}.
 */
export interface FirebaseStorageContext<F extends FirebaseStorage = FirebaseStorage> extends FirebaseStorageAccessor {
  readonly storage: F;
  readonly drivers: FirebaseStorageDrivers;
}

/**
 * Factory that creates a {@link FirebaseStorageContext} from a {@link FirebaseStorage} instance and optional configuration.
 *
 * Produced by {@link firebaseStorageContextFactory}.
 */
export type FirebaseStorageContextFactory<F extends FirebaseStorage = FirebaseStorage> = (firebaseStorage: F, config?: FirebaseStorageContextFactoryConfig) => FirebaseStorageContext;

/**
 * Configuration for {@link firebaseStorageContextFactory}.
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
 * Creates a {@link FirebaseStorageContextFactory} that produces storage contexts using the given drivers.
 *
 * The returned factory resolves a default bucket (from driver, config, or error) and builds
 * a {@link StoragePathFactory} to normalize all path inputs.
 *
 * @param drivers - the storage driver implementations to use
 * @returns a {@link FirebaseStorageContextFactory} that creates storage contexts for a given storage instance
 * @throws {Error} When a default bucket ID cannot be resolved from the driver or config.
 *
 * @example
 * ```ts
 * const factory = firebaseStorageContextFactory(myDrivers);
 * const storageContext = factory(firebaseStorage, { defaultBucketId: 'my-bucket' });
 * const file = storageContext.file('uploads/doc.pdf');
 * ```
 */
export function firebaseStorageContextFactory<F extends FirebaseStorage = FirebaseStorage>(drivers: FirebaseStorageDrivers): FirebaseStorageContextFactory<F> {
  return (firebaseStorage: F, config?: FirebaseStorageContextFactoryConfig) => {
    const { defaultBucketId: inputDefaultBucketId, forceBucket = false } = config ?? {};
    const defaultBucketId: StorageBucketId = inputDefaultBucketId ?? drivers.storageAccessorDriver.getDefaultBucket?.(firebaseStorage) ?? '';

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
