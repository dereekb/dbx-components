import { StorageFileInitializeFromUploadService, StorageFileInitializeFromUploadServiceConfig, StorageFileInitializeFromUploadServiceInitializer, StorageFileInitializeFromUploadServiceInitializerInput, StorageFileInitializeFromUploadServiceInitializerResult, createStorageFileFactory, storageFileInitializeFromUploadService, storageFileInitializeFromUploadServiceInitializerResultPermanentFailure } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { makeUserAvatarFileStoragePath, USER_AVATAR_IMAGE_HEIGHT, USER_AVATAR_IMAGE_WIDTH, USER_AVATAR_PURPOSE, USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_AVATAR_UPLOADS_FILE_NAME, USER_TEST_FILE_PURPOSE, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADS_FOLDER_NAME, userTestFileStoragePath } from 'demo-firebase';
import { ALL_USER_UPLOADS_FOLDER_PATH, createStorageFileDocumentPair, createStorageFileDocumentPairFactory, determineByFilePath, determineUserByFolderWrapperFunction, determineUserByUserUploadsFolderWrapperFunction, FirebaseAuthUserId, StorageFileCreationType } from '@dereekb/firebase';
import { mimetypeForImageType, SlashPathPathMatcherPath } from '@dereekb/util';
import * as sharp from 'sharp';

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
      const movedFile = await input.fileDetailsAccessor.copy(newPath);

      // create the StorageFileDocument and reference the new file
      const { storageFileDocument } = await createStorageFileDocumentPair({
        accessor: storageFileDocumentAccessor,
        file: movedFile,
        storagePathRef: movedFile,
        user: userId,
        purpose: USER_TEST_FILE_PURPOSE,
        shouldBeProcessed: true
      });

      return { storageFileDocument };
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

      const fileMimeType = mimetypeForImageType('jpeg');

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

      const profileDocument = profileCollection.documentAccessor().loadDocumentForId(userId);
      const profileExists = await profileDocument.exists();

      if (profileExists) {
        const avatarDownloadUrl = await newFile.getDownloadUrl();

        await profileDocument.update({
          avatar: avatarDownloadUrl
        });
      }

      return {
        createStorageFileResult,
        flagPreviousForDelete: true
      };
    },
    determiner: userTestAvatarDeterminer
  };

  const userFileInitializers = [userTestFileInitializer, userTestAvatarInitializer];

  // MARK: System Upload Files

  // TODO: ...

  const systemFileInitializers: StorageFileInitializeFromUploadServiceInitializer[] = [];

  // MARK: Configuration
  const storageFileUploadServiceConfig: StorageFileInitializeFromUploadServiceConfig = {
    validate: true,
    initializer: [...userFileInitializers, ...systemFileInitializers],
    storageFileCollection
  };

  return storageFileInitializeFromUploadService(storageFileUploadServiceConfig);
}
