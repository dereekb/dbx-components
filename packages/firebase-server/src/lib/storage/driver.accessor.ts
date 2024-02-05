import { type StorageUploadOptions, type FirebaseStorageAccessorDriver, type FirebaseStorageAccessorFile, type FirebaseStorageAccessorFolder, type FirebaseStorage, type StoragePath, assertStorageUploadOptionsStringFormat, type StorageDeleteFileOptions, type StorageListFilesOptions, storageListFilesResultFactory, type StorageListItemResult, type StorageListFilesResult, type StorageMetadata, type StorageBucketId, type StorageCustomMetadata } from '@dereekb/firebase';
import { fixMultiSlashesInSlashPath, type Maybe, type PromiseOrValue, type SlashPathFolder, slashPathName, SLASH_PATH_SEPARATOR, toRelativeSlashPathStartType } from '@dereekb/util';
import { type SaveOptions, type CreateWriteStreamOptions, type GetFilesOptions, type Storage as GoogleCloudStorage, type File as GoogleCloudFile, type DownloadOptions, type GetFilesResponse, type FileMetadata } from '@google-cloud/storage';
import { isArrayBuffer, isUint8Array } from 'util/types';

export function googleCloudStorageBucketForStorageFilePath(storage: GoogleCloudStorage, path: StoragePath) {
  return storage.bucket(path.bucketId);
}

export function googleCloudStorageFileForStorageFilePath(storage: GoogleCloudStorage, path: StoragePath) {
  return googleCloudStorageBucketForStorageFilePath(storage, path).file(path.pathString);
}

export type GoogleCloudStorageAccessorFile = FirebaseStorageAccessorFile<GoogleCloudFile>;

export function googleCloudFileMetadataToStorageMetadata(file: GoogleCloudFile, metadata: FileMetadata): StorageMetadata {
  const fullPath = file.name;
  const generation = String(metadata.generation ?? file.generation);
  const metageneration = String(metadata.metageneration);
  const size = Number(metadata.size);

  return {
    bucket: file.bucket.name,
    fullPath,
    generation,
    metageneration,
    name: file.name,
    size,
    timeCreated: metadata.timeCreated as string,
    updated: metadata.updated as string,
    md5Hash: metadata.md5Hash,
    cacheControl: metadata.cacheControl,
    contentDisposition: metadata.contentDisposition,
    contentEncoding: metadata.contentEncoding,
    contentLanguage: metadata.contentLanguage,
    contentType: metadata.contentType,
    customMetadata: metadata.customMetadata as StorageCustomMetadata | undefined
  };
}

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
    getMetadata: () => file.getMetadata().then((x) => googleCloudFileMetadataToStorageMetadata(file, x[0])),
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

export type GoogleCloudStorageAccessorFolder = FirebaseStorageAccessorFolder<GoogleCloudFile>;

export interface GoogleCloudListResult {
  files: GoogleCloudFile[];
  nextQuery?: GetFilesOptions;
  apiResponse: GoogleCloudStorageListApiResponse;
}

export interface GoogleCloudStorageListApiResponse {
  prefixes?: SlashPathFolder[];
  items?: GoogleCloudStorageListApiResponseItem[];
}

export interface GoogleCloudStorageListApiResponseItem extends Pick<StorageMetadata, 'size' | 'generation' | 'metageneration' | 'contentDisposition' | 'contentType' | 'timeCreated' | 'updated' | 'contentEncoding' | 'md5Hash' | 'cacheControl'> {
  kind: '#storage#object';
  /**
   * For the api response, the name is actually the full path in the bucket.
   */
  name: string;
  bucket: StorageBucketId;
}

export const googleCloudStorageListFilesResultFactory = storageListFilesResultFactory({
  hasItems(result: GoogleCloudListResult): boolean {
    return Boolean(result.apiResponse.items || result.apiResponse.prefixes);
  },
  hasNext: (result: GoogleCloudListResult) => {
    return result.nextQuery != null;
  },
  next(storage: GoogleCloudStorage, folder: FirebaseStorageAccessorFolder, result: GoogleCloudListResult): Promise<StorageListFilesResult> {
    return folder.list(result.nextQuery);
  },
  file(storage: GoogleCloudStorage, fileResult: StorageListItemResult): FirebaseStorageAccessorFile {
    return googleCloudStorageAccessorFile(storage, fileResult.storagePath);
  },
  folder(storage: GoogleCloudStorage, folderResult: StorageListItemResult): FirebaseStorageAccessorFolder {
    return googleCloudStorageAccessorFolder(storage, folderResult.storagePath);
  },
  filesFromResult(result: GoogleCloudListResult): StorageListItemResult[] {
    const items = result.apiResponse?.items ?? [];
    return items.map((x) => ({ raw: x, name: slashPathName(x.name), storagePath: { bucketId: x.bucket, pathString: x.name } }));
  },
  foldersFromResult(result: GoogleCloudListResult, folder: FirebaseStorageAccessorFolder): StorageListItemResult[] {
    const items = result.apiResponse?.prefixes ?? [];
    return items.map((prefix) => ({ raw: prefix, name: slashPathName(prefix), storagePath: { bucketId: folder.storagePath.bucketId, pathString: prefix } }));
  }
});

export function googleCloudStorageAccessorFolder(storage: GoogleCloudStorage, storagePath: StoragePath): GoogleCloudStorageAccessorFolder {
  const bucket = googleCloudStorageBucketForStorageFilePath(storage, storagePath);
  const file = bucket.file(storagePath.pathString);

  const folder: GoogleCloudStorageAccessorFolder = {
    reference: file,
    storagePath,
    exists: async () => folder.list({ maxResults: 1 }).then((x) => x.hasItems()),
    list: (options?: StorageListFilesOptions) => {
      return bucket
        .getFiles({
          ...options,
          delimiter: SLASH_PATH_SEPARATOR,
          autoPaginate: false,
          versions: false,
          maxResults: options?.maxResults,
          // includeTrailingDelimiter: true,
          prefix: toRelativeSlashPathStartType(fixMultiSlashesInSlashPath(storagePath.pathString + '/')) // make sure the folder always ends with a slash
        })
        .then((x: GetFilesResponse) => {
          const files = x[0];
          const nextQuery = x[1];
          const apiResponse = x[2];

          const result: GoogleCloudListResult = {
            files: files as GoogleCloudFile[],
            nextQuery,
            apiResponse: apiResponse as object
          };

          return googleCloudStorageListFilesResultFactory(storage, folder, options, result);
        });
    }
  };

  return folder;
}

export function googleCloudStorageFirebaseStorageAccessorDriver(): FirebaseStorageAccessorDriver {
  return {
    file: (storage: FirebaseStorage, path: StoragePath) => googleCloudStorageAccessorFile(storage as GoogleCloudStorage, path),
    folder: (storage: FirebaseStorage, path: StoragePath) => googleCloudStorageAccessorFolder(storage as GoogleCloudStorage, path)
  };
}
