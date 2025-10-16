import { FirebaseStorageAccessorFile, StorageFileDocument, StorageFileInitializeFromUploadResultType, StoragePath, UploadedFileTypeDeterminerResult } from '@dereekb/firebase';
import { Maybe, PromiseOrValue } from '@dereekb/util';

/**
 * Provides a reference to a StorageFileInitializeFromUploadService instance.
 */
export interface StorageFileInitializeFromUploadServiceRef {
  readonly storageFileInitializeFromUploadService: StorageFileInitializeFromUploadService;
}

export interface StorageFileInitializeFromUploadInput {
  /**
   * The target file.
   *
   * This file should not be modified (e.g. deleted) during the processor call.
   */
  readonly file: FirebaseStorageAccessorFile;
}

export interface StorageFileInitializeFromUploadResult {
  /**
   * Whether or not the initialization was successful.
   */
  readonly resultType: StorageFileInitializeFromUploadResultType;
  /**
   * Path of the created file.
   */
  readonly createdFilePath?: Maybe<StoragePath>;
  /**
   * The initialized StorageFile value, if applicable.
   */
  readonly storageFileDocument?: Maybe<StorageFileDocument>;
  /**
   * Any error that occurred during processing.
   */
  readonly initializationError?: Maybe<unknown>;
  /**
   * Number of StorageFiles that were flagged for deletion.
   *
   * Only set if flagPreviousForDelete was provided.
   */
  readonly previousStorageFilesFlaggedForDeletion?: Maybe<number>;
}

/**
 * Service dedicated to initializing a StorageFileDocument value from an uploaded file.
 */
export abstract class StorageFileInitializeFromUploadService {
  /**
   * Returns true if the file is allowed to be initialized.
   *
   * @param file
   */
  abstract checkFileIsAllowedToBeInitialized(file: FirebaseStorageAccessorFile): PromiseOrValue<boolean>;
  /**
   * Used to determine the type of the input file.
   */
  abstract determineUploadFileType(input: StorageFileInitializeFromUploadInput): Promise<Maybe<UploadedFileTypeDeterminerResult>>;
  /**
   * Initializes a StorageFileDocument value from an uploaded file.
   *
   * The input file is unchanged, only new content is created.
   */
  abstract initializeFromUpload(input: StorageFileInitializeFromUploadInput): Promise<StorageFileInitializeFromUploadResult>;
}
