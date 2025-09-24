import { cachedGetter, Factory, FactoryWithRequiredInput, Maybe, slashPathDetails, SlashPathDetails } from '@dereekb/util';
import { StoragePath } from '../../common/storage/storage';
import { FirebaseStorageAccessorFile, StorageCustomMetadata } from '../../common';

/**
 * StorageFile uploaded-file type identifier.
 *
 * Used as a descriminator for choosing the appropriate upload processor.
 *
 * The upload type is generally determined by one of a few ways:
 * - file name: A specific file name (e.g. 'avatar.png' or 'photos/avatar.png')
 * - folder name: A specific folder name (e.g. 'photos' in 'photos/12345.png')
 * - metadata: specific metadata value in the uploaded file's custom metadata
 * - data: specific data in the uploaded file
 */
export type UploadedFileTypeIdentifier = string;

/**
 * Details from the input.
 */
export interface UploadedFileDetails extends StoragePath {}

/**
 * Factory function that creates an UploadedFileDetailsAccessor from the input details.
 */
export type UploadedFileDetailsAccessorFactory = FactoryWithRequiredInput<UploadedFileDetailsAccessor, FirebaseStorageAccessorFile>;

/**
 * Accessor for uploaded file details.
 *
 * It provides read-only methods for accessing details about the uploaded file.
 *
 * This accessor is generally a server-side only interface.
 */
export interface UploadedFileDetailsAccessor {
  /**
   * The details that this accessor is for.
   */
  readonly details: UploadedFileDetails;
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
  readonly copy?: FirebaseStorageAccessorFile['copy'];
}

/**
 * Creates a UploadedFileDetailsAccessorFactory.
 */
export function uploadedFileDetailsAccessorFactory(): UploadedFileDetailsAccessorFactory {
  return (file: FirebaseStorageAccessorFile) => {
    const getPathDetails = cachedGetter(() => slashPathDetails(file.storagePath.pathString));
    const details: UploadedFileDetails = {
      ...file.storagePath
    };

    const loadFileMetadata = cachedGetter(() => file.getMetadata());
    const loadCustomMetadata = () => {
      return loadFileMetadata().then((x) => x.customMetadata);
    };

    const accessor: UploadedFileDetailsAccessor = {
      details,
      getPathDetails,
      loadFileBytes: file.getBytes, // do not cache the file data accessors
      loadFileStream: file.getStream,
      loadFileMetadata,
      loadCustomMetadata
    };

    return accessor;
  };
}

// MARK: Upload Service
/**
 * Result type of a StorageFileInitializeFromUploadService.handleNotificationTask() call.
 *
 * success: The file was used/processed successfully.
 * no_determiner_match: Could not determine the proper processor for this file.
 * no_processor_configured: There was no processor configured for this file.
 * processor_error: There was an error thrown during processing.
 *
 */
export type StorageFileInitializeFromUploadResultType = 'success' | 'no_determiner_match' | 'no_processor_configured' | 'processor_error';
