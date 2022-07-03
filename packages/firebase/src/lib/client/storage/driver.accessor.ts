import { FirebaseStorageAccessorDriver, FirebaseStorageAccessorFile, FirebaseStorageAccessorFolder } from '../../common/storage/driver/accessor';
import { StorageReference, getDownloadURL, FirebaseStorage as ClientFirebaseStorage, ref } from '@firebase/storage';
import { firebaseStorageFilePathFromStorageFilePath, StoragePath } from '../../common/storage/storage';
import { FirebaseStorage, StorageClientUploadBytesInput, StorageClientUploadInput, StorageDataString, StorageDeleteFileOptions, StorageUploadOptions } from '../../common/storage/types';
import { getBytes, getMetadata, uploadBytes, uploadBytesResumable, UploadMetadata, uploadString, deleteObject, getBlob } from 'firebase/storage';
import { assertStorageUploadOptionsStringFormat } from '../../common';
import { ErrorInput, errorMessageContainsString, Maybe } from '@dereekb/util';

export function isFirebaseStorageObjectNotFoundError(input: Maybe<ErrorInput | string>): boolean {
  return errorMessageContainsString(input, 'storage/object-not-found');
}

export function firebaseStorageRefForStorageFilePath(storage: ClientFirebaseStorage, path: StoragePath): StorageReference {
  return ref(storage, firebaseStorageFilePathFromStorageFilePath(path));
}

export interface FirebaseStorageClientAccessorFile extends FirebaseStorageAccessorFile<StorageReference> {}

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
    exists: () =>
      getMetadata(ref).then(
        (_) => true,
        (_) => false
      ),
    getDownloadUrl: () => getDownloadURL(ref),
    getMetadata: () => getMetadata(ref),
    upload: (input, options) => {
      const inputType = typeof input === 'string';
      let metadataOption: UploadMetadata | undefined = asUploadMetadata(options);

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
      let metadataOption: UploadMetadata | undefined = asUploadMetadata(options);
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

export interface FirebaseStorageClientAccessorFolder extends FirebaseStorageAccessorFolder<StorageReference> {}

export function firebaseStorageClientAccessorFolder(storage: ClientFirebaseStorage, storagePath: StoragePath): FirebaseStorageClientAccessorFolder {
  const ref = firebaseStorageRefForStorageFilePath(storage, storagePath);

  return {
    reference: ref,
    storagePath
  };
}

export function firebaseStorageClientAccessorDriver(): FirebaseStorageAccessorDriver {
  return {
    defaultBucket: (storage: FirebaseStorage) => (storage as ClientFirebaseStorage).app.options.storageBucket ?? '',
    file: (storage: FirebaseStorage, path: StoragePath) => firebaseStorageClientAccessorFile(storage as ClientFirebaseStorage, path),
    folder: (storage: FirebaseStorage, path: StoragePath) => firebaseStorageClientAccessorFolder(storage as ClientFirebaseStorage, path)
  };
}
