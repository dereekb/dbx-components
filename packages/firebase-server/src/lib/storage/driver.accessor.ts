import { StorageUploadOptions, StorageServerUploadInput, FirebaseStorageAccessorDriver, FirebaseStorageAccessorFile, FirebaseStorageAccessorFolder, FirebaseStorage, StoragePath, assertStorageUploadOptionsStringFormat, StorageDeleteFileOptions } from '@dereekb/firebase';
import { Maybe, PromiseOrValue } from '@dereekb/util';
import { SaveOptions, CreateWriteStreamOptions, Storage as GoogleCloudStorage, File as GoogleCloudFile, DownloadOptions } from '@google-cloud/storage';
import { isArrayBuffer, isUint8Array } from 'util/types';

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

  function makeUploadOptions(options?: StorageUploadOptions): SaveOptions | CreateWriteStreamOptions {
    let metadata: object | undefined;

    if (options?.contentType) {
      metadata = {
        contentType: options?.contentType
      };
    }

    return {
      // non-resumable
      resumable: false,
      // add content type
      ...(metadata ? { metadata } : undefined)
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
    upload: async (input, options) => {
      let dataToUpload: PromiseOrValue<Buffer>;

      if (typeof input === 'string') {
        const parsedStringFormat = assertStorageUploadOptionsStringFormat(options);
        const stringFormat = parsedStringFormat === 'raw' ? 'utf-8' : parsedStringFormat;

        if (stringFormat === 'data_url') {
          // todo: support this later if necessary. Server should really never see this type.
          throw new Error('"data_url" is unsupported.');
        }

        dataToUpload = Buffer.from(input, stringFormat);
      } else {
        if (Buffer.isBuffer(input)) {
          dataToUpload = input;
        } else if (isUint8Array(input)) {
          dataToUpload = Buffer.from(input);
        } else {
          // NOTE: these values shouldn't ever be encountered in the NodeJS environment. May remove later.
          if (isArrayBuffer(input)) {
            dataToUpload = Buffer.from(input);
          } else {
            dataToUpload = input.arrayBuffer().then((x) => Buffer.from(x));
          }
        }
      }

      const data = await dataToUpload;
      return file.save(data, makeUploadOptions(options));
    },
    uploadStream: (options) => file.createWriteStream(makeUploadOptions(options)),
    delete: (options: StorageDeleteFileOptions) => file.delete(options).then((x) => undefined)
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
