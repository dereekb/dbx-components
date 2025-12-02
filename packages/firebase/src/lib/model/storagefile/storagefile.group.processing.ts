import { type SlashPathTypedFile } from '@dereekb/util';
import { type StorageFileGroupId, type StorageFilePurpose } from './storagefile.id';
import { type StorageFileProcessingSubtask, type StorageFileProcessingSubtaskMetadata } from './storagefile.task';
import { type StorageFileGroupCreatedStorageFileKey, storageFileGroupCreateStorageFileKeyFactory } from './storagefile';

// MARK: StorageFileGroup Zip StorageFile
/**
 * StorageFilePurpose for a StorageFileGroup's generated zip file.
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
 * Metadata for the StorageFileGroupZipStorageFile.
 */
export interface StorageFileGroupZipStorageFileMetadata {
  readonly sfg: StorageFileGroupId;
}

export const STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE_CREATE_ZIP_SUBTASK: StorageFileProcessingSubtask = 'create_zip';

export type StorageFileGroupZipStorageFileProcessingSubtask = typeof STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE_CREATE_ZIP_SUBTASK;

export type StorageFileGroupZipStorageFileProcessingSubtaskMetadata = StorageFileProcessingSubtaskMetadata;

export const STORAGE_FILE_GROUP_ZIP_INFO_JSON_FILE_NAME: SlashPathTypedFile = 'info.json';
