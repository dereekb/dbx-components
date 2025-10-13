import { toRelativeSlashPathStartType, type SlashPath, type FactoryWithRequiredInput } from '@dereekb/util';

/**
 * Storage bucket identifier.
 *
 * Should contain no slashes, just the bucket's identifier.
 */
export type StorageBucketId = string;

/**
 * A reference to a StorageBucketId
 */
export interface StorageBucketIdRef {
  readonly bucketId: StorageBucketId;
}

/**
 * A filepath to a file or folder.
 */
export type StorageSlashPath = SlashPath;

/**
 * A reference to a StorageSlashPath
 */
export interface StorageSlashPathRef {
  /**
   * The full path/name of a file.
   *
   * For example, if a file is at the path '<bucket>/full/path/image.png', the pathString is 'full/path/image.png'.
   */
  readonly pathString: StorageSlashPath;
}

/**
 * A bucket and path pair.
 *
 * If the bucket is not defined, it implies the default app bucket.
 */
export interface StoragePath extends StorageBucketIdRef, StorageSlashPathRef {}

/**
 * Creates a new StoragePath object with the same bucketId and pathString as the input.
 *
 * @param path The StoragePath to copy.
 * @returns A new StoragePath object.
 */
export function copyStoragePath(path: StoragePath): StoragePath {
  return {
    bucketId: path.bucketId,
    pathString: path.pathString
  };
}

/**
 * Storage-Path related input.
 */
export type StoragePathInput = StorageSlashPath | StoragePath | StorageSlashPathRef;

/**
 * Converts the input to a StoragePath
 */
export type StoragePathFactory = FactoryWithRequiredInput<StoragePath, StoragePathInput>;

export interface StoragePathFactoryConfig extends StorageBucketIdRef {
  /**
   * Whether or not to replace the bucketId on input that has it.
   *
   * False by default.
   */
  readonly replaceBucket?: boolean;
}

/**
 * Creates a StoragePathFactory.
 *
 * @param config
 * @returns
 */
export function storagePathFactory(config: StoragePathFactoryConfig): StoragePathFactory {
  const { replaceBucket = false, bucketId } = config;
  return (input: StoragePathInput) => {
    const { pathString, bucketId: inputBucketId } = typeof input === 'string' ? { pathString: input, bucketId: undefined } : (input as StoragePath);

    if (replaceBucket) {
      return {
        pathString,
        bucketId
      };
    } else {
      return {
        pathString,
        bucketId: inputBucketId || bucketId
      };
    }
  };
}

/**
 * A reference to a StoragePath
 */
export interface StoragePathRef {
  readonly storagePath: StoragePath;
}

// MARK: Utilities
export type GoogleCloudStorageBucketPrefix<S extends StorageBucketId = StorageBucketId> = `gs://${S}`;
export type GoogleCloudStorageDefaultBucketFilePath<P extends StorageSlashPath = StorageSlashPath> = P;
export type GoogleCloudStorageBucketAndFilePath<P extends StorageSlashPath = StorageSlashPath, S extends StorageBucketId = StorageBucketId> = `${GoogleCloudStorageBucketPrefix<S>}/${P}`;
export type GoogleCloudStorageFilePath<P extends StorageSlashPath = StorageSlashPath> = GoogleCloudStorageDefaultBucketFilePath<P> | GoogleCloudStorageBucketAndFilePath<P>;

export function firebaseStorageFilePathFromStorageFilePath(path: StoragePath): GoogleCloudStorageFilePath {
  const { bucketId, pathString } = path;
  const relativePathString = toRelativeSlashPathStartType(pathString);
  let storagePath: GoogleCloudStorageFilePath;

  if (bucketId) {
    const prefix = firebaseStorageBucketFolderPath(bucketId);
    storagePath = `${prefix}/${relativePathString}`;
  } else {
    storagePath = relativePathString;
  }

  return storagePath;
}

export function firebaseStorageBucketFolderPath(storage: StorageBucketId | StorageBucketIdRef): GoogleCloudStorageBucketPrefix {
  let storageId: string;

  if (typeof storage === 'string') {
    storageId = storage;
  } else {
    storageId = storage.bucketId;
  }

  return `gs://${storageId}`;
}
