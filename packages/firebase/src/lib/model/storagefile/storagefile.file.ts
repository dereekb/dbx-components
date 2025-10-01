import { cachedGetter, Factory, FactoryWithRequiredInput, Maybe, slashPathDetails, SlashPathDetails } from '@dereekb/util';
import { StoragePath } from '../../common/storage/storage';
import { StorageCustomMetadata } from '../../common/storage/types';
import { FirebaseStorageAccessorFile } from '../../common/storage/driver/accessor';

/**
 * Details from the input.
 */
export interface StoredFileReaderInput extends StoragePath {}

/**
 * Factory function that creates a StoredFileReader from the input details.
 */
export type StoredFileReaderFactory = FactoryWithRequiredInput<StoredFileReader, FirebaseStorageAccessorFile>;

/**
 * A read-only accessor for file in FirebaseStorage.
 *
 * It exposes only read-only methods for accessing details about the file.
 *
 * This accessor is generally a server-side only interface.
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
 * Creates a StoredFileReaderFactory.
 *
 * Should generally only be used on the server-side, as copy may not be available on the client-side.
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
      copy: file.copy! // copy is always available on the server-side
    };

    return accessor;
  };
}
