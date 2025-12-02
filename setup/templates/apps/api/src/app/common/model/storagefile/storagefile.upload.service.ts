import { StorageFileInitializeFromUploadService, StorageFileInitializeFromUploadServiceConfig, StorageFileInitializeFromUploadServiceInitializer, StorageFileInitializeFromUploadServiceInitializerInput, StorageFileInitializeFromUploadServiceInitializerResult, storageFileInitializeFromUploadService, storageFileInitializeFromUploadServiceInitializerResultPermanentFailure } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { makeUserAvatarFileStoragePath, USER_AVATAR_IMAGE_HEIGHT, USER_AVATAR_IMAGE_WIDTH, USER_AVATAR_PURPOSE, USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_AVATAR_UPLOADS_FILE_NAME } from 'FIREBASE_COMPONENTS_NAME';
import { ALL_USER_UPLOADS_FOLDER_PATH, createStorageFileDocumentPairFactory, determineByFilePath, determineUserByUserUploadsFolderWrapperFunction, FirebaseAuthUserId, StorageFileCreationType } from '@dereekb/firebase';
import { mimeTypeForImageFileExtension, SlashPathPathMatcherPath } from '@dereekb/util';
import * as sharp from 'sharp';

export function APP_CODE_PREFIX_CAMELStorageFileUploadServiceFactory(APP_CODE_PREFIX_CAMELFirebaseServerActionsContext: APP_CODE_PREFIXFirebaseServerActionsContext): StorageFileInitializeFromUploadService {
  const { storageService, storageFileCollection } = APP_CODE_PREFIX_CAMELFirebaseServerActionsContext;
  const storageFileDocumentAccessor = storageFileCollection.documentAccessor();

  const createStorageFileDocumentPair = createStorageFileDocumentPairFactory({
    defaultCreationType: StorageFileCreationType.INIT_FROM_UPLOAD
  });

  // MARK: User Upload Files
  const matchUserUploadsFolderMatcherPath: SlashPathPathMatcherPath = [ALL_USER_UPLOADS_FOLDER_PATH, true]; // matches to /uploads/u/{userId}
  const determineUserFromUploadsFolderPath = determineUserByUserUploadsFolderWrapperFunction({ allowSubPaths: true });

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

      let newImageBytes: Buffer;

      try {
        // create a new Sharp instance
        const sharpInstance = sharp(fileBytes);

        // resize the image and get the new bytes
        newImageBytes = await sharpInstance
          .resize({
            width: USER_AVATAR_IMAGE_WIDTH,
            height: USER_AVATAR_IMAGE_HEIGHT,
            fit: 'cover'
          })
          .jpeg({
            quality: 80
          })
          .toBuffer();
      } catch (e) {
        // if sharp fails to initialize, then the uploaded file is probably unsupported.
        return storageFileInitializeFromUploadServiceInitializerResultPermanentFailure(e);
      }

      const fileMimeType = mimeTypeForImageFileExtension('jpeg');

      // create the new file at /avatar/u/{userId}/avatar
      const newPath = makeUserAvatarFileStoragePath(userId);
      const newFile = storageService.file(newPath);

      await newFile.upload(newImageBytes, { contentType: fileMimeType });

      // create the StorageFileDocument and reference the new file
      const createStorageFileResult = await createStorageFileDocumentPair({
        accessor: storageFileDocumentAccessor,
        file: newFile,
        storagePathRef: newFile,
        user: userId,
        purpose: USER_AVATAR_PURPOSE,
        shouldBeProcessed: false // no processing
      });

      // TODO: Connect to profile, if applicable

      return {
        createStorageFileResult,
        flagPreviousForDelete: true
      };
    },
    determiner: userTestAvatarDeterminer
  };

  const userFileInitializers = [userTestAvatarInitializer];

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
