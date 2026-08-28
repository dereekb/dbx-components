import {
  ALL_USER_UPLOADS_FOLDER_PATH,
  type AppFormSpaceTypeConfigService,
  assertFormSpaceUploadAllowed,
  createStorageFileDocumentPairFactory,
  determineByFilePath,
  determineUserByUserUploadsFolderWrapperFunction,
  type FirebaseAuthUserId,
  FORM_SPACE_PURPOSE,
  FORM_SPACE_UPLOADED_FILE_TYPE_IDENTIFIER,
  FORM_SPACE_UPLOADS_FOLDER_NAME,
  type FirebaseStorageAccessorFile,
  type FormSpace,
  formSpaceFileStoragePath,
  type FormSpaceFileSlot,
  formSpaceStorageFileGroupId,
  isFormSpaceEditable,
  parseFormSpaceUploadPath,
  StorageFileCreationType
} from '@dereekb/firebase';
import { type ContentTypeMimeType, type Maybe, type SlashPathPathMatcherPath } from '@dereekb/util';
import { type StorageFileInitializeFromUploadServiceInitializer, type StorageFileInitializeFromUploadServiceInitializerInput, type StorageFileInitializeFromUploadServiceInitializerResult, storageFileInitializeFromUploadServiceInitializerResultPermanentFailure } from '../storagefile/storagefile.upload.service.initializer';
import { type FormSpaceServerActionsContext } from './formspace.action.server';
import { formSpaceNotEditableError, formSpaceNotFoundError, formSpaceUploadNotAllowedError, formSpaceUploadUserMismatchError } from './formspace.error';

/**
 * @module formspace.upload.initializer
 *
 * The AUTHORITATIVE upload gate for FormSpace files.
 *
 * `storage.rules` can enforce the outer size and content-type bound and can keep the write inside the
 * uploader's own namespace, but it cannot read Firestore — so it cannot know whether the FormSpace exists,
 * whether it is still a draft, whether this slot belongs to its type, or whether the space has already
 * used up its upload budget. All of that is decided HERE, after the bytes have landed but before any
 * StorageFile document exists, and a rejection returns a PERMANENT failure so the stray upload is deleted
 * rather than retried forever.
 */

/**
 * Creates the {@link StorageFileInitializeFromUploadServiceInitializer} entries for FormSpace uploads.
 *
 * ONE initializer covers every form type: the per-type rules come from the {@link FormSpaceTypeConfig}
 * registry keyed off the loaded space, not from the initializer's own registration.
 *
 * @param context - The FormSpace server actions context.
 * @returns The initializers to spread into the app's upload service config.
 *
 * @example
 * ```ts
 * initializer: [...appInitializers, ...formSpaceStorageFileUploadInitializers(context)]
 * ```
 */
export function formSpaceStorageFileUploadInitializers(context: FormSpaceServerActionsContext): StorageFileInitializeFromUploadServiceInitializer[] {
  const { firestoreContext, formSpaceCollection, storageFileCollection, appFormSpaceTypeConfigService } = context;

  const createStorageFileDocumentPair = createStorageFileDocumentPairFactory({
    defaultCreationType: StorageFileCreationType.INIT_FROM_UPLOAD
  });

  const matchUserUploadsFolderMatcherPath: SlashPathPathMatcherPath = [ALL_USER_UPLOADS_FOLDER_PATH, true];
  const determineUserFromUploadsFolderPath = determineUserByUserUploadsFolderWrapperFunction({ allowSubPaths: true });

  const determiner = determineUserFromUploadsFolderPath(
    determineByFilePath({
      fileType: FORM_SPACE_UPLOADED_FILE_TYPE_IDENTIFIER,
      match: {
        // /uploads/u/{uid}/formSpace/{formSpaceId}/{slot}/{filename}
        targetPath: [...(matchUserUploadsFolderMatcherPath as unknown[]), FORM_SPACE_UPLOADS_FOLDER_NAME, true, true, true] as SlashPathPathMatcherPath
      }
    })
  );

  const initializer: StorageFileInitializeFromUploadServiceInitializer = {
    type: FORM_SPACE_UPLOADED_FILE_TYPE_IDENTIFIER,
    determiner,
    initialize: async function (input: StorageFileInitializeFromUploadServiceInitializerInput): Promise<StorageFileInitializeFromUploadServiceInitializerResult> {
      const { fileDetailsAccessor } = input;
      const uploaderId = input.determinerResult.user as FirebaseAuthUserId;
      const parsed = parseFormSpaceUploadPath(fileDetailsAccessor.input.pathString);
      let result: StorageFileInitializeFromUploadServiceInitializerResult;

      if (parsed == null) {
        result = storageFileInitializeFromUploadServiceInitializerResultPermanentFailure(formSpaceNotFoundError());
      } else {
        const { formSpaceId, slot, filename } = parsed;
        const formSpaceDocument = formSpaceCollection.documentAccessor().loadDocumentForId(formSpaceId);
        const metadata = await fileDetailsAccessor.loadFileMetadata();
        const mimeType = (metadata.contentType ?? '') as ContentTypeMimeType;
        const sizeBytes = Number(metadata.size ?? 0);

        let createdFile: Maybe<FirebaseStorageAccessorFile>;

        try {
          // PRE-CHECK before copying. The authoritative check is the one inside the transaction below, but
          // running it first means the overwhelming majority of rejections never copy any bytes at all.
          const formSpace = await formSpaceDocument.snapshotData();
          _assertFormSpaceAcceptsUpload({ formSpace, uploaderId, slot, mimeType, sizeBytes, appFormSpaceTypeConfigService });

          // move the accepted file out of the transient uploads folder: the uploads sweep deletes the
          // source once initialization succeeds, so the StorageFile must point somewhere durable
          createdFile = await fileDetailsAccessor.copy(formSpaceFileStoragePath(formSpaceId, slot, filename));

          // ONE transaction so the accept decision and the counter increment cannot interleave with a
          // second concurrent upload: reading `uc`, deciding, then writing `uc + 1` separately is exactly
          // how a maxUploads cap gets exceeded under load.
          const { createStorageFileResult, user } = await firestoreContext.runTransaction(async (transaction) => {
            const documentInTransaction = formSpaceCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(formSpaceDocument);
            const formSpaceInTransaction = await documentInTransaction.snapshotData();

            _assertFormSpaceAcceptsUpload({ formSpace: formSpaceInTransaction, uploaderId, slot, mimeType, sizeBytes, appFormSpaceTypeConfigService });

            const current = formSpaceInTransaction as FormSpace;

            const pairResult = await createStorageFileDocumentPair({
              transaction,
              accessor: storageFileCollection.documentAccessorForTransaction(transaction),
              file: createdFile as FirebaseStorageAccessorFile,
              user: current.u,
              uploadedBy: uploaderId,
              ownershipKey: current.o,
              purpose: FORM_SPACE_PURPOSE,
              purposeSubgroup: slot,
              storageFileGroupIds: [formSpaceStorageFileGroupId(formSpaceDocument.key)],
              shouldBeProcessed: false // a form attachment is stored, not transformed; a type that needs work does it in its submission handler
            });

            const uploadCountUpdate: Partial<FormSpace> = {
              uc: current.uc + 1,
              uat: new Date()
            };

            await documentInTransaction.update(uploadCountUpdate);

            return { createStorageFileResult: pairResult, user: current.u };
          });

          result = {
            createStorageFileResult,
            // supersede whatever was in this slot before: a slot is a logical position, not a file
            flagPreviousForDelete: {
              user,
              purpose: FORM_SPACE_PURPOSE,
              purposeSubgroup: slot
            }
          };
        } catch (e) {
          // a rejected upload is PERMANENTLY rejected — neither the space's state nor the type's rules will
          // change in the uploader's favour on a retry, so retrying only leaves the stray file in place
          result = storageFileInitializeFromUploadServiceInitializerResultPermanentFailure(e, createdFile);
        }
      }

      return result;
    }
  };

  return [initializer];
}

/**
 * Input for {@link _assertFormSpaceAcceptsUpload}.
 */
interface AssertFormSpaceAcceptsUploadInput {
  readonly formSpace: Maybe<FormSpace>;
  readonly uploaderId: FirebaseAuthUserId;
  readonly slot: FormSpaceFileSlot;
  readonly mimeType: ContentTypeMimeType;
  readonly sizeBytes: number;
  readonly appFormSpaceTypeConfigService: AppFormSpaceTypeConfigService;
}

/**
 * Throws unless this uploader may put this file in this slot of this FormSpace.
 *
 * Run TWICE — once before copying bytes, once inside the transaction that increments `uc`. The first call
 * is an optimization; only the second is a control.
 *
 * @param input - The loaded space, the uploader, and the candidate file.
 * @throws {HttpsError} When the space is missing, owned by someone else, no longer editable, or the file
 *   violates the type's rules.
 */
function _assertFormSpaceAcceptsUpload(input: AssertFormSpaceAcceptsUploadInput): void {
  const { formSpace, uploaderId, slot, mimeType, sizeBytes, appFormSpaceTypeConfigService } = input;

  if (formSpace == null) {
    throw formSpaceNotFoundError();
  }

  if (formSpace.u !== uploaderId) {
    throw formSpaceUploadUserMismatchError();
  }

  if (!isFormSpaceEditable({ formSpace })) {
    throw formSpaceNotEditableError();
  }

  const config = appFormSpaceTypeConfigService.configForFormSpaceType(formSpace.t);
  const allowed = assertFormSpaceUploadAllowed({ formSpace, config, slot, mimeType, sizeBytes });

  if (!allowed.allowed) {
    throw formSpaceUploadNotAllowedError(allowed.reason as NonNullable<typeof allowed.reason>);
  }
}
