import { toRelativeSlashPathStartType, type SlashPath, type FactoryWithRequiredInput } from '@dereekb/util';

/**
 * Storage bucket identifier for Firebase Cloud Storage.
 *
 * Should contain no slashes — just the bucket name (e.g., `"my-app.appspot.com"`).
 */
export type StorageBucketId = string;

/**
 * Contains a reference to a {@link StorageBucketId}.
 */
export interface StorageBucketIdRef {
  readonly bucketId: StorageBucketId;
}

/**
 * Slash-delimited file or folder path within a storage bucket.
 *
 * Does not include the bucket identifier — only the path relative to the bucket root.
 */
export type StorageSlashPath = SlashPath;

/**
 * Contains a reference to a {@link StorageSlashPath}.
 */
export interface StorageSlashPathRef {
  /**
   * The full path/name of a file relative to the bucket root.
   *
   * For example, if a file is at the path `<bucket>/full/path/image.png`, the pathString is `full/path/image.png`.
   */
  readonly pathString: StorageSlashPath;
}

/**
 * A bucket and path pair that uniquely identifies a file or folder in Firebase Cloud Storage.
 *
 * If the bucket is not defined, it implies the default app bucket.
 */
export interface StoragePath extends StorageBucketIdRef, StorageSlashPathRef {}

/**
 * Creates a shallow copy of a {@link StoragePath}, preserving bucketId and pathString.
 *
 * Useful when you need an independent reference that won't be affected by mutations to the original.
 *
 * @param path - the storage path to copy
 *
 * @example
 * ```ts
 * const copy = copyStoragePath({ bucketId: 'my-bucket', pathString: 'images/photo.png' });
 * ```
 */
export function copyStoragePath(path: StoragePath): StoragePath {
  return {
    bucketId: path.bucketId,
    pathString: path.pathString
  };
}

/**
 * Flexible input that can be used to resolve a {@link StoragePath}.
 *
 * Accepts a raw slash path string, a {@link StoragePath}, or a {@link StorageSlashPathRef}.
 */
export type StoragePathInput = StorageSlashPath | StoragePath | StorageSlashPathRef;

/**
 * Factory that normalizes a {@link StoragePathInput} into a fully-resolved {@link StoragePath} with a bucket.
 */
export type StoragePathFactory = FactoryWithRequiredInput<StoragePath, StoragePathInput>;

/**
 * Configuration for {@link storagePathFactory}.
 */
export interface StoragePathFactoryConfig extends StorageBucketIdRef {
  /**
   * Whether to always override the bucketId on inputs that already have one.
   *
   * When `false` (default), input bucketIds are preserved and the configured bucket is used only as a fallback.
   */
  readonly replaceBucket?: boolean;
}

/**
 * Creates a {@link StoragePathFactory} that normalizes various path inputs into {@link StoragePath} objects
 * with a consistent bucket assignment.
 *
 * @param config - bucket and replacement behavior
 *
 * @example
 * ```ts
 * const pathFactory = storagePathFactory({ bucketId: 'my-bucket' });
 * const path = pathFactory('images/photo.png');
 * // path === { bucketId: 'my-bucket', pathString: 'images/photo.png' }
 * ```
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
 * Contains a reference to a {@link StoragePath}.
 */
export interface StoragePathRef {
  readonly storagePath: StoragePath;
}

// MARK: Utilities
/**
 * Google Cloud Storage bucket prefix in `gs://` URI format.
 */
export type GoogleCloudStorageBucketPrefix<S extends StorageBucketId = StorageBucketId> = `gs://${S}`;

/**
 * A file path in the default bucket — equivalent to the raw path string.
 */
export type GoogleCloudStorageDefaultBucketFilePath<P extends StorageSlashPath = StorageSlashPath> = P;

/**
 * A fully-qualified `gs://bucket/path` URI for a file in a specific bucket.
 */
export type GoogleCloudStorageBucketAndFilePath<P extends StorageSlashPath = StorageSlashPath, S extends StorageBucketId = StorageBucketId> = `${GoogleCloudStorageBucketPrefix<S>}/${P}`;

/**
 * A Google Cloud Storage file path — either a raw path (default bucket) or a full `gs://` URI.
 */
export type GoogleCloudStorageFilePath<P extends StorageSlashPath = StorageSlashPath> = GoogleCloudStorageDefaultBucketFilePath<P> | GoogleCloudStorageBucketAndFilePath<P>;

/**
 * Converts a {@link StoragePath} to a {@link GoogleCloudStorageFilePath} string.
 *
 * If the path has a bucketId, produces a `gs://bucket/path` URI. Otherwise, returns just the relative path
 * (implying the default bucket).
 *
 * @param path - the storage path to convert
 *
 * @example
 * ```ts
 * const uri = firebaseStorageFilePathFromStorageFilePath({ bucketId: 'my-bucket', pathString: 'images/photo.png' });
 * // uri === 'gs://my-bucket/images/photo.png'
 * ```
 */
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

/**
 * Returns the `gs://` bucket prefix URI for the given bucket identifier or ref.
 *
 * @param storage - bucket ID string or a {@link StorageBucketIdRef}
 *
 * @example
 * ```ts
 * firebaseStorageBucketFolderPath('my-bucket');
 * // returns 'gs://my-bucket'
 * ```
 */
export function firebaseStorageBucketFolderPath(storage: StorageBucketId | StorageBucketIdRef): GoogleCloudStorageBucketPrefix {
  let storageId: string;

  if (typeof storage === 'string') {
    storageId = storage;
  } else {
    storageId = storage.bucketId;
  }

  return `gs://${storageId}`;
}
