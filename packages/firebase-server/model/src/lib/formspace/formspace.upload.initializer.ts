import {
  ALL_USER_UPLOADS_FOLDER_PATH,
  type AppFormSpaceTypeConfigService,
  assertFormSpaceUploadAllowed,
  createStorageFileDocumentPairFactory,
  determineByFilePath,
  determineUserByUserUploadsFolderWrapperFunction,
  type FirebaseAuthUserId,
  FORM_SPACE_NOT_EDITABLE_ERROR_CODE,
  FORM_SPACE_NOT_FOUND_ERROR_CODE,
  FORM_SPACE_PURPOSE,
  FORM_SPACE_UPLOAD_NOT_ALLOWED_ERROR_CODE,
  FORM_SPACE_UPLOAD_USER_MISMATCH_ERROR_CODE,
  FORM_SPACE_UPLOADED_FILE_TYPE_IDENTIFIER,
  FORM_SPACE_UPLOADS_FOLDER_NAME,
  type FirebaseStorageAccessorFile,
  type FormSpace,
  type FormSpaceFile,
  formSpaceFileSlotConfig,
  formSpaceFileStoragePath,
  type FormSpaceFileSlot,
  FormSpaceFileValidationState,
  type FormSpaceId,
  formSpaceFilesInSlot,
  formSpaceSlotMaxFiles,
  formSpaceStorageFileGroupId,
  formSpaceUploadFileNameDetails,
  isFormSpaceEditable,
  parseFormSpaceUploadPath,
  StorageFileCreationType
} from '@dereekb/firebase';
import { type ContentTypeMimeType, type Maybe, type PromiseOrValue, type SlashPathPathMatcherPath } from '@dereekb/util';
import {
  type StorageFileInitializeFromUploadServiceInitializer,
  type StorageFileInitializeFromUploadServiceInitializerInput,
  type StorageFileInitializeFromUploadServiceInitializerResult,
  storageFileInitializeFromUploadServiceInitializerResultPermanentFailure,
  storageFileInitializeFromUploadServiceInitializerResultTransientFailure
} from '../storagefile/storagefile.upload.service.initializer';
import { markStorageFileForDeleteTemplate } from '../storagefile/storagefile.util';
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
 * Input handed to a {@link FormSpaceUploadAuthorizationDelegate}.
 */
export interface FormSpaceUploadAuthorizationDelegateInput {
  /**
   * The space the bytes landed against, as loaded before any transaction.
   */
  readonly formSpace: FormSpace;
  /**
   * The space's id, as parsed from the upload path.
   */
  readonly formSpaceId: FormSpaceId;
  /**
   * The uid whose uploads folder the file landed in. Never equal to `formSpace.u` here.
   */
  readonly uploaderId: FirebaseAuthUserId;
  /**
   * The slot being filled.
   */
  readonly slot: FormSpaceFileSlot;
}

/**
 * Decides whether an uploader who is NOT the space's own `u` may nonetheless upload into it.
 *
 * The DEFAULT FormSpace is single-user: `u` is set at creation, never changes, and is the only party that
 * may upload into it. A SHARED space — one whose `o` names a model many users can reach — needs a second
 * answer, and that answer is app policy (typically a read against some other collection), so it cannot live
 * in this package.
 *
 * Consulted ONCE, BEFORE the claim transaction, and ONLY when `formSpace.u !== uploaderId`. Two
 * consequences worth stating:
 *
 * - An owner's own upload never reaches the delegate, so a broken delegate cannot regress the single-user
 *   path every existing FormSpaceType uses.
 * - Resolving it outside the transactions is safe because the decision reads only `u`, `o` and `t`, none of
 *   which ever change after creation. Inside `runTransaction` it would be re-run on every contention retry
 *   and would still read outside the transaction's snapshot, so the transaction would buy nothing.
 *
 * Returning `false` is a DECISION: it becomes {@link formSpaceUploadUserMismatchError}, which
 * {@link FORM_SPACE_UPLOAD_REFUSAL_ERROR_CODES} already classifies as a permanent refusal, so the stray
 * upload is discarded rather than retried forever. THROWING is infrastructure: it falls through to the
 * transient branch and the source is left for the next sweep.
 */
export type FormSpaceUploadAuthorizationDelegate = (input: FormSpaceUploadAuthorizationDelegateInput) => PromiseOrValue<boolean>;

/**
 * Configuration for {@link formSpaceStorageFileUploadInitializers}.
 *
 * Extends the actions context rather than wrapping it, so an existing call site that passes the context
 * object directly keeps compiling unchanged.
 */
export interface FormSpaceStorageFileUploadInitializersConfig extends FormSpaceServerActionsContext {
  /**
   * Optional policy for an upload by someone other than the space's `u`.
   *
   * Absent by default, which is the original behaviour exactly: any uploader that is not `u` is refused.
   */
  readonly uploadAuthorizationDelegate?: Maybe<FormSpaceUploadAuthorizationDelegate>;
}

/**
 * Creates the {@link StorageFileInitializeFromUploadServiceInitializer} entries for FormSpace uploads.
 *
 * ONE initializer covers every form type: the per-type rules come from the {@link FormSpaceTypeConfig}
 * registry keyed off the loaded space, not from the initializer's own registration.
 *
 * @param config - The FormSpace server actions context, plus the optional shared-space upload policy.
 * @returns The initializers to spread into the app's upload service config.
 *
 * @example
 * ```ts
 * initializer: [...appInitializers, ...formSpaceStorageFileUploadInitializers(context)]
 * ```
 */
export function formSpaceStorageFileUploadInitializers(config: FormSpaceStorageFileUploadInitializersConfig): StorageFileInitializeFromUploadServiceInitializer[] {
  const { firestoreContext, formSpaceCollection, storageFileCollection, appFormSpaceTypeConfigService, uploadAuthorizationDelegate } = config;

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

        const nameDetails = formSpaceUploadFileNameDetails({ filename, mimeType });

        let createdFile: Maybe<FirebaseStorageAccessorFile>;

        try {
          // PHASE 0 — AUTHORIZE. One read, outside every transaction, and only for an uploader that is not
          // the space's own `u`. See FormSpaceUploadAuthorizationDelegate for why once-and-outside is both
          // safe and cheaper than re-deciding inside a retried transaction callback.
          let uploaderAuthorizedByDelegate = false;

          if (uploadAuthorizationDelegate != null) {
            const currentFormSpace = await formSpaceDocument.snapshotData();

            // a missing space is left to the claim transaction, which raises the canonical not-found refusal
            if (currentFormSpace != null && currentFormSpace.u !== uploaderId) {
              uploaderAuthorizedByDelegate = await uploadAuthorizationDelegate({ formSpace: currentFormSpace, formSpaceId, uploaderId, slot });
            }
          }

          // PHASE 1 — CLAIM. A short transaction whose only write is the index bump.
          //
          // It must BE a transaction: read-then-write on `fi` is exactly the race that would hand two
          // concurrent uploads one index, and one index means one object for two StorageFiles. A retry is
          // harmless — it re-reads and re-writes, and only one commit wins, so exactly one index is issued.
          //
          // It deliberately does NOT touch `uc`. `uc` is the upload BUDGET, and a claim is not an accept.
          const fileIndex = await firestoreContext.runTransaction(async (transaction) => {
            const documentInTransaction = formSpaceCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(formSpaceDocument);
            const formSpaceInTransaction = await documentInTransaction.snapshotData();

            // refusing HERE is what keeps the overwhelming majority of rejections from burning an index or
            // copying any bytes. It is an optimization; the control is the identical check in phase 3.
            _assertFormSpaceAcceptsUpload({ formSpace: formSpaceInTransaction, uploaderId, uploaderAuthorizedByDelegate, slot, mimeType, sizeBytes, appFormSpaceTypeConfigService });

            const claimed = (formSpaceInTransaction as FormSpace).fi;

            await documentInTransaction.update({ fi: claimed + 1 });

            return claimed;
          });

          // PHASE 2 — COPY, out of the transient uploads folder and OUTSIDE any transaction. The uploads
          // sweep deletes the source once initialization succeeds, so the StorageFile must point somewhere
          // durable; and `runTransaction` retries its callback on contention, so a copy inside one would
          // leave an orphaned object at every abandoned attempt.
          createdFile = await fileDetailsAccessor.copy(formSpaceFileStoragePath({ formSpaceId, slot, index: fileIndex, extension: nameDetails.extension }));

          // PHASE 3 — REGISTER. ONE transaction so the accept decision, the counter increment, the `f`
          // rewrite and the supersede flag cannot interleave with a second concurrent upload: reading `uc`,
          // deciding, then writing `uc + 1` separately is exactly how a maxUploads cap gets exceeded under
          // load. This is why `uc` moves here and not in phase 1.
          const { createStorageFileResult } = await firestoreContext.runTransaction(async (transaction) => {
            const documentInTransaction = formSpaceCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(formSpaceDocument);
            const formSpaceInTransaction = await documentInTransaction.snapshotData();

            _assertFormSpaceAcceptsUpload({ formSpace: formSpaceInTransaction, uploaderId, uploaderAuthorizedByDelegate, slot, mimeType, sizeBytes, appFormSpaceTypeConfigService });

            const current = formSpaceInTransaction as FormSpace;
            const config = appFormSpaceTypeConfigService.configForFormSpaceType(current.t);
            const slotConfig = formSpaceFileSlotConfig(config, slot);
            const validationRequired = slotConfig?.validationRequired === true;

            // a POSITION slot (the default) supersedes what it held; a FOLDER accumulates. The full-folder
            // case never reaches here — assertFormSpaceUploadAllowed refuses it above.
            const superseded = formSpaceSlotMaxFiles(slotConfig) === 1 ? formSpaceFilesInSlot(current, slot) : [];

            const pairResult = await createStorageFileDocumentPair({
              transaction,
              accessor: storageFileCollection.documentAccessorForTransaction(transaction),
              file: createdFile as FirebaseStorageAccessorFile,
              user: current.u,
              uploadedBy: uploaderId,
              ownershipKey: current.o,
              purpose: FORM_SPACE_PURPOSE,
              purposeSubgroup: slot,
              // UNTYPED by contract — the zip builder merges it with the object path's extension. The
              // destination leaf is `{index}.{ext}`, so this is the only thing carrying the name the user
              // actually uploaded; without it every download and zip entry would be called `0.pdf`.
              displayName: nameDetails.displayName,
              storageFileGroupIds: [formSpaceStorageFileGroupId(formSpaceDocument.key)],
              // EVERY accepted file is processed, not only a validated one: the processing task's first
              // step reconciles the file onto its FormSpace, which is what makes `f` self-healing for a
              // file that reached storage by any path other than this initializer. A slot with no validator
              // simply finds nothing to run after that and completes.
              shouldBeProcessed: true
            });

            const supersededIds = new Set(superseded.map((x) => x.sf));

            const newFile: FormSpaceFile = {
              sl: slot,
              sf: pairResult.storageFileDocument.id,
              // the UPLOADER, which on a shared space is not the space's `u`. It is what an 'uploader'
              // FormSpaceFileAccess reads to decide whose file this is.
              ub: uploaderId,
              n: nameDetails.fileName,
              v: validationRequired ? FormSpaceFileValidationState.PENDING : FormSpaceFileValidationState.NONE,
              at: new Date()
            };

            const uploadCountUpdate: Partial<FormSpace> = {
              uc: current.uc + 1,
              f: [...current.f.filter((x) => !supersededIds.has(x.sf)), newFile],
              uat: new Date()
            };

            await documentInTransaction.update(uploadCountUpdate);

            // flag the EXACT files this slot just superseded. The framework's `flagPreviousForDelete` would
            // query by (purpose, user, purposeSubgroup) instead, which carries no FormSpace constraint — a
            // user holding two drafts that both declare this slot would have the other space's file flagged.
            const storageFileAccessorInTransaction = storageFileCollection.documentAccessorForTransaction(transaction);

            await Promise.all(superseded.map((x) => storageFileAccessorInTransaction.loadDocumentForId(x.sf).update(markStorageFileForDeleteTemplate())));

            return { createStorageFileResult: pairResult };
          });

          result = { createStorageFileResult };
        } catch (e) {
          // A REFUSED upload is permanently refused — neither the space's state nor the type's rules will
          // change in the uploader's favour on a retry, so retrying only leaves the stray file in place.
          //
          // Anything else reaching here is infrastructure, and now that the work is split across two
          // transactions and a copy there is real surface for it. Discarding the source for a contended
          // transaction would destroy an upload the very next sweep would have accepted, so it is reported
          // as transient and the source is left alone. The copied object is deleted either way.
          result = _isFormSpaceUploadRefusal(e) ? storageFileInitializeFromUploadServiceInitializerResultPermanentFailure(e, createdFile) : storageFileInitializeFromUploadServiceInitializerResultTransientFailure(e, createdFile);
        }
      }

      return result;
    }
  };

  return [initializer];
}

/**
 * Every error code {@link _assertFormSpaceAcceptsUpload} raises.
 *
 * Membership is what separates a decision from an outage: these are the answers no retry reverses, so the
 * upload behind one is discarded. Everything else is treated as infrastructure and retried.
 */
const FORM_SPACE_UPLOAD_REFUSAL_ERROR_CODES: ReadonlySet<string> = new Set<string>([FORM_SPACE_NOT_FOUND_ERROR_CODE, FORM_SPACE_NOT_EDITABLE_ERROR_CODE, FORM_SPACE_UPLOAD_USER_MISMATCH_ERROR_CODE, FORM_SPACE_UPLOAD_NOT_ALLOWED_ERROR_CODE]);

/**
 * Returns true when the error is the upload being refused, rather than something failing.
 *
 * The code is readable off `details` because the error factories spread the caller's `{ code }` over their
 * own default, so a FormSpace refusal carries its own code there.
 *
 * @param e - The thrown value.
 * @returns True when the error is a refusal.
 */
function _isFormSpaceUploadRefusal(e: unknown): boolean {
  const code = (e as Maybe<{ readonly details?: Maybe<{ readonly code?: Maybe<string> }> }>)?.details?.code;
  return code != null && FORM_SPACE_UPLOAD_REFUSAL_ERROR_CODES.has(code);
}

/**
 * Input for {@link _assertFormSpaceAcceptsUpload}.
 */
interface AssertFormSpaceAcceptsUploadInput {
  readonly formSpace: Maybe<FormSpace>;
  readonly uploaderId: FirebaseAuthUserId;
  /**
   * Whether the app's delegate has already authorized an uploader who is not the space's `u`.
   *
   * PRECOMPUTED and passed in rather than resolved here: this runs inside `runTransaction`, whose callback
   * is re-run on contention, and `u` never changes — so one resolution is both cheaper and no less correct.
   *
   * Defaults to false, which is the un-delegated behaviour byte for byte.
   */
  readonly uploaderAuthorizedByDelegate?: Maybe<boolean>;
  readonly slot: FormSpaceFileSlot;
  readonly mimeType: ContentTypeMimeType;
  readonly sizeBytes: number;
  readonly appFormSpaceTypeConfigService: AppFormSpaceTypeConfigService;
}

/**
 * Throws unless this uploader may put this file in this slot of this FormSpace.
 *
 * Run TWICE — once in the transaction that claims the index, once in the transaction that increments
 * `uc`. The first call is an optimization; only the second is a control.
 *
 * Stays SYNCHRONOUS. The one question here that needs a Firestore read — may a non-`u` uploader write into
 * a shared space — is answered once before either transaction and arrives as
 * {@link AssertFormSpaceAcceptsUploadInput.uploaderAuthorizedByDelegate}.
 *
 * @param input - The loaded space, the uploader, and the candidate file.
 * @throws {HttpsError} When the space is missing, owned by someone else, no longer editable, or the file
 *   violates the type's rules.
 */
function _assertFormSpaceAcceptsUpload(input: AssertFormSpaceAcceptsUploadInput): void {
  const { formSpace, uploaderId, uploaderAuthorizedByDelegate, slot, mimeType, sizeBytes, appFormSpaceTypeConfigService } = input;

  if (formSpace == null) {
    throw formSpaceNotFoundError();
  }

  if (formSpace.u !== uploaderId && uploaderAuthorizedByDelegate !== true) {
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
