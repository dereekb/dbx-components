import { type StorageBucketId, type StoragePathInput, type StoragePath, type StoragePathRef } from '../storage';
import { type FirebaseStorage, type StorageClientUploadBytesInput, type StorageDeleteFileOptions, type StorageDownloadUrl, type StorageMetadata, type StorageUploadInput, type StorageUploadOptions, type StorageUploadResult, type StorageUploadTask } from '../types';
import { type Maybe } from '@dereekb/util';

/**
 * Used for accessing files and folders in the storage.
 */
export interface FirebaseStorageAccessor {
  defaultBucket: () => StorageBucketId;
  file(path: StoragePathInput): FirebaseStorageAccessorFile;
  folder(path: StoragePathInput): FirebaseStorageAccessorFolder;
}

/**
 * Generic interface for accessing data from a file at the given path.
 */
export interface FirebaseStorageAccessorFile<R = unknown> extends StoragePathRef {
  /**
   * Returns the underlying reference type.
   */
  readonly reference: R;
  /**
   * Returns true if the file exists.
   */
  exists(): Promise<boolean>;
  /**
   * Returns the download URL for the file.
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

export interface StorageListFilesOptions {
  /**
   * If set, limits the total number of `prefixes` and `items` to return.
   * The default and maximum maxResults is 1000.
   */
  readonly maxResults?: number;
  /**
   * The `nextPageToken` from a previous call to `list()`. If provided,
   * listing is resumed from the previous position.
   */
  readonly pageToken?: string;
}

export interface StorageListItemResult extends StoragePathRef {
  /**
   * Raw result
   */
  readonly raw?: unknown;
  /**
   * Name of the item
   */
  readonly name: string;
}

export interface StorageListFolderResult extends StorageListItemResult {
  /**
   * Gets this item as a FirebaseStorageAccessorFolder
   */
  folder(): FirebaseStorageAccessorFolder;
}

export interface StorageListFileResult extends StorageListItemResult {
  /**
   * Gets this item as a FirebaseStorageAccessorFile
   */
  file(): FirebaseStorageAccessorFile;
}

export interface StorageListFilesResult<R = unknown> {
  /**
   * The raw result.
   */
  readonly raw: R;
  /**
   * Options used to retrieve the result.
   */
  readonly options: StorageListFilesOptions | undefined;
  /**
   * Whether or not there are more results available.
   */
  readonly hasNext: boolean;
  /**
   * Returns true if any files or folders exist in the results.
   */
  hasItems(): boolean;
  /**
   * Returns all the prefixes/folders in the result.
   */
  folders(): StorageListFolderResult[];
  /**
   * Returns all the files in the result.
   */
  files(): StorageListFileResult[];
  /**
   * Returns the next set of results, if available.
   */
  next(): Promise<StorageListFilesResult>;
}

/**
 * Generic interface for accessing "folder" information at the given path.
 */
export interface FirebaseStorageAccessorFolder<R = unknown> extends StoragePathRef {
  readonly reference: R;
  /**
   * Returns true if the folder exists.
   */
  exists(): Promise<boolean>;
  /**
   * Performs a search for items
   * @param options
   */
  list(options?: StorageListFilesOptions): Promise<StorageListFilesResult>;
}

export type FirebaseStorageAccessorDriverDefaultBucketFunction = (storage: FirebaseStorage) => Maybe<StorageBucketId>;
export type FirebaseStorageAccessorDriverFileFunction<R = unknown> = (storage: FirebaseStorage, path: StoragePath) => FirebaseStorageAccessorFile<R>;
export type FirebaseStorageAccessorDriverFolderFunction<R = unknown> = (storage: FirebaseStorage, path: StoragePath) => FirebaseStorageAccessorFolder<R>;

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
