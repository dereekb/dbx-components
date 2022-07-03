import { StorageServerUploadInput, FirebaseStorageAccessorDriver, FirebaseStorageAccessorFile, FirebaseStorageAccessorFolder, FirebaseStorage, StoragePath } from '@dereekb/firebase';
import { Maybe } from '@dereekb/util';
import { Storage as GoogleCloudStorage, File as GoogleCloudFile, DownloadOptions } from '@google-cloud/storage';

export function googleCloudStorageFileForStorageFilePath(storage: GoogleCloudStorage, path: StoragePath) {
  return storage.bucket(path.bucketId).file(path.pathString);
}

export interface GoogleCloudStorageAccessorFile extends FirebaseStorageAccessorFile<GoogleCloudFile> {}

export function googleCloudStorageAccessorFile(storage: GoogleCloudStorage, storagePath: StoragePath): GoogleCloudStorageAccessorFile {
  const file = googleCloudStorageFileForStorageFilePath(storage, storagePath);

  function makeDownloadOptions(maxDownloadSizeBytes?: Maybe<number>): DownloadOptions {
    return {
      ...(maxDownloadSizeBytes
        ? {
            // end is inclusive
            end: maxDownloadSizeBytes - 1
          }
        : undefined)
    };
  }

  return {
    reference: file,
    storagePath,
    exists: async () => file.exists().then((x) => x[0]),
    getDownloadUrl: async () => file.getMetadata().then((x) => file.publicUrl()),
    getMetadata: () => file.getMetadata().then((x) => x[0]),
    getBytes: (maxDownloadSizeBytes) => file.download(makeDownloadOptions(maxDownloadSizeBytes)).then((x) => x[0]),
    getStream: (maxDownloadSizeBytes) => file.createReadStream(makeDownloadOptions(maxDownloadSizeBytes)),
    upload: (input, options) =>
      file.save(input as StorageServerUploadInput, {
        // non-resumable
        resumable: false,
        // add content type
        ...(options?.contentType ? { contentType: options?.contentType } : undefined)
      }),
    uploadStream: (options) => file.createWriteStream({ ...(options?.contentType ? { contentType: options?.contentType } : undefined) })
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
