import { ALL_USER_UPLOADS_FOLDER_PATH, FirebaseAuthUserId, StorageFileProcessingSubtask, StorageFileProcessingSubtaskMetadata, StorageFilePurpose, UploadedFileTypeIdentifier } from '@dereekb/firebase';
import { Maybe, mergeSlashPaths, SlashPath, SlashPathFile, SlashPathFolder, SlashPathUntypedFile, stringFromTimeFactory } from '@dereekb/util';

// MARK: User File Types
export const USERS_ROOT_FOLDER_PATH: SlashPathFolder = '/u/';

export function userStorageFolderPath(userId: FirebaseAuthUserId, ...subPath: Maybe<SlashPath>[]): SlashPathFolder {
  return mergeSlashPaths([USERS_ROOT_FOLDER_PATH, userId, '/', ...subPath]) as SlashPathFolder;
}

// === User Avatar ===
/**
 * An avatar that is uploaded by a user into their own uploads folder.
 *
 * It does not have any processing.
 */
export const USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_avatar';

/**
 * Allowed mime types.
 */
export const USER_AVATAR_UPLOADS_ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

/**
 * The file is named "avatar.img" and can be any of the allowed file types.
 *
 * Should be uploaded to "/uploads/u/{userid}/avatar.img"
 */
export const USER_AVATAR_UPLOADS_FILE_NAME: SlashPathUntypedFile = 'avatar.img';

export function userAvatarUploadsFilePath(userId: FirebaseAuthUserId): SlashPathUntypedFile {
  return `${ALL_USER_UPLOADS_FOLDER_PATH}/${userId}/${USER_AVATAR_UPLOADS_FILE_NAME}`;
}

export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';

export const USER_AVATAR_STORAGE_FILE_NAME_PREFIX: SlashPathFile = 'avatar';

/**
 * The user's storage path is not always the same, since the avatar is subject to changing, and the url can change.
 *
 * This function creates a new storage path for the avatar, based on the user's id and the current time.
 */
export function makeUserAvatarFileStoragePath(userId: FirebaseAuthUserId): SlashPath {
  const timestamp = stringFromTimeFactory(7)();
  return userStorageFolderPath(userId, USER_AVATAR_STORAGE_FILE_NAME_PREFIX, `${timestamp}.jpg`);
}

export const USER_AVATAR_IMAGE_WIDTH = 512;
export const USER_AVATAR_IMAGE_HEIGHT = USER_AVATAR_IMAGE_WIDTH;
