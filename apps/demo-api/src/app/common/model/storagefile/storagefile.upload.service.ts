import { compressImageBufferToTargetSize, type StorageFileInitializeFromUploadService, type StorageFileInitializeFromUploadServiceConfig, type StorageFileInitializeFromUploadServiceInitializer, type StorageFileInitializeFromUploadServiceInitializerInput, type StorageFileInitializeFromUploadServiceInitializerResult, storageFileInitializeFromUploadService, storageFileInitializeFromUploadServiceInitializerResultPermanentFailure } from '@dereekb/firebase-server/model';
import { type DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { makeUserAvatarFileStoragePath, USER_AVATAR_IMAGE_HEIGHT, USER_AVATAR_IMAGE_WIDTH, USER_AVATAR_PURPOSE, USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_AVATAR_UPLOADS_FILE_NAME, USER_TEST_FILE_PURPOSE, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADS_FOLDER_NAME, userAvatarFileGroupIds, userTestFileGroupIds, userTestFileStoragePath } from 'demo-firebase';
import { ALL_USER_UPLOADS_FOLDER_PATH, createStorageFileDocumentPairFactory, determineByFilePath, determineUserByUserUploadsFolderWrapperFunction, type FirebaseAuthUserId, StorageFileCreationType } from '@dereekb/firebase';
import { mimeTypeForImageFileExtension, type SlashPathPathMatcherPath } from '@dereekb/util';
import sharp from 'sharp';
import { makeUserLogFileUploadInitializer } from './handlers/upload.user.log';

/**
 * Soft target output size for the demo user avatar (≈500KB). The shared image
 * compressor will iterate quality steps to land at or under this size after the
 * square-crop is applied.
 */
const USER_AVATAR_TARGET_SIZE_BYTES = 500 * 1024;

/**
 * Builds the StorageFileInitializeFromUploadService for the demo API.
 * Configures upload handlers for user test files and user avatar images,
 * including Sharp-based image resizing for avatars.
 *
 * @param demoFirebaseServerActionsContext - server actions context providing storage, profile, and storage file collections
 * @returns a configured upload service with determiners and initializers for all supported file types
 */
export function demoStorageFileUploadServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): StorageFileInitializeFromUploadService {
  const { storageService, profileCollection, storageFileCollection } = demoFirebaseServerActionsContext;
  const storageFileDocumentAccessor = storageFileCollection.documentAccessor();

  const createStorageFileDocumentPair = createStorageFileDocumentPairFactory({
    defaultCreationType: StorageFileCreationType.INIT_FROM_UPLOAD
  });

  // MARK: User Upload Files
  const matchUserUploadsFolderMatcherPath: SlashPathPathMatcherPath = [ALL_USER_UPLOADS_FOLDER_PATH, true]; // matches to /uploads/u/{userId}
  const determineUserFromUploadsFolderPath = determineUserByUserUploadsFolderWrapperFunction({ allowSubPaths: true });

  const userTestFileDeterminer = determineUserFromUploadsFolderPath(
    determineByFilePath({
      fileType: USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER,
      match: {
        targetPath: [...matchUserUploadsFolderMatcherPath, USER_TEST_FILE_UPLOADS_FOLDER_NAME, true] // matches to /uploads/u/{userId}/test/{filename}
      }
    })
  );

  const userTestFileInitializer: StorageFileInitializeFromUploadServiceInitializer = {
    type: USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER,
    initialize: async function (input: StorageFileInitializeFromUploadServiceInitializerInput): Promise<StorageFileInitializeFromUploadServiceInitializerResult> {
      const { file } = input.fileDetailsAccessor.getPathDetails();

      const userId = input.determinerResult.user as FirebaseAuthUserId;

      // move the file to /test/u/{userId}/{filename}
      const newPath = userTestFileStoragePath(userId, file as string);
      const createdFile = await input.fileDetailsAccessor.copy(newPath);

      // create the StorageFileDocument and reference the new file
      const { storageFileDocument } = await createStorageFileDocumentPair({
        accessor: storageFileDocumentAccessor,
        file: createdFile,
        user: userId,
        purpose: USER_TEST_FILE_PURPOSE,
        storageFileGroupIds: userTestFileGroupIds(userId),
        shouldBeProcessed: true
      });

      return { createdFile, storageFileDocument };
    },
    determiner: userTestFileDeterminer
  };

  const userTestAvatarDeterminer = determineUserFromUploadsFolderPath(
    determineByFilePath({
      fileType: USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER,
      match: {
        targetPath: [...matchUserUploadsFolderMatcherPath, USER_AVATAR_UPLOADS_FILE_NAME] // matches to /uploads/u/{userId}/avatar.img
      }
    })
  );

  const userTestAvatarInitializer: StorageFileInitializeFromUploadServiceInitializer = {
    type: USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER,
    initialize: async function (input: StorageFileInitializeFromUploadServiceInitializerInput): Promise<StorageFileInitializeFromUploadServiceInitializerResult> {
      const userId = input.determinerResult.user as FirebaseAuthUserId;

      // download the file
      const fileBytes = await input.fileDetailsAccessor.loadFileBytes();

      let newImageBytes: Buffer | undefined;
      let failureResult: StorageFileInitializeFromUploadServiceInitializerResult | undefined;

      try {
        // crop to a square at the avatar dimensions, then let the shared compressor
        // iterate quality to fit under the per-avatar target size.
        const croppedBytes = await sharp(fileBytes)
          .resize({
            width: USER_AVATAR_IMAGE_WIDTH,
            height: USER_AVATAR_IMAGE_HEIGHT,
            fit: 'cover'
          })
          .jpeg({
            quality: 90
          })
          .toBuffer();

        const compressed = await compressImageBufferToTargetSize(croppedBytes, {
          targetSizeBytes: USER_AVATAR_TARGET_SIZE_BYTES,
          maxDimension: USER_AVATAR_IMAGE_WIDTH,
          format: 'jpeg'
        });

        newImageBytes = compressed.buffer;
      } catch (e) {
        // if sharp fails to initialize, then the uploaded file is probably unsupported.
        failureResult = storageFileInitializeFromUploadServiceInitializerResultPermanentFailure(e);
      }

      let result: StorageFileInitializeFromUploadServiceInitializerResult;

      if (failureResult != null || newImageBytes == null) {
        result = failureResult as StorageFileInitializeFromUploadServiceInitializerResult;
      } else {
        const fileMimeType = mimeTypeForImageFileExtension('jpeg');

        // create the new file at /avatar/u/{userId}/avatar
        const newPath = makeUserAvatarFileStoragePath(userId);
        const createdFile = storageService.file(newPath);

        await createdFile.upload(newImageBytes, { contentType: fileMimeType });

        // create the StorageFileDocument and reference the new file
        const createStorageFileResult = await createStorageFileDocumentPair({
          accessor: storageFileDocumentAccessor,
          file: createdFile,
          user: userId,
          purpose: USER_AVATAR_PURPOSE,
          storageFileGroupIds: userAvatarFileGroupIds(userId),
          shouldBeProcessed: false // no processing
        });

        const profileDocument = profileCollection.documentAccessor().loadDocumentForId(userId);
        const profileExists = await profileDocument.exists();

        if (profileExists) {
          const avatarDownloadUrl = await createdFile.getDownloadUrl();

          await profileDocument.update({
            avatarStorageFile: createStorageFileResult.storageFileDocument.key,
            avatar: avatarDownloadUrl
          });
        }

        result = {
          createStorageFileResult,
          flagPreviousForDelete: true
        };
      }

      return result;
    },
    determiner: userTestAvatarDeterminer
  };

  const userLogFileInitializer = makeUserLogFileUploadInitializer(demoFirebaseServerActionsContext);

  const userFileInitializers = [userTestFileInitializer, userTestAvatarInitializer, userLogFileInitializer];

  // MARK: System Upload Files

  // TODO: ...

  const systemFileInitializers: StorageFileInitializeFromUploadServiceInitializer[] = [];

  // MARK: Configuration
  const storageFileUploadServiceConfig: StorageFileInitializeFromUploadServiceConfig = {
    validate: true,
    storageService,
    initializer: [...userFileInitializers, ...systemFileInitializers],
    storageFileCollection
  };

  return storageFileInitializeFromUploadService(storageFileUploadServiceConfig);
}
