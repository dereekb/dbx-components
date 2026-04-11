import { type StorageListFilesPageToken, type FirebaseStorageAccessorDriver, type FirebaseStorageAccessorFile, type FirebaseStorageAccessorFolder, type StorageListFilesOptions, type StorageListFilesResult, type StorageListItemResult } from '../../common/storage/driver/accessor';
import { firebaseStorageFilePathFromStorageFilePath, type StoragePath } from '../../common/storage/storage';
import { type ConfigurableStorageMetadata, type StorageCustomMetadata, type StorageUploadTask, type StorageUploadTaskSnapshot, type FirebaseStorage, type StorageClientUploadBytesInput, type StorageDataString, type StorageDeleteFileOptions, type StorageUploadOptions } from '../../common/storage/types';
import { type ListResult, list, type StorageReference, getDownloadURL, type FirebaseStorage as ClientFirebaseStorage, ref, getBytes, getMetadata, updateMetadata, uploadBytes, uploadBytesResumable, type UploadMetadata, uploadString, deleteObject, getBlob, type SettableMetadata, type UploadTask, type UploadTaskSnapshot } from 'firebase/storage';
import { assertStorageUploadOptionsStringFormat, storageListFilesResultFactory, type StorageListFilesResultFactoryInput } from '../../common';
import { cachedGetter, type ErrorInput, errorMessageContainsString, filterUndefinedValues, type Maybe } from '@dereekb/util';
import { map, Observable, shareReplay } from 'rxjs';

/**
 * Checks whether an error is a Firebase Storage "object not found" error.
 *
 * Useful for distinguishing missing-file errors from other storage failures,
 * e.g., to silently handle deletion of already-deleted files.
 *
 * @param input - the error or error message to check
 * @returns `true` if the error message contains `'storage/object-not-found'`, `false` otherwise
 *
 * @example
 * ```ts
 * try {
 *   await deleteObject(ref);
 * } catch (e) {
 *   if (isFirebaseStorageObjectNotFoundError(e)) {
 *     // file already deleted, safe to ignore
 *   }
 * }
 * ```
 */
export function isFirebaseStorageObjectNotFoundError(input: Maybe<ErrorInput | string>): boolean {
  return errorMessageContainsString(input, 'storage/object-not-found');
}

/**
 * Creates a `StorageReference` from an abstract {@link StoragePath} using the client `firebase/storage` SDK.
 *
 * @param storage - the client Firebase Storage instance
 * @param path - abstract storage path to resolve
 * @returns a `StorageReference` pointing to the resolved storage path
 */
export function firebaseStorageRefForStorageFilePath(storage: ClientFirebaseStorage, path: StoragePath): StorageReference {
  return ref(storage, firebaseStorageFilePathFromStorageFilePath(path));
}

/**
 * Checks whether a file exists at the given `StorageReference` by attempting to read its metadata.
 *
 * Returns `true` if metadata is successfully retrieved, `false` for any error (including permission errors).
 *
 * @param ref - the storage reference to check
 * @returns a promise that resolves to `true` if the file exists, `false` otherwise
 */
export function firebaseStorageFileExists(ref: StorageReference): Promise<boolean> {
  return getMetadata(ref).then(
    (_) => true,
    (_) => false
  );
}

/**
 * Client-side specialization of {@link FirebaseStorageAccessorFile} using `StorageReference` as the native reference type.
 */
export type FirebaseStorageClientAccessorFile = FirebaseStorageAccessorFile<StorageReference>;

/**
 * Creates a client-side {@link FirebaseStorageAccessorFile} for a specific storage path.
 *
 * Provides all file operations (upload, download, metadata, delete, resumable upload) backed by
 * the `firebase/storage` SDK. Resumable uploads expose an Observable stream of upload progress snapshots.
 *
 * @param storage - the client Firebase Storage instance
 * @param storagePath - the abstract storage path for the file
 * @returns a {@link FirebaseStorageClientAccessorFile} providing CRUD and upload operations for the given path
 *
 * @example
 * ```ts
 * const file = firebaseStorageClientAccessorFile(storage, { bucketId: 'my-bucket', pathString: 'uploads/photo.jpg' });
 * const url = await file.getDownloadUrl();
 * ```
 */
export function firebaseStorageClientAccessorFile(storage: ClientFirebaseStorage, storagePath: StoragePath): FirebaseStorageClientAccessorFile {
  const ref = firebaseStorageRefForStorageFilePath(storage, storagePath);

  interface ConfigureMetadataOptions {
    readonly metadata?: ConfigurableStorageMetadata;
    readonly customMetadata?: StorageCustomMetadata;
  }

  function _configureMetadata(options: ConfigureMetadataOptions): UploadMetadata {
    return filterUndefinedValues({
      cacheControl: options.metadata?.cacheControl,
      contentDisposition: options.metadata?.contentDisposition,
      contentEncoding: options.metadata?.contentEncoding,
      contentLanguage: options.metadata?.contentLanguage,
      contentType: options.metadata?.contentType,
      customMetadata: filterUndefinedValues({
        ...options.metadata?.customMetadata,
        ...options.customMetadata
      }) as { [key: string]: string }
    });
  }

  function uploadMetadataFromStorageUploadOptions(options?: StorageUploadOptions): UploadMetadata | undefined {
    let result: UploadMetadata | undefined;

    if (options != null) {
      result = _configureMetadata({
        metadata: {
          ...options.metadata,
          contentType: options.contentType ?? options.metadata?.contentType
        },
        customMetadata: options.customMetadata
      });
    }

    return result;
  }

  function asSettableMetadata(metadata: ConfigurableStorageMetadata): SettableMetadata {
    return _configureMetadata({ metadata });
  }

  const clientFile: FirebaseStorageClientAccessorFile = {
    reference: ref,
    storagePath,
    exists: () => firebaseStorageFileExists(ref),
    getDownloadUrl: () => getDownloadURL(ref),
    getMetadata: () => getMetadata(ref),
    setMetadata: (metadata) => updateMetadata(ref, asSettableMetadata(metadata)),
    upload: (input, options) => {
      const inputType = typeof input === 'string';
      const metadataOption: UploadMetadata | undefined = uploadMetadataFromStorageUploadOptions(options);

      return inputType ? uploadString(ref, input as StorageDataString, assertStorageUploadOptionsStringFormat(options), metadataOption) : uploadBytes(ref, input as StorageClientUploadBytesInput, metadataOption);
    },
    getBytes: (maxDownloadSizeBytes) => getBytes(ref, maxDownloadSizeBytes).then((x) => new Uint8Array(x)),
    getBlob: (maxDownloadSizeBytes) => getBlob(ref, maxDownloadSizeBytes),
    uploadResumable: (input, options) => {
      const metadataOption: UploadMetadata | undefined = uploadMetadataFromStorageUploadOptions(options);
      const uploadBytesTask = uploadBytesResumable(ref, input as StorageClientUploadBytesInput, metadataOption);

      function wrapSnapshot(currentSnapshot: UploadTaskSnapshot): StorageUploadTaskSnapshot<UploadTask> {
        const snapshot: StorageUploadTaskSnapshot<UploadTask> = {
          bytesTransferred: currentSnapshot.bytesTransferred,
          totalBytes: currentSnapshot.totalBytes,
          metadata: currentSnapshot.metadata,
          state: currentSnapshot.state,
          uploadTask
        };

        return snapshot;
      }

      const uploadTask: StorageUploadTask<UploadTask> = {
        taskRef: uploadBytesTask,
        cancel: () => uploadBytesTask.cancel(),
        pause: () => uploadBytesTask.pause(),
        resume: () => uploadBytesTask.resume(),
        getSnapshot: () => wrapSnapshot(uploadBytesTask.snapshot),
        streamSnapshotEvents: cachedGetter(() => {
          const internalSnapshotObs = new Observable<UploadTaskSnapshot>((x) =>
            uploadBytesTask.on('state_changed', {
              next: (y) => x.next(y),
              error: (e) => x.error(e),
              complete: () => x.complete()
            })
          );

          const snapshotEvents: Observable<StorageUploadTaskSnapshot> = internalSnapshotObs.pipe(
            map((x) => wrapSnapshot(x)),
            shareReplay(1)
          );

          return snapshotEvents;
        })
      };

      return uploadTask;
    },
    delete: (options: StorageDeleteFileOptions) =>
      deleteObject(ref).catch((x) => {
        if (!options.ignoreNotFound || !isFirebaseStorageObjectNotFoundError(x)) {
          throw x;
        }
      })
  };

  return clientFile;
}

/**
 * Client-side specialization of {@link FirebaseStorageAccessorFolder} using `StorageReference` as the native reference type.
 */
export type FirebaseStorageClientAccessorFolder = FirebaseStorageAccessorFolder<StorageReference>;

/**
 * Internal result wrapper for client-side storage list operations, holding the raw `ListResult`
 * and the options used to produce it. Used by {@link firebaseStorageClientListFilesResultFactory}
 * to support pagination and nested listing.
 */
export interface FirebaseStorageClientListResult {
  listResult: ListResult;
  options?: StorageListFilesOptions;
}

/**
 * Pre-configured {@link storageListFilesResultFactory} for the client `firebase/storage` SDK.
 *
 * Handles pagination tokens, nested folder traversal, and mapping between Firebase `ListResult`
 * items and the abstract {@link StorageListItemResult} interface.
 */
export const firebaseStorageClientListFilesResultFactory = storageListFilesResultFactory({
  hasItems: (result: FirebaseStorageClientListResult) => {
    return Boolean(result.listResult.items.length || result.listResult.prefixes.length);
  },
  hasNext: (result: FirebaseStorageClientListResult) => {
    return result.listResult.nextPageToken != null;
  },
  nextPageTokenFromResult(result: FirebaseStorageClientListResult): Maybe<StorageListFilesPageToken> {
    return result.listResult.nextPageToken;
  },
  next({ options, folder }: StorageListFilesResultFactoryInput<ClientFirebaseStorage>, result: FirebaseStorageClientListResult): Promise<StorageListFilesResult> {
    return folder.list({
      ...options,
      ...result.options,
      pageToken: result.listResult.nextPageToken
    });
  },
  file(storage: ClientFirebaseStorage, fileResult: StorageListItemResult): FirebaseStorageAccessorFile {
    return firebaseStorageClientAccessorFile(storage, fileResult.storagePath);
  },
  folder(storage: ClientFirebaseStorage, folderResult: StorageListItemResult): FirebaseStorageAccessorFolder {
    return firebaseStorageClientAccessorFolder(storage, folderResult.storagePath);
  },
  filesFromResult(result: FirebaseStorageClientListResult): StorageListItemResult[] {
    return result.listResult.items.map((y) => ({ name: y.name, storagePath: { bucketId: y.bucket, pathString: y.fullPath } }));
  },
  foldersFromResult(result: FirebaseStorageClientListResult): StorageListItemResult[] {
    return result.listResult.prefixes.map((y) => ({ name: y.name, storagePath: { bucketId: y.bucket, pathString: y.fullPath } }));
  }
});

/**
 * Creates a client-side {@link FirebaseStorageAccessorFolder} for a specific storage path.
 *
 * Supports existence checks, paginated file/folder listing, and recursive nested listing
 * when `includeNestedResults` is enabled.
 *
 * @param storage - the client Firebase Storage instance
 * @param storagePath - the abstract storage path for the folder
 * @returns a {@link FirebaseStorageClientAccessorFolder} providing listing and existence operations for the given path
 *
 * @example
 * ```ts
 * const folder = firebaseStorageClientAccessorFolder(storage, { bucketId: 'my-bucket', pathString: 'uploads/' });
 * const result = await folder.list({ maxResults: 10 });
 * const files = result.files();
 * ```
 */
export function firebaseStorageClientAccessorFolder(storage: ClientFirebaseStorage, storagePath: StoragePath): FirebaseStorageClientAccessorFolder {
  const ref = firebaseStorageRefForStorageFilePath(storage, storagePath);

  const folder: FirebaseStorageClientAccessorFolder = {
    reference: ref,
    storagePath,
    exists: () => folder.list({ maxResults: 1 }).then((x) => x.hasItems()),
    list: async (options?: StorageListFilesOptions) => {
      const rootResults = await list(ref, options).then((listResult) => firebaseStorageClientListFilesResultFactory({ storage, folder, options }, { options, listResult }));
      let result: StorageListFilesResult;

      if (options?.includeNestedResults) {
        const allImmediateFiles = rootResults.files();
        const allImmediateFolders = rootResults.folders();
        const allNestedFolderFileResults = await Promise.all(
          allImmediateFolders.map((x) =>
            x
              .folder()
              .list({ includeNestedResults: true })
              .then((x) => x.files())
          )
        );
        const allNestedFiles = allNestedFolderFileResults.flat();
        const allFiles = [...allImmediateFiles, ...allNestedFiles];

        result = {
          ...rootResults,
          files: () => allFiles,
          folders: () => [] // no folders
        };
      } else {
        result = rootResults;
      }

      return result;
    }
  };

  return folder;
}

/**
 * Creates the client-side {@link FirebaseStorageAccessorDriver} that maps the abstract storage
 * accessor interface to the `firebase/storage` SDK.
 *
 * Provides file and folder accessor factories and default bucket resolution.
 * Used internally by {@link firebaseStorageClientDrivers}.
 *
 * @returns a {@link FirebaseStorageAccessorDriver} backed by the `firebase/storage` client SDK
 *
 * @example
 * ```ts
 * const driver = firebaseStorageClientAccessorDriver();
 * const file = driver.file(storage, storagePath);
 * ```
 */
export function firebaseStorageClientAccessorDriver(): FirebaseStorageAccessorDriver {
  return {
    type: 'client',
    getDefaultBucket: (storage: FirebaseStorage) => (storage as ClientFirebaseStorage).app.options.storageBucket ?? '',
    file: (storage: FirebaseStorage, path: StoragePath) => firebaseStorageClientAccessorFile(storage as ClientFirebaseStorage, path),
    folder: (storage: FirebaseStorage, path: StoragePath) => firebaseStorageClientAccessorFolder(storage as ClientFirebaseStorage, path)
  };
}
