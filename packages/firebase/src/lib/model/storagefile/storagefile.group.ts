import { type SlashPathFile, type SlashPathFolder, type SlashPath, mergeSlashPaths, type Maybe } from '@dereekb/util';
import { type StorageFileGroupId } from './storagefile.id';

/**
 * Root folder in Firebase Storage where all StorageFileGroup-generated files are stored.
 *
 * Each group gets a subfolder: `/sfg/{storageFileGroupId}/`.
 */
export const STORAGE_FILE_GROUP_ROOT_FOLDER_PATH: SlashPathFolder = '/sfg/';

/**
 * Builds the storage folder path for a specific StorageFileGroup, optionally with sub-paths.
 *
 * @param storageFileGroupId - the group's document ID
 * @param subPath - optional sub-paths to append
 * @returns the folder path as a SlashPathFolder string
 *
 * @example
 * ```ts
 * const folder = storageFileGroupFolderPath('abc123');
 * // folder === '/sfg/abc123/'
 *
 * const nested = storageFileGroupFolderPath('abc123', 'output');
 * // nested === '/sfg/abc123/output/'
 * ```
 */
export function storageFileGroupFolderPath(storageFileGroupId: StorageFileGroupId, ...subPath: Maybe<SlashPath>[]): SlashPathFolder {
  return mergeSlashPaths([STORAGE_FILE_GROUP_ROOT_FOLDER_PATH, storageFileGroupId, '/', ...subPath]) as SlashPathFolder;
}

/**
 * File name for a StorageFileGroup's generated zip archive within its folder.
 */
export const STORAGE_FILE_GROUP_ZIP_FILE_PATH: SlashPathFile = 'z.zip';

/**
 * Returns the full storage path for a StorageFileGroup's zip file.
 *
 * @param storageFileGroupId - the group's document ID
 * @returns the full SlashPath to the group's zip archive
 *
 * @example
 * ```ts
 * const zipPath = storageFileGroupZipFileStoragePath('abc123');
 * // zipPath === '/sfg/abc123/z.zip'
 * ```
 */
export function storageFileGroupZipFileStoragePath(storageFileGroupId: StorageFileGroupId): SlashPath {
  return storageFileGroupFolderPath(storageFileGroupId, STORAGE_FILE_GROUP_ZIP_FILE_PATH);
}
