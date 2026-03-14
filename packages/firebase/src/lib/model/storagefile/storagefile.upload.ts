import { type FactoryWithRequiredInput, type Maybe, type SlashPath, toAbsoluteSlashPathStartType } from '@dereekb/util';
import { type StoragePath } from '../../common/storage/storage';
import { type FirebaseAuthUserId } from '../../common';

/**
 * Root path for all uploaded files in Firebase Storage.
 *
 * Files uploaded here are transient and are processed/cleared by the upload initialization
 * service. The folder structure is: `uploads/u/{userId}/{fileName}`.
 *
 * See {@link userUploadsFolderSlashPathFactory} for building user-specific upload paths.
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
 * Factory that generates the uploads folder SlashPath for a given user ID.
 */
export type UserUploadsFolderSlashPathFactory = FactoryWithRequiredInput<SlashPath, FirebaseAuthUserId>;

/**
 * Creates a {@link UserUploadsFolderSlashPathFactory} that generates per-user upload folder paths.
 *
 * @param inputBasePath - optional custom base path; defaults to {@link ALL_USER_UPLOADS_FOLDER_PATH}
 *
 * @example
 * ```ts
 * const factory = userUploadsFolderSlashPathFactory();
 * const path = factory('user123');
 * // path === '/uploads/u/user123'
 * ```
 */
export function userUploadsFolderSlashPathFactory(inputBasePath?: Maybe<string>): UserUploadsFolderSlashPathFactory {
  const basePath = toAbsoluteSlashPathStartType(inputBasePath ?? ALL_USER_UPLOADS_FOLDER_PATH);
  return (userId) => `${basePath}/${userId}`;
}

/**
 * Factory that generates a full {@link StoragePath} (with bucket) for a given user's uploads folder.
 */
export type UserUploadsFolderStoragePathFactory = FactoryWithRequiredInput<StoragePath, FirebaseAuthUserId>;

/**
 * Configuration for {@link userUploadsFolderStoragePathFactory}.
 */
export interface UserUploadsFolderStoragePathFactoryConfig {
  readonly bucketId: string;
  readonly basePath?: Maybe<string>;
}

/**
 * Creates a {@link UserUploadsFolderStoragePathFactory} that includes the storage bucket ID.
 *
 * @example
 * ```ts
 * const factory = userUploadsFolderStoragePathFactory({ bucketId: 'my-bucket' });
 * const storagePath = factory('user123');
 * // storagePath === { pathString: '/uploads/u/user123', bucketId: 'my-bucket' }
 * ```
 */
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
 * Result of a `StorageFileInitializeFromUploadService.handleNotificationTask()` call,
 * indicating how the upload initialization concluded.
 *
 * - `success` — file was used/processed successfully and a StorageFile was created
 * - `no_determiner_match` — no {@link UploadedFileTypeDeterminer} could identify this file
 * - `no_initializer_configured` — the file type was identified but no initializer is registered for it
 * - `initializer_error` — the initializer threw an error during processing
 * - `permanent_initializer_failure` — the initializer failed permanently; the file should be deleted
 */
export type StorageFileInitializeFromUploadResultType = 'success' | 'no_determiner_match' | 'no_initializer_configured' | 'initializer_error' | 'permanent_initializer_failure';
