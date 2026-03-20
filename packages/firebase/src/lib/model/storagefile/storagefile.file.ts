import { cachedGetter, type Factory, type FactoryWithRequiredInput, type Maybe, slashPathDetails, type SlashPathDetails } from '@dereekb/util';
import { type StoragePath } from '../../common/storage/storage';
import { type StorageCustomMetadata } from '../../common/storage/types';
import { type FirebaseStorageAccessorFile } from '../../common/storage/driver/accessor';

/**
 * Input for a {@link StoredFileReader}, carrying the storage bucket and path of the file.
 */
export type StoredFileReaderInput = StoragePath;

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
 * @returns a factory function that wraps FirebaseStorageAccessorFile instances into StoredFileReader accessors
 *
 * @example
 * ```ts
 * const factory = storedFileReaderFactory();
 * const reader = factory(storageAccessorFile);
 * const bytes = await reader.loadFileBytes();
 * ```
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
