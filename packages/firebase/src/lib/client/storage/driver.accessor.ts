import { FirebaseStorageAccessorDriver, FirebaseStorageAccessorFile, FirebaseStorageAccessorFolder } from '../../common/storage/driver/accessor';
import { StorageReference, getDownloadURL, FirebaseStorage as ClientFirebaseStorage, ref } from '@firebase/storage';
import { firebaseStorageFilePathFromStorageFilePath, StoragePath } from '../../common/storage/storage';
import { FirebaseStorage } from '../../common/storage/types';

export function firebaseStorageRefForStorageFilePath(storage: ClientFirebaseStorage, path: StoragePath): StorageReference {
  return ref(storage, firebaseStorageFilePathFromStorageFilePath(path));
}

export interface FirebaseStorageClientAccessorFile extends FirebaseStorageAccessorFile<StorageReference> {}

export function firebaseStorageClientAccessorFile(storage: ClientFirebaseStorage, storagePath: StoragePath): FirebaseStorageClientAccessorFile {
  const ref = firebaseStorageRefForStorageFilePath(storage, storagePath);

  return {
    reference: ref,
    storagePath,
    getDownloadUrl: () => getDownloadURL(ref)
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
    file: (storage: FirebaseStorage, path: StoragePath) => firebaseStorageClientAccessorFile(storage as ClientFirebaseStorage, path),
    folder: (storage: FirebaseStorage, path: StoragePath) => firebaseStorageClientAccessorFolder(storage as ClientFirebaseStorage, path)
  };
}
