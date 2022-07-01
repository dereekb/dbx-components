import { FirebaseStorageAccessorDriver, FirebaseStorageAccessorDriverGetDownloadUrlFunction } from '../../common/storage/driver/accessor';
import { getDownloadURL, FirebaseStorage as ClientFirebaseStorage, ref } from '@firebase/storage';
import { firebaseStorageFilePathFromStorageFilePath, GoogleCloudStorageFilePath, StorageBucketId, StorageBucketIdRef, StorageFilePath } from '../../common/storage/storage';
import { SlashPathFolder } from '@dereekb/util';
import { FirebaseStorage } from '../../common/storage/types';

export function firebaseStorageRefForStorageFilePath(storage: ClientFirebaseStorage, path: StorageFilePath) {
  return ref(storage, firebaseStorageFilePathFromStorageFilePath(path));
}

export function firebaseStorageClientAccessorDriver(): FirebaseStorageAccessorDriver {
  return {
    getDownloadUrl: (storage: FirebaseStorage, path: StorageFilePath) => getDownloadURL(firebaseStorageRefForStorageFilePath(storage as ClientFirebaseStorage, path))
  };
}
