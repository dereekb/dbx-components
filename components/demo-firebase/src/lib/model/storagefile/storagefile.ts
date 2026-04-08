import { ALL_USER_UPLOADS_FOLDER_PATH, firestoreModelKey, type StorageFileGroupId, twoWayFlatFirestoreModelKey, type FirebaseAuthUserId, type StorageFileProcessingSubtask, type StorageFileProcessingSubtaskMetadata, type StorageFilePurpose, type UploadedFileTypeIdentifier } from '@dereekb/firebase';
import { type Maybe, mergeSlashPaths, type Milliseconds, type SlashPath, type SlashPathFile, type SlashPathFolder, type SlashPathUntypedFile, stringFromTimeFactory } from '@dereekb/util';
import { profileIdentity } from '../profile';

// MARK: User File Types
export const USERS_ROOT_FOLDER_PATH: SlashPathFolder = '/u/';

/**
 * Builds the storage folder path for a specific user, optionally appending sub-paths.
 *
 * @param userId - The Firebase Auth user ID.
 * @param subPath - Optional additional path segments to append.
 * @returns The resolved SlashPathFolder for the user's storage area.
 */
export function userStorageFolderPath(userId: FirebaseAuthUserId, ...subPath: Maybe<SlashPath>[]): SlashPathFolder {
  return mergeSlashPaths([USERS_ROOT_FOLDER_PATH, userId, '/', ...subPath]) as SlashPathFolder;
}

// === User Test File ===
/**
 * A test file that is uploaded by a user into their own uploads folder.
 *
 * The file has no specific name, but must be uploaded to the "test" folder.
 */
export const USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_test_file';

export const USER_TEST_FILE_UPLOADS_FOLDER_NAME: string = 'test';

/**
 * Returns the uploads folder path for a user's test files.
 *
 * @param userId - The Firebase Auth user ID.
 * @returns The SlashPathFolder where test file uploads are stored for this user.
 */
export function userTestFileUploadsFolderPath(userId: FirebaseAuthUserId): SlashPathFolder {
  return `${ALL_USER_UPLOADS_FOLDER_PATH}/${userId}/${USER_TEST_FILE_UPLOADS_FOLDER_NAME}/`;
}

/**
 * Returns the full uploads file path for a user's test file with the given name.
 *
 * @param userId - The Firebase Auth user ID.
 * @param name - The file name within the test uploads folder.
 * @returns The full SlashPath to the uploaded test file.
 */
export function userTestFileUploadsFilePath(userId: FirebaseAuthUserId, name: SlashPathFile): SlashPath {
  return `${userTestFileUploadsFolderPath(userId)}${name}`;
}

export const USER_TEST_FILE_PURPOSE: StorageFilePurpose = 'test';

export const USER_TEST_FILE_PURPOSE_PART_A_SUBTASK: StorageFileProcessingSubtask = 'part_a';
export const USER_TEST_FILE_PURPOSE_PART_B_SUBTASK: StorageFileProcessingSubtask = 'part_b';

export type UserTestFileProcessingSubtask = typeof USER_TEST_FILE_PURPOSE_PART_A_SUBTASK | typeof USER_TEST_FILE_PURPOSE_PART_B_SUBTASK;

export interface UserTestFileProcessingSubtaskMetadata extends StorageFileProcessingSubtaskMetadata {
  /**
   * Passed to the result of the task.
   *
   * Used for testing.
   */
  readonly canRunNextCheckpoint?: Maybe<boolean>;
  /**
   * Passed to the result of the task.
   *
   * Used for testing.
   */
  readonly delayUntil?: Maybe<Date | Milliseconds>;
  readonly numberValue?: Maybe<number>;
  readonly stringValue?: Maybe<string>;
}

export const USER_STORAGE_FOLDER_PATH: SlashPathFolder = 'test/';

/**
 * Returns the processed storage path for a user's test file.
 *
 * This is the final storage location after upload processing, distinct from the uploads path.
 *
 * @param userId - The Firebase Auth user ID.
 * @param name - The file name within the storage folder.
 * @returns The full SlashPath to the stored test file.
 */
export function userTestFileStoragePath(userId: FirebaseAuthUserId, name: SlashPathFile): SlashPath {
  return userStorageFolderPath(userId, USER_STORAGE_FOLDER_PATH, name);
}

/**
 * Generates the StorageFileGroupId for a user's profile, derived from the profile model key.
 *
 * This group ID is used to associate storage files with a user's profile.
 *
 * @param userId - The Firebase Auth user ID.
 * @returns The StorageFileGroupId linking storage files to this user's profile.
 */
export function userProfileStorageFileGroupId(userId: FirebaseAuthUserId): StorageFileGroupId {
  return twoWayFlatFirestoreModelKey(firestoreModelKey(profileIdentity, userId));
}

/**
 * Returns the list of StorageFileGroupIds that a user's test files belong to.
 *
 * @param userId - The Firebase Auth user ID.
 * @returns An array of StorageFileGroupIds for the user's test file group membership.
 */
export function userTestFileGroupIds(userId: FirebaseAuthUserId): StorageFileGroupId[] {
  return [userProfileStorageFileGroupId(userId)];
}

// === User Avatar ===
/**
 * A test file that is uploaded by a user into their own uploads folder.
 *
 * It does not have any processing.
 */
export const USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_avatar';

/**
 * Allowed mime types.
 */
export const USER_AVATAR_UPLOADS_ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png'];

/**
 * The file is named "avatar.img" and can be any of the allowed file types.
 *
 * Should be uploaded to "/uploads/u/{userid}/avatar.img"
 */
export const USER_AVATAR_UPLOADS_FILE_NAME: SlashPathUntypedFile = 'avatar.img';

/**
 * Returns the uploads file path for a user's avatar image.
 *
 * The avatar is always uploaded to a fixed path based on the user ID.
 *
 * @param userId - The Firebase Auth user ID.
 * @returns The SlashPathUntypedFile where the avatar upload is stored.
 */
export function userAvatarUploadsFilePath(userId: FirebaseAuthUserId): SlashPathUntypedFile {
  return `${ALL_USER_UPLOADS_FOLDER_PATH}/${userId}/${USER_AVATAR_UPLOADS_FILE_NAME}`;
}

export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';

export const USER_AVATAR_STORAGE_FILE_NAME_PREFIX: SlashPathFile = 'avatar';

/**
 * The user's storage path is not always the same, since the avatar is subject to changing, and the url can change.
 *
 * This function creates a new storage path for the avatar, based on the user's id and the current time.
 *
 * @param userId - The Firebase Auth user ID.
 * @returns A unique SlashPath for the avatar file, incorporating a timestamp to avoid caching issues.
 */
export function makeUserAvatarFileStoragePath(userId: FirebaseAuthUserId): SlashPath {
  const timestamp = stringFromTimeFactory(7)();
  return userStorageFolderPath(userId, USER_AVATAR_STORAGE_FILE_NAME_PREFIX, `${timestamp}.jpg`);
}

/**
 * Returns the list of StorageFileGroupIds that a user's avatar file belongs to.
 *
 * @param userId - The Firebase Auth user ID.
 * @returns An array of StorageFileGroupIds for the user's avatar group membership.
 */
export function userAvatarFileGroupIds(userId: FirebaseAuthUserId): StorageFileGroupId[] {
  return [userProfileStorageFileGroupId(userId)];
}

export const USER_AVATAR_IMAGE_WIDTH = 512;
export const USER_AVATAR_IMAGE_HEIGHT = USER_AVATAR_IMAGE_WIDTH;

// MARK: System File Types
