import { cachedGetter, Factory, FactoryWithRequiredInput, Maybe, mergeSlashPaths, SlashPath, slashPathDetails, SlashPathDetails, toAbsoluteSlashPathStartType } from '@dereekb/util';
import { StoragePath } from '../../common/storage/storage';
import { FirebaseAuthUserId, FirebaseStorageAccessorFile, StorageCustomMetadata } from '../../common';

/**
 * The base path for all uploaded files.
 *
 * The uploads folder is a transient folder that is cleared/processed often of files that are uploaded to it.
 */
export const UPLOADS_FOLDER_PATH = 'uploads';

/**
 * The folder name that contains the uploads for each user "u".
 */
export const ALL_USER_UPLOADS_FOLDER_NAME = `u`;

/**
 * All users uploads folder path.
 *
 * For example, user 12345 will upload their files to folder "uploads/u/12345/".
 */
export const ALL_USER_UPLOADS_FOLDER_PATH = `${UPLOADS_FOLDER_PATH}/${ALL_USER_UPLOADS_FOLDER_NAME}`;

/**
 * Creates a SlashPath for the input user's uploads folder.
 */
export type UserUploadsFolderSlashPathFactory = FactoryWithRequiredInput<SlashPath, FirebaseAuthUserId>;

export function userUploadsFolderSlashPathFactory(inputBasePath?: Maybe<string>): UserUploadsFolderSlashPathFactory {
  const basePath = toAbsoluteSlashPathStartType(inputBasePath ?? ALL_USER_UPLOADS_FOLDER_PATH);
  return (userId) => `${basePath}/${userId}`;
}

export type UserUploadsFolderStoragePathFactory = FactoryWithRequiredInput<StoragePath, FirebaseAuthUserId>;

export interface UserUploadsFolderStoragePathFactoryConfig {
  readonly bucketId: string;
  readonly basePath?: Maybe<string>;
}

export function userUploadsFolderStoragePathFactory({ bucketId, basePath: inputBasePath }: UserUploadsFolderStoragePathFactoryConfig): UserUploadsFolderStoragePathFactory {
  const userUploadsFolderSlashPath = userUploadsFolderSlashPathFactory(inputBasePath);
  return (userId) => ({ pathString: userUploadsFolderSlashPath(userId), bucketId });
}

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

// MARK: Upload Service
/**
 * Result type of a StorageFileInitializeFromUploadService.handleNotificationTask() call.
 *
 * success: The file was used/processed successfully.
 * no_determiner_match: Could not determine the proper processor for this file.
 * no_initializer_configured: There was no processor configured for this file.
 * initializer_error: There was an error thrown during processing.
 * permanent_initializer_failure: The initializer failed permanently and the file should be deleted.
 */
export type StorageFileInitializeFromUploadResultType = 'success' | 'no_determiner_match' | 'no_initializer_configured' | 'initializer_error' | 'permanent_initializer_failure';
