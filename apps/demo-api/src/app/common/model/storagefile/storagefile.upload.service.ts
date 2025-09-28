import { StorageFileInitializeFromUploadService, StorageFileInitializeFromUploadServiceConfig, StorageFileInitializeFromUploadServiceInitializer, StorageFileInitializeFromUploadServiceInitializerInput, StorageFileInitializeFromUploadServiceInitializerResult, storageFileInitializeFromUploadService } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER } from 'demo-firebase';
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
        targetPath: [...matchUserUploadsFolderMatcherPath, 'test.txt'] // test.txt
      }
    })
  );

  const userTestFileInitializer: StorageFileInitializeFromUploadServiceInitializer = {
    type: USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER,
    initialize: function (input: StorageFileInitializeFromUploadServiceInitializerInput): Promise<StorageFileInitializeFromUploadServiceInitializerResult> {
      // TODO: Perform initialization...

      return null as any;
    },
    determiner: userTestFileDeterminer
  };

  const userTestAvatarDeterminer = determineUserFromUploadsFolderPath(
    determineByFilePath({
      fileType: USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER,
      match: {
        targetPath: [...matchUserUploadsFolderMatcherPath, 'avatar'] // avatar.png
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

  // MARK: Configuration
  const storageFileUploadServiceConfig: StorageFileInitializeFromUploadServiceConfig = {
    validate: true,
    determiner: [],
    initializer: [...userFileInitializers]
  };

  return storageFileInitializeFromUploadService(storageFileUploadServiceConfig);
}
