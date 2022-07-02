import { FirebaseStorageAccessorDriver, FirebaseStorageAccessorFile, FirebaseStorageAccessorFolder, FirebaseStorage, StoragePath } from '@dereekb/firebase';
import { Storage as GoogleCloudStorage, File as GoogleCloudFile } from '@google-cloud/storage';

export function googleCloudStorageFileForStorageFilePath(storage: GoogleCloudStorage, path: StoragePath) {
  return storage.bucket(path.bucketId).file(path.pathString);
}

export interface GoogleCloudStorageAccessorFile extends FirebaseStorageAccessorFile<GoogleCloudFile> {}

export function googleCloudStorageAccessorFile(storage: GoogleCloudStorage, storagePath: StoragePath): GoogleCloudStorageAccessorFile {
  const file = googleCloudStorageFileForStorageFilePath(storage, storagePath);

  return {
    reference: file,
    storagePath,
    getDownloadUrl: async () => file.publicUrl()
  };
}

export interface GoogleCloudStorageAccessorFolder extends FirebaseStorageAccessorFolder<GoogleCloudFile> {}

export function googleCloudStorageAccessorFolder(storage: GoogleCloudStorage, storagePath: StoragePath): GoogleCloudStorageAccessorFolder {
  const file = googleCloudStorageFileForStorageFilePath(storage, storagePath);

  return {
    reference: file,
    storagePath
  };
}

export function googleCloudStorageFirebaseStorageAccessorDriver(): FirebaseStorageAccessorDriver {
  return {
    file: (storage: FirebaseStorage, path: StoragePath) => googleCloudStorageAccessorFile(storage as GoogleCloudStorage, path),
    folder: (storage: FirebaseStorage, path: StoragePath) => googleCloudStorageAccessorFolder(storage as GoogleCloudStorage, path)
  };
}
