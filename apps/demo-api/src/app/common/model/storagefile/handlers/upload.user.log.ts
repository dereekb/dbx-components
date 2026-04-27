import { ALL_USER_UPLOADS_FOLDER_PATH, createStorageFileDocumentPairFactory, determineByFilePath, determineUserByUserUploadsFolderWrapperFunction, type FirebaseAuthUserId, StorageFileCreationType } from '@dereekb/firebase';
import { type StorageFileInitializeFromUploadServiceInitializer, type StorageFileInitializeFromUploadServiceInitializerInput, type StorageFileInitializeFromUploadServiceInitializerResult } from '@dereekb/firebase-server/model';
import { type SlashPathPathMatcherPath } from '@dereekb/util';
import { USER_LOG_FILE_PURPOSE, USER_LOG_FILE_UPLOADED_FILE_TYPE_IDENTIFIER, USER_LOG_FILE_UPLOADS_FOLDER_NAME, userLogFileGroupIds, userLogFileStoragePath } from 'demo-firebase';
import { type DemoFirebaseServerActionsContext } from '../../../firebase/action.context';

/**
 * Builds the upload initializer for `USER_LOG_FILE_UPLOADED_FILE_TYPE_IDENTIFIER`.
 * Lives under `storagefile/handlers/` rather than inline in
 * `storagefile.upload.service.ts` so the demo exercises the
 * multi-file split convention used by larger downstream apps. The
 * `dbx_validate_storagefile_folder` and
 * `dbx_validate_app_storagefiles` tools verify the wiring.
 *
 * Behaviour: the upload is copied from `/uploads/u/{userId}/log/{name}`
 * to `/log/u/{userId}/{name}` and a StorageFile document is created.
 * No processing.
 *
 * @param context - server actions context providing the storage-file collection accessor.
 * @returns the initializer registered into `StorageFileInitializeFromUploadService`.
 */
export function makeUserLogFileUploadInitializer(context: DemoFirebaseServerActionsContext): StorageFileInitializeFromUploadServiceInitializer {
  const { storageFileCollection } = context;
  const storageFileDocumentAccessor = storageFileCollection.documentAccessor();
  const createStorageFileDocumentPair = createStorageFileDocumentPairFactory({
    defaultCreationType: StorageFileCreationType.INIT_FROM_UPLOAD
  });

  const matchUserUploadsFolderMatcherPath: SlashPathPathMatcherPath = [ALL_USER_UPLOADS_FOLDER_PATH, true];
  const determineUserFromUploadsFolderPath = determineUserByUserUploadsFolderWrapperFunction({ allowSubPaths: true });

  const determiner = determineUserFromUploadsFolderPath(
    determineByFilePath({
      fileType: USER_LOG_FILE_UPLOADED_FILE_TYPE_IDENTIFIER,
      match: {
        targetPath: [...matchUserUploadsFolderMatcherPath, USER_LOG_FILE_UPLOADS_FOLDER_NAME, true]
      }
    })
  );

  const userLogFileInitializer: StorageFileInitializeFromUploadServiceInitializer = {
    type: USER_LOG_FILE_UPLOADED_FILE_TYPE_IDENTIFIER,
    initialize: async function (input: StorageFileInitializeFromUploadServiceInitializerInput): Promise<StorageFileInitializeFromUploadServiceInitializerResult> {
      const { file } = input.fileDetailsAccessor.getPathDetails();
      const userId = input.determinerResult.user as FirebaseAuthUserId;

      const newPath = userLogFileStoragePath(userId, file as string);
      const createdFile = await input.fileDetailsAccessor.copy(newPath);

      const { storageFileDocument } = await createStorageFileDocumentPair({
        accessor: storageFileDocumentAccessor,
        file: createdFile,
        user: userId,
        purpose: USER_LOG_FILE_PURPOSE,
        storageFileGroupIds: userLogFileGroupIds(userId),
        shouldBeProcessed: false
      });

      const result: StorageFileInitializeFromUploadServiceInitializerResult = { createdFile, storageFileDocument };
      return result;
    },
    determiner
  };

  return userLogFileInitializer;
}
