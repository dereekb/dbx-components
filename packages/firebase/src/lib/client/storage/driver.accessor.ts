import { FirebaseStorageAccessorDriver, FirebaseStorageAccessorFile, FirebaseStorageAccessorFolder, StorageListFilesOptions, StorageListFilesResult, StorageListItemResult } from '../../common/storage/driver/accessor';
import { firebaseStorageFilePathFromStorageFilePath, StoragePath } from '../../common/storage/storage';
import { FirebaseStorage, StorageClientUploadBytesInput, StorageDataString, StorageDeleteFileOptions, StorageUploadOptions } from '../../common/storage/types';
import { ListResult, list, StorageReference, getDownloadURL, FirebaseStorage as ClientFirebaseStorage, ref, getBytes, getMetadata, uploadBytes, uploadBytesResumable, UploadMetadata, uploadString, deleteObject, getBlob } from '@firebase/storage';
import { assertStorageUploadOptionsStringFormat, storageListFilesResultFactory } from '../../common';
import { ErrorInput, errorMessageContainsString, Maybe } from '@dereekb/util';

export function isFirebaseStorageObjectNotFoundError(input: Maybe<ErrorInput | string>): boolean {
  return errorMessageContainsString(input, 'storage/object-not-found');
}

export function firebaseStorageRefForStorageFilePath(storage: ClientFirebaseStorage, path: StoragePath): StorageReference {
  return ref(storage, firebaseStorageFilePathFromStorageFilePath(path));
}

export function firebaseStorageFileExists(ref: StorageReference): Promise<boolean> {
  return getMetadata(ref).then(
    (_) => true,
    (_) => false
  );
}

export type FirebaseStorageClientAccessorFile = FirebaseStorageAccessorFile<StorageReference>;

export function firebaseStorageClientAccessorFile(storage: ClientFirebaseStorage, storagePath: StoragePath): FirebaseStorageClientAccessorFile {
  const ref = firebaseStorageRefForStorageFilePath(storage, storagePath);

  function asUploadMetadata(options?: StorageUploadOptions): UploadMetadata | undefined {
    let result: UploadMetadata | undefined;

    if (options != null) {
      const { contentType, metadata } = options;

      if (options.contentType || options.metadata) {
        result = {
          ...(contentType ? { contentType } : undefined),
          ...metadata
        };
      }
    }

    return result;
  }

  return {
    reference: ref,
    storagePath,
    exists: () => firebaseStorageFileExists(ref),
    getDownloadUrl: () => getDownloadURL(ref),
    getMetadata: () => getMetadata(ref),
    upload: (input, options) => {
      const inputType = typeof input === 'string';
      const metadataOption: UploadMetadata | undefined = asUploadMetadata(options);

      if (inputType) {
        const stringFormat = assertStorageUploadOptionsStringFormat(options);
        return uploadString(ref, input as StorageDataString, stringFormat, metadataOption);
      } else {
        return uploadBytes(ref, input as StorageClientUploadBytesInput, metadataOption);
      }
    },
    getBytes: (maxDownloadSizeBytes) => getBytes(ref, maxDownloadSizeBytes),
    getBlob: (maxDownloadSizeBytes) => getBlob(ref, maxDownloadSizeBytes),
    uploadResumable: (input, options) => {
      const metadataOption: UploadMetadata | undefined = asUploadMetadata(options);
      return uploadBytesResumable(ref, input as StorageClientUploadBytesInput, metadataOption);
    },
    delete: (options: StorageDeleteFileOptions) =>
      deleteObject(ref).catch((x) => {
        if (!options.ignoreNotFound || !isFirebaseStorageObjectNotFoundError(x)) {
          throw x;
        }
      })
  };
}

export type FirebaseStorageClientAccessorFolder = FirebaseStorageAccessorFolder<StorageReference>;

export interface FirebaseStorageClientListResult {
  listResult: ListResult;
  options?: StorageListFilesOptions;
}

export const firebaseStorageClientListFilesResultFactory = storageListFilesResultFactory({
  hasItems: (result: FirebaseStorageClientListResult) => {
    return Boolean(result.listResult.items.length || result.listResult.prefixes.length);
  },
  hasNext: (result: FirebaseStorageClientListResult) => {
    return result.listResult.nextPageToken != null;
  },
  next(storage: ClientFirebaseStorage, folder: FirebaseStorageAccessorFolder, result: FirebaseStorageClientListResult): Promise<StorageListFilesResult> {
    return folder.list({
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

export function firebaseStorageClientAccessorFolder(storage: ClientFirebaseStorage, storagePath: StoragePath): FirebaseStorageClientAccessorFolder {
  const ref = firebaseStorageRefForStorageFilePath(storage, storagePath);

  const folder: FirebaseStorageClientAccessorFolder = {
    reference: ref,
    storagePath,
    exists: () => folder.list({ maxResults: 1 }).then((x) => x.hasItems()),
    list: (options?: StorageListFilesOptions) => list(ref, options).then((listResult) => firebaseStorageClientListFilesResultFactory(storage, folder, options, { options, listResult }))
  };

  return folder;
}

export function firebaseStorageClientAccessorDriver(): FirebaseStorageAccessorDriver {
  return {
    defaultBucket: (storage: FirebaseStorage) => (storage as ClientFirebaseStorage).app.options.storageBucket ?? '',
    file: (storage: FirebaseStorage, path: StoragePath) => firebaseStorageClientAccessorFile(storage as ClientFirebaseStorage, path),
    folder: (storage: FirebaseStorage, path: StoragePath) => firebaseStorageClientAccessorFolder(storage as ClientFirebaseStorage, path)
  };
}
