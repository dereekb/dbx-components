import { ALL_USER_UPLOADS_FOLDER_PATH, createStorageFileDocumentPairFactory, determineByFilePath, determineUserByUserUploadsFolderWrapperFunction, type FirebaseAuthUserId, StorageFileCreationType } from '@dereekb/firebase';
import { type StorageFileInitializeFromUploadServiceInitializer, type StorageFileInitializeFromUploadServiceInitializerInput, type StorageFileInitializeFromUploadServiceInitializerResult, storageFileInitializeFromUploadServiceInitializerResultPermanentFailure } from '@dereekb/firebase-server/model';
import { type SlashPathPathMatcherPath } from '@dereekb/util';
import { makeUserResumeFileStoragePath, type ProfileResume, ProfileResumeState, USER_RESUME_FILE_PURPOSE, USER_RESUME_FILE_UPLOADED_FILE_TYPE_IDENTIFIER, USER_RESUME_FILE_UPLOADS_FILE_NAME, userResumeFileGroupIds } from 'demo-firebase';
import { type DemoFirebaseServerActionsContext } from '../../../firebase/action.context';

/**
 * The four bytes every PDF starts with.
 */
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

/**
 * Builds the upload initializer for `USER_RESUME_FILE_UPLOADED_FILE_TYPE_IDENTIFIER`.
 *
 * Behaviour: the upload is validated as a real PDF, copied from
 * `/uploads/u/{userId}/resume.pdf` to `/u/{userId}/resume/{timestamp}.pdf`, and
 * a StorageFile document is created with `shouldBeProcessed: true` — which is
 * what schedules the `send` / `retrieve` subtask pair that asks a model
 * whether the document actually is a resume. The user's Profile is pointed at
 * the new StorageFile and any previous resume is flagged for deletion — which
 * is why the destination is timestamped rather than fixed like the upload slot.
 *
 * The magic-byte check is not redundant with the upload policy: the policy's
 * mime type is the one the CLIENT declared on the signed upload url, so it
 * constrains what the storage rules will accept, not what the bytes are.
 *
 * @param context - Server actions context providing the storage-file and profile collection accessors.
 * @returns The initializer registered into `StorageFileInitializeFromUploadService`.
 */
export function makeUserResumeFileUploadInitializer(context: DemoFirebaseServerActionsContext): StorageFileInitializeFromUploadServiceInitializer {
  const { storageFileCollection, profileCollection } = context;
  const storageFileDocumentAccessor = storageFileCollection.documentAccessor();
  const createStorageFileDocumentPair = createStorageFileDocumentPairFactory({
    defaultCreationType: StorageFileCreationType.INIT_FROM_UPLOAD
  });

  const matchUserUploadsFolderMatcherPath: SlashPathPathMatcherPath = [ALL_USER_UPLOADS_FOLDER_PATH, true];
  const determineUserFromUploadsFolderPath = determineUserByUserUploadsFolderWrapperFunction({ allowSubPaths: true });

  const determiner = determineUserFromUploadsFolderPath(
    determineByFilePath({
      fileType: USER_RESUME_FILE_UPLOADED_FILE_TYPE_IDENTIFIER,
      match: {
        targetPath: [...matchUserUploadsFolderMatcherPath, USER_RESUME_FILE_UPLOADS_FILE_NAME] // matches to /uploads/u/{userId}/resume.pdf
      }
    })
  );

  const userResumeFileInitializer: StorageFileInitializeFromUploadServiceInitializer = {
    type: USER_RESUME_FILE_UPLOADED_FILE_TYPE_IDENTIFIER,
    initialize: async function (input: StorageFileInitializeFromUploadServiceInitializerInput): Promise<StorageFileInitializeFromUploadServiceInitializerResult> {
      const userId = input.determinerResult.user as FirebaseAuthUserId;

      const fileBytes = await input.fileDetailsAccessor.loadFileBytes();
      let result: StorageFileInitializeFromUploadServiceInitializerResult;

      if (isPdfContent(fileBytes)) {
        const newPath = makeUserResumeFileStoragePath(userId);
        const createdFile = await input.fileDetailsAccessor.copy(newPath);

        const createStorageFileResult = await createStorageFileDocumentPair({
          accessor: storageFileDocumentAccessor,
          file: createdFile,
          user: userId,
          purpose: USER_RESUME_FILE_PURPOSE,
          storageFileGroupIds: userResumeFileGroupIds(userId),
          shouldBeProcessed: true
        });

        const profileDocument = profileCollection.documentAccessor().loadDocumentForId(userId);

        if (await profileDocument.exists()) {
          // The whole object is replaced rather than merged, so the incoming resume starts with no
          // verdict instead of inheriting the previous file's.
          const resume: ProfileResume = {
            state: ProfileResumeState.CHECKING,
            storageFile: createStorageFileResult.storageFileDocument.key,
            uploadedAt: new Date()
          };

          await profileDocument.update({ resume });
        }

        result = { createStorageFileResult, flagPreviousForDelete: true };
      } else {
        // Permanent: re-reading the same bytes will never make them a PDF.
        result = storageFileInitializeFromUploadServiceInitializerResultPermanentFailure(new Error('The uploaded resume is not a PDF.'));
      }

      return result;
    },
    determiner
  };

  return userResumeFileInitializer;
}

/**
 * Whether the bytes begin with the PDF magic number.
 *
 * @param bytes - The uploaded content.
 * @returns True when the content is a PDF.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isPdfContent(bytes: Uint8Array): boolean {
  return bytes.length >= PDF_MAGIC_BYTES.length && PDF_MAGIC_BYTES.every((byte, i) => bytes[i] === byte);
}
