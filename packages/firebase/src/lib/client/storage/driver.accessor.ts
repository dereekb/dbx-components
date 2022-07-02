import { FirebaseStorageAccessorDriver, FirebaseStorageAccessorFile, FirebaseStorageAccessorFolder } from '../../common/storage/driver/accessor';
import { StorageReference, getDownloadURL, FirebaseStorage as ClientFirebaseStorage, ref } from '@firebase/storage';
import { firebaseStorageFilePathFromStorageFilePath, StoragePath } from '../../common/storage/storage';
import { FirebaseStorage, StorageClientUploadBytesInput, StorageClientUploadInput, StorageDataString, StorageUploadOptions } from '../../common/storage/types';
import { getMetadata, uploadBytes, uploadBytesResumable, UploadMetadata, uploadString } from 'firebase/storage';

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
    getDownloadUrl: () => getDownloadURL(ref),
    getMetadata: () => getMetadata(ref),
    upload: (input, options) => {
      let metadataOption: UploadMetadata | undefined = asUploadMetadata(options);

      if (typeof input === 'string') {
        return uploadString(ref, input as StorageDataString, options?.stringFormat ?? 'base64', metadataOption);
      } else {
        return uploadBytes(ref, input as StorageClientUploadBytesInput, metadataOption);
      }
    },
    uploadResumable: (input, options) => {
      let metadataOption: UploadMetadata | undefined = asUploadMetadata(options);
      return uploadBytesResumable(ref, input as StorageClientUploadBytesInput, metadataOption);
    }
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
