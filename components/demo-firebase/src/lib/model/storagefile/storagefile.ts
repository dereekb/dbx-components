import { ALL_USER_UPLOADS_FOLDER_PATH, FirebaseAuthUserId, StorageFileProcessingSubtask, StorageFileProcessingSubtaskMetadata, StorageFilePurpose, UploadedFileTypeIdentifier } from '@dereekb/firebase';
import { Maybe, mergeSlashPaths, SlashPath, SlashPathFile, SlashPathFolder, SlashPathUntypedFile, stringFromTimeFactory } from '@dereekb/util';

// MARK: User File Types
/**
 * A test file that is uploaded by a user into their own uploads folder.
 *
 * The file has no specific name, but must be uploaded to the "test" folder.
 */
export const USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_test_file';

export const USER_TEST_FILE_UPLOADS_FOLDER_NAME: string = 'test';

export function userTestFileUploadsFolderPath(userId: FirebaseAuthUserId): SlashPathFolder {
  return `${ALL_USER_UPLOADS_FOLDER_PATH}/${userId}/${USER_TEST_FILE_UPLOADS_FOLDER_NAME}/`;
}

export function userTestFileUploadsFilePath(userId: FirebaseAuthUserId, name: SlashPathFile): SlashPath {
  return `${userTestFileUploadsFolderPath(userId)}${name}`;
}

export const USER_TEST_FILE_PURPOSE: StorageFilePurpose = 'test';

export const USER_TEST_FILE_PURPOSE_PART_A_SUBTASK: StorageFileProcessingSubtask = 'part_a';
export const USER_TEST_FILE_PURPOSE_PART_B_SUBTASK: StorageFileProcessingSubtask = 'part_b';

export type UserTestFileProcessingSubtask = typeof USER_TEST_FILE_PURPOSE_PART_A_SUBTASK | typeof USER_TEST_FILE_PURPOSE_PART_B_SUBTASK;

export interface UserTestFileProcessingSubtaskMetadata extends StorageFileProcessingSubtaskMetadata {
  numberValue?: Maybe<number>;
  stringValue?: Maybe<string>;
}

export const USERS_ROOT_FOLDER_PATH: SlashPathFolder = '/u/';

export function userStorageFolderPath(userId: FirebaseAuthUserId, ...subPath: Maybe<SlashPath>[]): SlashPathFolder {
  return mergeSlashPaths([USERS_ROOT_FOLDER_PATH, userId, '/', ...subPath]) as SlashPathFolder;
}

export const USER_STORAGE_FOLDER_PATH: SlashPathFolder = 'test/';

export function userTestFileStoragePath(userId: FirebaseAuthUserId, name: SlashPathFile): SlashPath {
  return userStorageFolderPath(userId, USER_STORAGE_FOLDER_PATH, name);
}

/**
 * A test file that is uploaded by a user into their own uploads folder.
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

// MARK: System File Types
