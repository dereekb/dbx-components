import { StorageFileGroupId, StorageFilePurpose } from './storagefile.id';
import { StorageFileProcessingSubtask, StorageFileProcessingSubtaskMetadata } from './storagefile.task';

// MARK: StorageFileGroup Zip StorageFile
/**
 * StorageFilePurpose for a StorageFileGroup's zip file.
 */
export const STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE: StorageFilePurpose = 'sfg_zip';

export interface StorageFileGroupZipStorageFileMetadata {
  readonly sfg: StorageFileGroupId;
}

export const STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE_CREATE_ZIP_SUBTASK: StorageFileProcessingSubtask = 'create_zip';

export type StorageFileGroupZipStorageFileProcessingSubtask = typeof STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE_CREATE_ZIP_SUBTASK;

export type StorageFileGroupZipStorageFileProcessingSubtaskMetadata = StorageFileProcessingSubtaskMetadata;
