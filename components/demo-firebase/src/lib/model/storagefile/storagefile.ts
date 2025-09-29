import { ALL_USER_UPLOADS_FOLDER_PATH, FirebaseAuthUserId, UploadedFileTypeIdentifier } from '@dereekb/firebase';
import { SlashPath, SlashPathFile, SlashPathFolder, SlashPathUntypedFile } from '@dereekb/util';

// MARK: User File Types
/**
 * A test file that is uploaded by a user into their own uploads folder.
 *
 * The file has no specific name, but must be uploaded to the "test" folder.
 */
export const USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_test_file';

export const USER_TEST_FILE_UPLOADS_FOLDER_NAME: SlashPathFolder = 'test/';

export function userTestFileUploadsFolderPath(userId: FirebaseAuthUserId): SlashPathFolder {
  return `${ALL_USER_UPLOADS_FOLDER_PATH}/${userId}/${USER_TEST_FILE_UPLOADS_FOLDER_NAME}`;
}

export function userTestFileUploadsFilePath(userId: FirebaseAuthUserId, name: SlashPathFile): SlashPath {
  return `${userTestFileUploadsFolderPath(userId)}${name}`;
}

/**
 * A test file that is uploaded by a user into their own uploads folder.
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

// MARK: System File Types
