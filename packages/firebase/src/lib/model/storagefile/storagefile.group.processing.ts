import { type SlashPathTypedFile } from '@dereekb/util';
import { type StorageFileGroupId, type StorageFilePurpose } from './storagefile.id';
import { type StorageFileProcessingSubtask, type StorageFileProcessingSubtaskMetadata } from './storagefile.task';
import { type StorageFileGroupCreatedStorageFileKey, storageFileGroupCreateStorageFileKeyFactory } from './storagefile';

// MARK: StorageFileGroup Zip StorageFile
/**
 * {@link StorageFilePurpose} identifier for a StorageFileGroup's generated zip file.
 *
 * This purpose is used to create a predictable {@link StorageFileGroupCreatedStorageFileKey}
 * for the group's zip StorageFile, enabling deterministic document ID generation.
 */
export const STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE: StorageFilePurpose = 'sfg_zip';

/**
 * The predictable StorageFileKey for the StorageFileGroup's generated zip file StorageFile.
 */
export type StorageFileGroupZipStorageFileKey = StorageFileGroupCreatedStorageFileKey<typeof STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE>;

/**
 * Creates a StorageFileGroupZipStorageFileKey from the input StorageFileGroupId.
 */
export const storageFileGroupZipStorageFileKey = storageFileGroupCreateStorageFileKeyFactory(STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE);

/**
 * Metadata stored on the zip StorageFile, linking it back to its parent StorageFileGroup.
 */
export interface StorageFileGroupZipStorageFileMetadata {
  /**
   * StorageFileGroup ID. ID of the StorageFileGroup that this zip file was generated for.
   */
  readonly sfg: StorageFileGroupId;
}

/**
 * Subtask checkpoint identifier for the zip creation step of StorageFileGroup processing.
 */
export const STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE_CREATE_ZIP_SUBTASK: StorageFileProcessingSubtask = 'create_zip';

/**
 * Type alias for the zip creation subtask checkpoint string.
 */
export type StorageFileGroupZipStorageFileProcessingSubtask = typeof STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE_CREATE_ZIP_SUBTASK;

/**
 * Metadata type for the zip creation subtask.
 */
export type StorageFileGroupZipStorageFileProcessingSubtaskMetadata = StorageFileProcessingSubtaskMetadata;

/**
 * File name of the JSON metadata file stored alongside the zip in the group's storage folder.
 */
export const STORAGE_FILE_GROUP_ZIP_INFO_JSON_FILE_NAME: SlashPathTypedFile = 'info.json';
