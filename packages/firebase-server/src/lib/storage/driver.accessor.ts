import { FirebaseStorage, FirebaseStorageAccessorDriver, FirebaseStorageAccessorDriverGetDownloadUrlFunction, GoogleCloudStorageFilePath, StorageFilePath } from '@dereekb/firebase';
import { SlashPathFolder } from '@dereekb/util';
import { Storage as GoogleCloudStorage } from '@google-cloud/storage';

export function googleCloudStorageFileForStorageFilePath(storage: GoogleCloudStorage, path: StorageFilePath) {
  return storage.bucket(path.bucketId).file(path.pathString);
}

export function googleCloudStorageFirebaseStorageAccessorDriver(): FirebaseStorageAccessorDriver {
  return {
    getDownloadUrl: async (storage: FirebaseStorage, path: StorageFilePath) => googleCloudStorageFileForStorageFilePath(storage as GoogleCloudStorage, path).publicUrl()
  };
}
