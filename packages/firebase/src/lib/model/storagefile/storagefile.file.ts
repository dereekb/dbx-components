import { cachedGetter, type ContentTypeMimeType, type Factory, type FactoryWithRequiredInput, fileExtensionForMimeType, type Maybe, SLASH_PATH_FILE_TYPE_SEPARATOR, slashPathDetails, type SlashPathDetails, type SlashPathFile } from '@dereekb/util';
import { type StoragePath, type StorageSlashPath } from '../../common/storage/storage';
import { type StorageFileDisplayName } from './storagefile.id';
import { type StorageCustomMetadata } from '../../common/storage/types';
import { type FirebaseStorageAccessorFile } from '../../common/storage/driver/accessor';

/**
 * Input for a {@link StoredFileReader}, carrying the storage bucket and path of the file.
 */
export type StoredFileReaderInput = StoragePath;

/**
 * Input for {@link storageFileDisplayFileName}.
 */
export interface StorageFileDisplayFileNameInput {
  /**
   * The StorageFile's own `n`, which is UNTYPED by contract (see {@link StorageFileDisplayName}).
   */
  readonly displayName?: Maybe<StorageFileDisplayName>;
  /**
   * The object's path — a StorageFile's `pathString`, or the `name` off its storage metadata.
   */
  readonly pathString?: Maybe<StorageSlashPath>;
  /**
   * The object's content type, used when the path names no extension.
   */
  readonly contentType?: Maybe<ContentTypeMimeType>;
}

/**
 * Composes the name a stored file should be presented to a user under.
 *
 * THE one place that answers "what is this file called". A StorageFile's `n` is untyped by contract, so
 * the extension always comes from the object's own path — which is why a purpose whose destination is not
 * name-keyed (a FormSpace file lives at `.../{index}.{ext}`) still downloads and zips under the name its
 * uploader gave it.
 *
 * Falls back to the path's own leaf when there is no display name, so a StorageFile that never had one
 * behaves exactly as it did before.
 *
 * @param input - The display name, the object path, and the content type.
 * @returns The composed file name, or null when the input names neither.
 *
 * @example
 * ```ts
 * storageFileDisplayFileName({ displayName: 'resume', pathString: '/fsp/f1/resume/0.pdf' }); // 'resume.pdf'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function storageFileDisplayFileName(input: StorageFileDisplayFileNameInput): Maybe<SlashPathFile> {
  const { displayName, pathString, contentType } = input;
  const details = pathString == null ? undefined : slashPathDetails(pathString);
  const untypedName = displayName || details?.fileName;
  const extension = details?.typedFileExtension ?? fileExtensionForMimeType(contentType);

  let result: Maybe<SlashPathFile>;

  if (untypedName) {
    result = (extension == null ? untypedName : `${untypedName}${SLASH_PATH_FILE_TYPE_SEPARATOR}${extension}`) as SlashPathFile;
  } else {
    result = details?.end as Maybe<SlashPathFile>;
  }

  return result;
}

/**
 * Factory that creates a {@link StoredFileReader} from a {@link FirebaseStorageAccessorFile}.
 *
 * Use {@link storedFileReaderFactory} to create an instance.
 */
export type StoredFileReaderFactory = FactoryWithRequiredInput<StoredFileReader, FirebaseStorageAccessorFile>;

/**
 * Read-only accessor for a file in Firebase Storage.
 *
 * Provides lazy-loading access to file bytes, streams, metadata, and copy operations
 * without exposing write/delete methods. Metadata is cached after first load.
 *
 * Primarily used server-side for upload processing and file type determination
 * (see {@link UploadedFileTypeDeterminer} in `storagefile.upload.determiner.ts`).
 */
export interface StoredFileReader {
  /**
   * The details that this accessor is for.
   */
  readonly input: StoredFileReaderInput;
  /**
   * Returns details about the path.
   */
  readonly getPathDetails: Factory<SlashPathDetails>;
  /**
   * Loads the file bytes.
   */
  readonly loadFileBytes: FirebaseStorageAccessorFile['getBytes'];
  /**
   * Loads the file stream.
   */
  readonly loadFileStream: FirebaseStorageAccessorFile['getStream'];
  /**
   * Loads the StorageMetadata for this file.
   */
  readonly loadFileMetadata: FirebaseStorageAccessorFile['getMetadata'];
  /**
   * Loads the custom metadata for this file.
   */
  readonly loadCustomMetadata: () => Promise<Maybe<StorageCustomMetadata>>;
  /**
   * Copies this file to the specified destination.
   */
  readonly copy: Required<FirebaseStorageAccessorFile>['copy'];
}

/**
 * Creates a {@link StoredFileReaderFactory} that wraps {@link FirebaseStorageAccessorFile} instances
 * into read-only {@link StoredFileReader} accessors.
 *
 * File metadata is cached after first load; byte/stream accessors are not cached to avoid
 * holding large data in memory.
 *
 * Should only be used server-side, as `copy` may not be available on the client.
 *
 * @returns A factory function that wraps FirebaseStorageAccessorFile instances into StoredFileReader accessors.
 *
 * @example
 * ```ts
 * const factory = storedFileReaderFactory();
 * const reader = factory(storageAccessorFile);
 * const bytes = await reader.loadFileBytes();
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function storedFileReaderFactory(): StoredFileReaderFactory {
  return (file: FirebaseStorageAccessorFile) => {
    const getPathDetails = cachedGetter(() => slashPathDetails(file.storagePath.pathString));
    const details: StoredFileReaderInput = {
      ...file.storagePath
    };

    const loadFileMetadata = cachedGetter(() => file.getMetadata());
    const loadCustomMetadata = () => {
      return loadFileMetadata().then((x) => x.customMetadata);
    };

    const accessor: StoredFileReader = {
      input: details,
      getPathDetails,
      loadFileBytes: file.getBytes, // do not cache the file data accessors
      loadFileStream: file.getStream,
      loadFileMetadata,
      loadCustomMetadata,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- copy is always available on the server-side
      copy: file.copy!
    };

    return accessor;
  };
}
