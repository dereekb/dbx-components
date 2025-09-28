import { UploadedFileTypeIdentifier } from '@dereekb/firebase';
import { SlashPathUntypedFile } from '@dereekb/util';

// MARK: Test File
/**
 * A test file that is uploaded by a user into their own uploads folder.
 */
export const USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_test_file';

/**
 * A test file that is uploaded by a user into their own uploads folder.
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
