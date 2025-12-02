import { type SlashPathFile, type SlashPathFolder, type SlashPath, mergeSlashPaths, type Maybe } from '@dereekb/util';
import { type StorageFileGroupId } from './storagefile.id';

/**
 * All StorageFileGroup generated files are stored under this root folder.
 */
export const STORAGE_FILE_GROUP_ROOT_FOLDER_PATH: SlashPathFolder = '/sfg/';

export function storageFileGroupFolderPath(storageFileGroupId: StorageFileGroupId, ...subPath: Maybe<SlashPath>[]): SlashPathFolder {
  return mergeSlashPaths([STORAGE_FILE_GROUP_ROOT_FOLDER_PATH, storageFileGroupId, '/', ...subPath]) as SlashPathFolder;
}

export const STORAGE_FILE_GROUP_ZIP_FILE_PATH: SlashPathFile = 'z.zip';

export function storageFileGroupZipFileStoragePath(storageFileGroupId: StorageFileGroupId): SlashPath {
  return storageFileGroupFolderPath(storageFileGroupId, STORAGE_FILE_GROUP_ZIP_FILE_PATH);
}
