import { type StorageBucketId, type StoragePathInput, type StoragePath, type StoragePathRef, type StorageSlashPath } from '../storage';
import { type ConfigurableStorageMetadata, type StorageAccessControlObject, type StorageAclMetadata, type StorageMakePrivateOptions, type StorageMoveOptions, type StorageSignedDownloadUrl, type StorageSignedDownloadUrlConfig, type FirebaseStorage, type StorageClientUploadBytesInput, type StorageDeleteFileOptions, type StorageDownloadUrl, type StorageMetadata, type StorageUploadInput, type StorageUploadOptions, type StorageUploadResult, type StorageUploadTask } from '../types';
import { type ArrayOrValue, type Maybe } from '@dereekb/util';
import { type Readable } from 'stream';

/**
 * Used for accessing files and folders in the storage.
 */
export interface FirebaseStorageAccessor {
  defaultBucket: () => StorageBucketId;
  file(path: StoragePathInput): FirebaseStorageAccessorFile;
  folder(path: StoragePathInput): FirebaseStorageAccessorFolder;
}

/**
 * Contains a reference to a FirebaseStorageAccessor.
 */
export interface FirebaseStorageAccessorRef {
  readonly storageAccessor: FirebaseStorageAccessor;
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
   *
   * If the file does not exist, an error will be thrown.
   *
   * This is consistent between the client and server implementations.
   */
  getDownloadUrl(): Promise<StorageDownloadUrl>;
  /**
   * Returns a signed/temporary url
   */
  getSignedUrl?(options?: StorageSignedDownloadUrlConfig): Promise<StorageSignedDownloadUrl>;
  /**
   * Returns the metadata from the input objects.
   */
  getMetadata(): Promise<StorageMetadata>;
  /**
   * Sets the metadata for the file.
   *
   * @param metadata
   */
  setMetadata(metadata: ConfigurableStorageMetadata): Promise<StorageMetadata>;
  /**
   * Downloads the data as an ArrayBuffer.
   */
  getBytes(maxDownloadSizeBytes?: number): Promise<Uint8Array<ArrayBufferLike>>;
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
  getStream?(maxDownloadSizeBytes?: number): Readable;
  /**
   * Uploads data to the file's path.
   */
  upload(data: StorageUploadInput, options?: StorageUploadOptions): Promise<StorageUploadResult>;
  /**
   * Uploads data to the file's path using a resumable.
   *
   * Generally a client-only implementation.
   *
   * Optional implementation.
   */
  uploadResumable?(data: StorageClientUploadBytesInput, options?: StorageUploadOptions): StorageUploadTask;
  /**
   * Returns a WritableStream that can be written to.
   *
   * Generally a server-only implementation.
   *
   * Optional implementation.
   */
  uploadStream?(options?: StorageUploadOptions): NodeJS.WritableStream;
  /**
   * Moves the file to a new location.
   *
   * Optional implementation.
   */
  move?(newPath: StorageSlashPath | StoragePath, options?: StorageMoveOptions): Promise<FirebaseStorageAccessorFile<R>>;
  /**
   * Copies the file to a new location.
   *
   * Optional implementation.
   */
  copy?(newPath: StorageSlashPath | StoragePath, options?: StorageMoveOptions): Promise<FirebaseStorageAccessorFile<R>>;
  /**
   * Deletes the file.
   *
   * Throws an error if the file does not exist.
   */
  delete(options?: StorageDeleteFileOptions): Promise<void>;
  /**
   * Returns true if the file is public.
   *
   * Generally a server-only implementation.
   */
  isPublic?(): Promise<boolean>;
  /**
   * Makes the file public.
   *
   * Generally a server-only implementation.
   */
  makePublic?(setPublic?: boolean): Promise<void>;
  /**
   * Makes the file private.
   *
   * Generally a server-only implementation.
   */
  makePrivate?(options?: StorageMakePrivateOptions): Promise<void>;
  /**
   * Returns the ACLs for the file.
   *
   * Generally a server-only implementation.
   */
  getAcls?(options?: StorageGetAclsOptions): Promise<StorageGetAclsResult>;
}

export interface StorageGetAclsOptions {
  readonly entity: string;
  readonly generation?: number;
  readonly userProject?: string;
}

export interface StorageGetAclsResult {
  readonly acls: ArrayOrValue<StorageAccessControlObject>;
  readonly metadata: StorageAclMetadata;
}

/**
 * String used as a cursor for iterating pages of file results.
 */
export type StorageListFilesPageToken = string;

export interface StorageListFilesOptions {
  /**
   * If true, returns all files, both within this folder and all nested folders, under this folder.
   *
   * Defaults to false.
   *
   * NOTE: Behavior may differ between clients and servers.
   *
   * The client may behave less efficiently. Use caution when using this option on the client-side on root-level folders.
   */
  readonly includeNestedResults?: boolean;
  /**
   * If set, limits the total number of `prefixes` and `items` to return.
   * The default and maximum maxResults is 1000.
   */
  readonly maxResults?: number;
  /**
   * The `nextPageToken` from a previous call to `list()`. If provided,
   * listing is resumed from the previous position.
   */
  readonly pageToken?: StorageListFilesPageToken;
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

export type StorageListFileResultNextPageToken = string;

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
  /**
   * Returns the StorageListFilesPageToken for the next page, if available.
   */
  nextPageToken(): Maybe<StorageListFilesPageToken>;
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
   * Lists all items in the immediate folder.
   *
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
   * Whether or not this driver is for a client or server.
   */
  readonly type: 'client' | 'server';
  /**
   * Returns the default bucketId for the input storage.
   */
  readonly getDefaultBucket?: FirebaseStorageAccessorDriverDefaultBucketFunction;
  readonly file: FirebaseStorageAccessorDriverFileFunction;
  readonly folder: FirebaseStorageAccessorDriverFolderFunction;
}

/**
 * Ref to a StorageAccessorDriver.
 */
export interface FirebaseStorageAccessorDriverRef {
  readonly storageAccessorDriver: FirebaseStorageAccessorDriver;
}
