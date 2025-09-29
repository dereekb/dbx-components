import { StorageFileInitializeFromUploadService, StorageFileInitializeFromUploadServiceConfig, StorageFileInitializeFromUploadServiceInitializer, StorageFileInitializeFromUploadServiceInitializerInput, StorageFileInitializeFromUploadServiceInitializerResult, storageFileInitializeFromUploadService } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_AVATAR_UPLOADS_FILE_NAME, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADS_FOLDER_NAME } from 'demo-firebase';
import { ALL_USER_UPLOADS_FOLDER_PATH, determineByFilePath, determineUserByFolderWrapperFunction } from '@dereekb/firebase';
import { SlashPathPathMatcherPath } from '@dereekb/util';

export function demoStorageFileUploadServiceFactory(demoFirebaseServerActionsContext: DemoFirebaseServerActionsContext): StorageFileInitializeFromUploadService {
  // MARK: User Upload Files
  const matchUserUploadsFolderMatcherPath: SlashPathPathMatcherPath = [ALL_USER_UPLOADS_FOLDER_PATH, true]; // matches to /uploads/u/{userId}
  const determineUserFromUploadsFolderPath = determineUserByFolderWrapperFunction({ rootFolder: ALL_USER_UPLOADS_FOLDER_PATH });

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
    initialize: function (input: StorageFileInitializeFromUploadServiceInitializerInput): Promise<StorageFileInitializeFromUploadServiceInitializerResult> {
      const details = input.fileDetailsAccessor.details;

      // move the file to /test/u/{userId}/{filename}

      return null as any;
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
    initialize: function (input: StorageFileInitializeFromUploadServiceInitializerInput): Promise<StorageFileInitializeFromUploadServiceInitializerResult> {
      // TODO: Perform initialization...

      return null as any;
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
    initializer: [...userFileInitializers, ...systemFileInitializers]
  };

  return storageFileInitializeFromUploadService(storageFileUploadServiceConfig);
}
