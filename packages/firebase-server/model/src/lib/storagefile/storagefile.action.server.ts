import {
  type FirestoreContextReference,
  type InitializeStorageFileFromUploadParams,
  initializeStorageFileFromUploadParamsType,
  type AsyncStorageFileCreateAction,
  type StorageFileFirestoreCollections,
  type ProcessStorageFileParams,
  processStorageFileParamsType,
  type StorageFileDocument,
  type ProcessStorageFileResult,
  type CreateStorageFileParams,
  createStorageFileParamsType,
  type AsyncStorageFileUpdateAction,
  type UpdateStorageFileParams,
  updateStorageFileParamsType,
  type NotificationFirestoreCollections,
  UPLOADS_FOLDER_PATH,
  iterateStorageListFilesByEachFile,
  type FirebaseStorageAccessorFile,
  type InitializeAllStorageFilesFromUploadsResult,
  type InitializeAllStorageFilesFromUploadsParams,
  initializeAllStorageFilesFromUploadsParamsType,
  type StorageFileKey,
  StorageFileProcessingState,
  StorageFileState,
  storageFileProcessingNotificationTaskTemplate,
  createNotificationDocument,
  type ProcessAllQueuedStorageFilesParams,
  processAllQueuedStorageFilesParamsType,
  type ProcessAllQueuedStorageFilesResult,
  iterateFirestoreDocumentSnapshotPairs,
  type DeleteAllQueuedStorageFilesParams,
  deleteAllQueuedStorageFilesParamsType,
  type DeleteAllQueuedStorageFilesResult,
  type DeleteStorageFileParams,
  deleteStorageFileParamsType,
  storageFilesQueuedForProcessingQuery,
  type AsyncStorageFileDeleteAction,
  type StorageFile,
  STORAGE_FILE_PROCESSING_STUCK_THROTTLE_CHECK_MS,
  storageFilesQueuedForDeleteQuery,
  firestoreDummyKey,
  type DownloadStorageFileParams,
  downloadStorageFileParamsType,
  type DownloadStorageFileResult,
  type DownloadMultipleStorageFilesParams,
  downloadMultipleStorageFilesParamsType,
  type DownloadMultipleStorageFilesResult,
  type DownloadMultipleStorageFileSuccessItem,
  type DownloadMultipleStorageFileErrorItem,
  type FirestoreModelKey,
  type SyncStorageFileWithGroupsParams,
  syncStorageFileWithGroupsParamsType,
  type SyncAllFlaggedStorageFilesWithGroupsParams,
  syncAllFlaggedStorageFilesWithGroupsParamsType,
  type SyncAllFlaggedStorageFilesWithGroupsResult,
  type SyncStorageFileWithGroupsResult,
  type FirestoreDocumentSnapshotDataPairWithData,
  type RegenerateAllFlaggedStorageFileGroupsContentParams,
  regenerateAllFlaggedStorageFileGroupsContentParamsType,
  type RegenerateAllFlaggedStorageFileGroupsContentResult,
  type RegenerateStorageFileGroupContentParams,
  regenerateStorageFileGroupContentParamsType,
  type RegenerateStorageFileGroupContentResult,
  type StorageFileGroupDocument,
  storageFileFlaggedForSyncWithGroupsQuery,
  iterateFirestoreDocumentSnapshotPairBatches,
  loadDocumentsForIds,
  getDocumentSnapshotDataPairs,
  storageFileGroupsFlaggedForContentRegenerationQuery,
  type AsyncStorageFileGroupCreateAction,
  type CreateStorageFileGroupParams,
  createStorageFileGroupParamsType,
  type Transaction,
  type StorageFileGroup,
  loadStorageFileGroupDocumentForReferencePair,
  type StorageFileGroupDocumentReferencePair,
  calculateStorageFileGroupEmbeddedFileUpdate,
  calculateStorageFileGroupRegeneration,
  getDocumentSnapshotDataPair,
  createStorageFileDocumentPairFactory,
  StorageFileCreationType,
  storageFileGroupZipFileStoragePath,
  inferKeyFromTwoWayFlatFirestoreModelKey,
  STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE,
  type StorageFileGroupZipStorageFileMetadata,
  type SendNotificationResult,
  type StorageFileGroupId,
  type UpdateStorageFileGroupParams,
  updateStorageFileGroupParamsType,
  type StorageFileGroupEmbeddedFile,
  type DownloadStorageFileOptions
} from '@dereekb/firebase';
import { assertSnapshotData, type FirebaseServerStorageServiceRef, type FirebaseServerActionsContext, type FirebaseServerAuthServiceRef, internalServerError } from '@dereekb/firebase-server';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { type InjectionToken } from '@nestjs/common';
import { type NotificationExpediteServiceInstance, type NotificationExpediteServiceRef } from '../notification';
import { type StorageFileInitializeFromUploadResult, type StorageFileInitializeFromUploadServiceRef } from './storagefile.upload.service';
import {
  uploadedFileIsNotAllowedToBeInitializedError,
  uploadedFileDoesNotExistError,
  uploadedFileInitializationFailedError,
  uploadedFileInitializationDiscardedError,
  storageFileProcessingNotAvailableForTypeError,
  storageFileAlreadyProcessedError,
  storageFileProcessingNotAllowedForInvalidStateError,
  storageFileProcessingNotQueuedForProcessingError,
  storageFileNotFlaggedForDeletionError,
  storageFileCannotBeDeletedYetError,
  storageFileNotFlaggedForGroupsSyncError,
  createStorageFileGroupInputError,
  storageFileGroupQueuedForInitializationError
} from './storagefile.error';
import { expirationDetails, isPast, isThrottled, type Maybe, mergeSlashPaths, ModelRelationUtility, MS_IN_MINUTE, performAsyncTasks, runAsyncTasksForValues, slashPathDetails, unixDateTimeSecondsNumberFromDate } from '@dereekb/util';
import { type HttpsError } from 'firebase-functions/https';
import { findMinDate } from '@dereekb/date';
import { addDays } from 'date-fns';

/**
 * NestJS injection token for the {@link BaseStorageFileServerActionsContext}, providing
 * Firebase infrastructure, storage service, notification collections, and Firestore collections
 * needed by storage file actions.
 */
export const BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT';

/**
 * NestJS injection token for the fully assembled {@link StorageFileServerActionsContext},
 * which adds the upload initialization service on top of the base context.
 */
export const STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'STORAGE_FILE_SERVER_ACTION_CONTEXT';

/**
 * Minimal context providing Firebase infrastructure, storage, notification, and Firestore
 * collections needed by all storage file server actions.
 */
export interface BaseStorageFileServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, NotificationExpediteServiceRef, StorageFileFirestoreCollections, FirebaseServerAuthServiceRef, FirebaseServerStorageServiceRef, FirestoreContextReference {}

/**
 * Full context for storage file server actions, extending the base with the
 * upload initialization service.
 */
export interface StorageFileServerActionsContext extends BaseStorageFileServerActionsContext, StorageFileInitializeFromUploadServiceRef {}

/**
 * Abstract service class defining all server-side storage file CRUD, upload processing, and group management actions.
 *
 * This is the central API surface for the storage file system's backend. It provides:
 *
 * - **File management**: create, update, delete, and download {@link StorageFile} documents
 * - **Upload pipeline**: initialize storage files from uploaded files, with type detection and processing
 * - **Batch processing**: process all queued files, delete all flagged files
 * - **Group management**: create/update {@link StorageFileGroup} documents, sync files with groups,
 *   and regenerate group content (e.g., ZIP archives)
 *
 * Each method follows the transform-and-validate pattern used throughout the notification/storage system.
 *
 * @see {@link storageFileServerActions} for the concrete implementation factory.
 */
export abstract class StorageFileServerActions {
  abstract createStorageFile(params: CreateStorageFileParams): AsyncStorageFileCreateAction<CreateStorageFileParams>;
  abstract initializeAllStorageFilesFromUploads(params: InitializeAllStorageFilesFromUploadsParams): Promise<TransformAndValidateFunctionResult<InitializeAllStorageFilesFromUploadsParams, () => Promise<InitializeAllStorageFilesFromUploadsResult>>>;
  abstract initializeStorageFileFromUpload(params: InitializeStorageFileFromUploadParams): AsyncStorageFileCreateAction<InitializeStorageFileFromUploadParams>;
  abstract updateStorageFile(params: UpdateStorageFileParams): AsyncStorageFileUpdateAction<UpdateStorageFileParams>;
  abstract processAllQueuedStorageFiles(params: ProcessAllQueuedStorageFilesParams): Promise<TransformAndValidateFunctionResult<ProcessAllQueuedStorageFilesParams, () => Promise<ProcessAllQueuedStorageFilesResult>>>;
  abstract processStorageFile(params: ProcessStorageFileParams): Promise<TransformAndValidateFunctionResult<ProcessStorageFileParams, (storageFileDocument: StorageFileDocument) => Promise<ProcessStorageFileResult>>>;
  abstract deleteAllQueuedStorageFiles(params: DeleteAllQueuedStorageFilesParams): Promise<TransformAndValidateFunctionResult<DeleteAllQueuedStorageFilesParams, () => Promise<DeleteAllQueuedStorageFilesResult>>>;
  abstract deleteStorageFile(params: DeleteStorageFileParams): AsyncStorageFileDeleteAction<DeleteStorageFileParams>;
  abstract downloadStorageFile(params: DownloadStorageFileParams): Promise<TransformAndValidateFunctionResult<DownloadStorageFileParams, (storageFileDocument?: Maybe<StorageFileDocument>) => Promise<DownloadStorageFileResult>>>;
  abstract downloadMultipleStorageFiles(params: DownloadMultipleStorageFilesParams): Promise<TransformAndValidateFunctionResult<DownloadMultipleStorageFilesParams, (storageFileDocuments?: Maybe<StorageFileDocument[]>) => Promise<DownloadMultipleStorageFilesResult>>>;
  abstract createStorageFileGroup(params: CreateStorageFileGroupParams): AsyncStorageFileGroupCreateAction<CreateStorageFileGroupParams>;
  abstract updateStorageFileGroup(params: UpdateStorageFileGroupParams): Promise<TransformAndValidateFunctionResult<UpdateStorageFileGroupParams, (storageFileGroupDocument: StorageFileGroupDocument) => Promise<StorageFileGroupDocument>>>;
  abstract syncStorageFileWithGroups(params: SyncStorageFileWithGroupsParams): Promise<TransformAndValidateFunctionResult<SyncStorageFileWithGroupsParams, (storageFileDocument: StorageFileDocument) => Promise<SyncStorageFileWithGroupsResult>>>;
  abstract syncAllFlaggedStorageFilesWithGroups(params: SyncAllFlaggedStorageFilesWithGroupsParams): Promise<TransformAndValidateFunctionResult<SyncAllFlaggedStorageFilesWithGroupsParams, () => Promise<SyncAllFlaggedStorageFilesWithGroupsResult>>>;
  abstract regenerateStorageFileGroupContent(params: RegenerateStorageFileGroupContentParams): Promise<TransformAndValidateFunctionResult<RegenerateStorageFileGroupContentParams, (storageFileGroupDocument: StorageFileGroupDocument) => Promise<RegenerateStorageFileGroupContentResult>>>;
  abstract regenerateAllFlaggedStorageFileGroupsContent(params: RegenerateAllFlaggedStorageFileGroupsContentParams): Promise<TransformAndValidateFunctionResult<RegenerateAllFlaggedStorageFileGroupsContentParams, () => Promise<RegenerateAllFlaggedStorageFileGroupsContentResult>>>;
}

/**
 * Creates a concrete {@link StorageFileServerActions} implementation by wiring each action
 * to its factory function using the provided context.
 *
 * @param context - the fully assembled storage file server actions context
 *
 * @param context - the fully assembled storage file server actions context
 * @returns a concrete {@link StorageFileServerActions} with all action methods wired to their factories
 *
 * @example
 * ```ts
 * const actions = storageFileServerActions(context);
 * const initFn = await actions.initializeStorageFileFromUpload({ key, storagePath });
 * const storageFileDoc = await initFn();
 * ```
 */
export function storageFileServerActions(context: StorageFileServerActionsContext): StorageFileServerActions {
  return {
    createStorageFile: createStorageFileFactory(context),
    initializeAllStorageFilesFromUploads: initializeAllStorageFilesFromUploadsFactory(context),
    initializeStorageFileFromUpload: initializeStorageFileFromUploadFactory(context),
    updateStorageFile: updateStorageFileFactory(context),
    processAllQueuedStorageFiles: processAllQueuedStorageFilesFactory(context),
    processStorageFile: processStorageFileFactory(context),
    deleteAllQueuedStorageFiles: deleteAllQueuedStorageFilesFactory(context),
    deleteStorageFile: deleteStorageFileFactory(context),
    downloadStorageFile: downloadStorageFileFactory(context),
    downloadMultipleStorageFiles: downloadMultipleStorageFilesFactory(context),
    createStorageFileGroup: createStorageFileGroupFactory(context),
    updateStorageFileGroup: updateStorageFileGroupFactory(context),
    syncStorageFileWithGroups: syncStorageFileWithGroupsFactory(context),
    syncAllFlaggedStorageFilesWithGroups: syncAllFlaggedStorageFilesWithGroupsFactory(context),
    regenerateStorageFileGroupContent: regenerateStorageFileGroupContentFactory(context),
    regenerateAllFlaggedStorageFileGroupsContent: regenerateAllFlaggedStorageFileGroupsContentFactory(context)
  };
}

// MARK: Actions
/**
 * Factory for the `createStorageFile` action.
 *
 * Creates a new {@link StorageFile} document using the provided template data.
 *
 * @param context - the base server actions context providing Firestore and storage access
 * @returns an async transform-and-validate function that creates a StorageFile document
 */
export function createStorageFileFactory(context: BaseStorageFileServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(createStorageFileParamsType, async (params) => {
    const _params = params;

    return async () => {
      // TODO: check the file exists, and pull the metadata, and create the document

      return null as unknown as StorageFileDocument;
    };
  });
}

/**
 * Factory for the `initializeAllStorageFilesFromUploads` action.
 *
 * Scans the uploads folder in Firebase Storage, identifies new uploaded files,
 * initializes each one via the upload service, and cleans up the source upload
 * on success. Failed initializations are logged but do not halt the batch.
 *
 * @param context - the storage file server actions context with storage service and upload initialization
 * @returns an async transform-and-validate function that returns batch initialization results
 */
export function initializeAllStorageFilesFromUploadsFactory(context: StorageFileServerActionsContext) {
  const { storageService, firebaseServerActionTransformFunctionFactory } = context;
  const _initializeStorageFileFromUploadFile = _initializeStorageFileFromUploadFileFactory(context);

  return firebaseServerActionTransformFunctionFactory(initializeAllStorageFilesFromUploadsParamsType, async (params) => {
    const { folderPath, maxFilesToInitialize, overrideUploadsFolderPath } = params;
    const fullPath = mergeSlashPaths([overrideUploadsFolderPath ?? UPLOADS_FOLDER_PATH, folderPath]); // only targets the uploads folder

    return async () => {
      const folder = storageService.folder(fullPath);

      const modelKeys: StorageFileKey[] = [];

      let filesVisited = 0;
      let initializationsSuccessCount = 0;
      let initializationsFailureCount = 0;

      await iterateStorageListFilesByEachFile({
        folder,
        includeNestedResults: true,
        readItemsFromPageResult: (results) => results.result.files(),
        iterateEachPageItem: async (file) => {
          const fileInstance = file.file();
          const initializeResult = await _initializeStorageFileFromUploadFile({ file: fileInstance }).catch(() => null);

          filesVisited++;

          if (initializeResult) {
            initializationsSuccessCount++;
            modelKeys.push(initializeResult.key);
          } else {
            initializationsFailureCount++;
          }
        },
        /**
         * The maximum number of files to initialize at once.
         */
        iterateItemsLimit: maxFilesToInitialize ?? 1000,
        /**
         * Iterate four separate pages at a time
         */
        maxParallelPages: 4
      });

      const result: InitializeAllStorageFilesFromUploadsResult = {
        modelKeys,
        filesVisited,
        initializationsSuccessCount,
        initializationsFailureCount
      };

      return result;
    };
  });
}

export interface InitializeStorageFileFromUploadFileInput {
  readonly file: FirebaseStorageAccessorFile;
  /**
   * Whether or not to attempt to expedite the processing of the created StorageFile, if it is queued for processing.
   *
   * If it cannot be processed, this argument will have no effect.
   */
  readonly expediteProcessing?: Maybe<boolean>;
}

/**
 * Internal factory that creates a function to initialize a {@link StorageFile} from an uploaded file.
 *
 * Validates the file exists and is allowed, runs the upload initializer, deletes the upload source
 * on success, and optionally expedites processing of the created storage file.
 *
 * @param context - the storage file server actions context
 * @returns an async function that accepts an upload file input and returns the created StorageFileDocument
 */
export function _initializeStorageFileFromUploadFileFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, storageFileInitializeFromUploadService, notificationExpediteService } = context;
  const processStorageFileInTransaction = _processStorageFileInTransactionFactory(context);

  return async (input: InitializeStorageFileFromUploadFileInput) => {
    const { file, expediteProcessing } = input;
    const { bucketId, pathString } = file.storagePath;

    // file must exist
    const exists = await file.exists();

    if (!exists) {
      throw uploadedFileDoesNotExistError();
    }

    // file must be allowed to be initialized
    const isAllowedToBeInitialized = await storageFileInitializeFromUploadService.checkFileIsAllowedToBeInitialized(file);

    if (!isAllowedToBeInitialized) {
      throw uploadedFileIsNotAllowedToBeInitializedError();
    }

    let storageFileDocument: StorageFileDocument | undefined;
    let initializationResult: StorageFileInitializeFromUploadResult;

    let httpsError: Maybe<HttpsError>;

    try {
      initializationResult = await storageFileInitializeFromUploadService.initializeFromUpload({
        file
      });

      async function deleteFile() {
        try {
          // can now delete the uploaded file
          await file.delete();
        } catch (e) {
          // log errors here, but do nothing.
          console.error(`initializeStorageFileFromUpload(): Error deleting uploaded file (${bucketId}/${pathString})`, e);
        }
      }

      switch (initializationResult.resultType) {
        case 'success':
          await deleteFile();

          if (initializationResult.storageFileDocument) {
            storageFileDocument = initializationResult.storageFileDocument;

            // expedite processing if requested
            if (expediteProcessing) {
              const storageFile = await assertSnapshotData(storageFileDocument);

              if (storageFile.ps === StorageFileProcessingState.QUEUED_FOR_PROCESSING) {
                const expediteInstance = notificationExpediteService.expediteInstance();

                await firestoreContext.runTransaction(async (transaction) => {
                  expediteInstance.initialize();

                  await processStorageFileInTransaction(
                    {
                      storageFileDocument: storageFileDocument as StorageFileDocument,
                      expediteInstance
                    },
                    transaction
                  );
                });

                await expediteInstance.send().catch(() => null);
              }
            }
          } else {
            httpsError = uploadedFileInitializationDiscardedError();
          }
          break;
        case 'initializer_error':
          if (initializationResult.initializationError) {
            throw initializationResult.initializationError; // re-throw the encountered error
          }
          break;
        case 'permanent_initializer_failure':
          // log the error
          if (initializationResult.initializationError) {
            console.warn(`initializeStorageFileFromUpload(): Permanent initializer failure for file (${bucketId}/${pathString})`, initializationResult.initializationError);
          }

          // delete the file
          await deleteFile();

          // return the error
          httpsError = uploadedFileInitializationFailedError({
            resultType: initializationResult.resultType,
            fileDeleted: true
          });
          break;
        case 'no_determiner_match':
        case 'no_initializer_configured':
        default:
          httpsError = uploadedFileInitializationFailedError({
            resultType: initializationResult.resultType
          });

          console.error(`initializeStorageFileFromUpload(): Unknown file type (${initializationResult.resultType}) encountered for storage file "${bucketId}/${pathString}".`);
          break;
      }
    } catch (e) {
      console.error(`initializeStorageFileFromUpload(): Error while initializing storage file (${bucketId}/${pathString}) from upload`, e);
      httpsError = uploadedFileInitializationFailedError({ resultType: 'initializer_error' });
    }

    if (httpsError) {
      throw httpsError;
    } else if (!storageFileDocument) {
      throw uploadedFileInitializationDiscardedError(); // throw again for redundancy
    }

    return storageFileDocument;
  };
}

/**
 * Factory for the `initializeStorageFileFromUpload` action.
 *
 * Initializes a single {@link StorageFile} from an uploaded file at the given storage path.
 * Validates the file exists and is allowed, runs the type determiner and initializer,
 * then cleans up the upload source on success.
 *
 * @param context - the storage file server actions context with storage and upload services
 * @returns an async transform-and-validate function that creates a StorageFile from an upload
 */
export function initializeStorageFileFromUploadFactory(context: StorageFileServerActionsContext) {
  const { storageService, firebaseServerActionTransformFunctionFactory } = context;
  const _initializeStorageFileFromUploadFile = _initializeStorageFileFromUploadFileFactory(context);

  return firebaseServerActionTransformFunctionFactory(initializeStorageFileFromUploadParamsType, async (params) => {
    const { bucketId, pathString, expediteProcessing } = params;

    return async () => {
      const file = storageService.file(bucketId == null ? pathString : { bucketId, pathString });
      return _initializeStorageFileFromUploadFile({ file, expediteProcessing });
    };
  });
}

/**
 * Factory for the `updateStorageFile` action.
 *
 * Updates an existing {@link StorageFile} document with the provided schedule-delete-at time.
 *
 * @param context - the base server actions context providing Firestore access
 * @returns an async transform-and-validate function that updates a StorageFile document
 */
export function updateStorageFileFactory(context: BaseStorageFileServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(updateStorageFileParamsType, async (params) => {
    const { sdat } = params;

    return async (storageFileDocument: StorageFileDocument) => {
      const updateTemplate: Partial<StorageFile> = {
        sdat
      };

      await storageFileDocument.update(updateTemplate);
      return storageFileDocument;
    };
  });
}

/**
 * Factory for the `updateStorageFileGroup` action.
 *
 * Updates embedded file entries within a {@link StorageFileGroup} document inside a
 * Firestore transaction, merging display name changes into the existing entries.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that updates a StorageFileGroup document
 */
export function updateStorageFileGroupFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, storageFileGroupCollection, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(updateStorageFileGroupParamsType, async (params) => {
    const { entries } = params;

    return async (storageFileGroupDocument: StorageFileGroupDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        const storageFileGroupDocumentInTransaction = storageFileGroupCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(storageFileGroupDocument);
        const storageFileGroup = await assertSnapshotData(storageFileGroupDocumentInTransaction);

        let f: Maybe<StorageFileGroupEmbeddedFile[]> = undefined;

        // update entries
        if (entries?.length) {
          f = ModelRelationUtility.updateCollection(storageFileGroup.f, entries as StorageFileGroupEmbeddedFile[], {
            readKey: (x) => x.s,
            merge: (existing, update) => {
              const n = update.n === undefined ? existing.n : update.n;

              return {
                ...existing,
                n
              };
            }
          });
        }

        const updateTemplate: Partial<StorageFileGroup> = {
          f
        };

        await storageFileGroupDocumentInTransaction.update(updateTemplate);
      });

      return storageFileGroupDocument;
    };
  });
}

/**
 * Factory for the `processAllQueuedStorageFiles` action.
 *
 * Batch-processes all {@link StorageFile} documents queued for processing. Creates a
 * processing notification task for each file and optionally expedites delivery.
 * Handles stuck-processing detection with a throttle check.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that returns batch processing results
 */
export function processAllQueuedStorageFilesFactory(context: StorageFileServerActionsContext) {
  const { storageFileCollection, firebaseServerActionTransformFunctionFactory } = context;
  const processStorageFile = processStorageFileFactory(context);

  return firebaseServerActionTransformFunctionFactory(processAllQueuedStorageFilesParamsType, async (_params) => {
    return async () => {
      let storageFilesVisited = 0;
      let storageFilesProcessStarted = 0;
      let storageFilesFailedStarting = 0;

      const proceessStorageFileParams: ProcessStorageFileParams = {
        key: firestoreDummyKey()
      };

      const processStorageFileInstance = await processStorageFile(proceessStorageFileParams);

      await iterateFirestoreDocumentSnapshotPairs({
        documentAccessor: storageFileCollection.documentAccessor(),
        iterateSnapshotPair: async (snapshotPair) => {
          storageFilesVisited++;
          const processStorageFileResult = await processStorageFileInstance(snapshotPair.document).catch(() => null);

          if (processStorageFileResult) {
            storageFilesProcessStarted++;
          } else {
            storageFilesFailedStarting++;
          }
        },
        constraintsFactory: () => storageFilesQueuedForProcessingQuery(),
        queryFactory: storageFileCollection,
        batchSize: undefined,
        performTasksConfig: {
          maxParallelTasks: 10
        }
      });

      const result: ProcessAllQueuedStorageFilesResult = {
        storageFilesVisited,
        storageFilesProcessStarted,
        storageFilesFailedStarting
      };

      return result;
    };
  });
}

export interface ProcessStorageFileInTransactionInput {
  /**
   * The StorageFileDocument to update.
   */
  readonly storageFileDocument: StorageFileDocument;
  /**
   * The storage file, if already loaded in this transaction.
   */
  readonly storageFile?: StorageFile;
  /**
   * Input params to use.
   */
  readonly params?: Maybe<Pick<ProcessStorageFileParams, 'checkRetryProcessing' | 'forceRestartProcessing' | 'processAgainIfSuccessful'>>;
  /**
   * The expedite instance to enqueue a create result into, if applicable.
   */
  readonly expediteInstance?: Maybe<NotificationExpediteServiceInstance>;
}

/**
 * Internal factory that creates a function for processing a {@link StorageFile} within a Firestore transaction.
 *
 * Creates or restarts a notification task for the file based on its current processing state,
 * handling stuck-processing detection, forced restarts, and re-processing of already-successful files.
 *
 * @param context - the storage file server actions context
 * @returns an async function that processes a storage file within a transaction
 */
export function _processStorageFileInTransactionFactory(context: StorageFileServerActionsContext) {
  const { storageFileCollection, notificationCollectionGroup } = context;

  return async (input: ProcessStorageFileInTransactionInput, transaction: Transaction) => {
    const { storageFileDocument, storageFile: inputStorageFile, params, expediteInstance } = input;
    const { checkRetryProcessing, forceRestartProcessing, processAgainIfSuccessful } = params ?? {};

    const storageFileDocumentInTransaction = storageFileCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(storageFileDocument);
    const storageFile = inputStorageFile ?? (await assertSnapshotData(storageFileDocumentInTransaction));

    async function beginProcessing(overrideExistingTask: boolean) {
      const state = storageFile.fs;

      // check the storageFile is in the OK state
      if (state !== StorageFileState.OK) {
        throw storageFileProcessingNotAllowedForInvalidStateError();
      }

      const createNotificationTaskResult = await createNotificationDocument({
        context,
        transaction,
        template: storageFileProcessingNotificationTaskTemplate({
          storageFileDocument,
          overrideExistingTask
        })
      });

      await storageFileDocumentInTransaction.update({
        ps: StorageFileProcessingState.PROCESSING,
        pat: new Date(), // set new processing start date
        pcat: null, // clear processing completion date
        pn: createNotificationTaskResult.notificationDocument.key
      });

      expediteInstance?.enqueueCreateResult(createNotificationTaskResult);
    }

    switch (storageFile.ps) {
      case StorageFileProcessingState.INIT_OR_NONE:
        // queue up for processing, unless it has no purpose
        if (!storageFile.p) {
          throw storageFileProcessingNotAvailableForTypeError();
        } else {
          await beginProcessing(false);
        }
        break;
      case StorageFileProcessingState.QUEUED_FOR_PROCESSING:
        // begin processing
        await beginProcessing(false);
        break;
      case StorageFileProcessingState.PROCESSING: {
        // check if the processing task is still running
        const shouldCheckProcessing = !isThrottled(STORAGE_FILE_PROCESSING_STUCK_THROTTLE_CHECK_MS, storageFile.pat);

        if (!storageFile.pn) {
          await beginProcessing(true); // if no processing task is set, restart processing to recover from the broken state
        } else {
          const { pn } = storageFile;
          const notificationDocument = notificationCollectionGroup.documentAccessorForTransaction(transaction).loadDocumentForKey(pn);

          if (checkRetryProcessing || shouldCheckProcessing) {
            const notification = await notificationDocument.snapshotData();

            if (!notification) {
              // the notification document is missing. Re-begin processing
              await beginProcessing(true);
            } else if (notification.d || forceRestartProcessing) {
              // if the notification is somehow in the done state but the StorageFile never got notified in the same transaction, requeue.
              await beginProcessing(true);
            }

            // NOTE: We could look at the state of the notification task more, but at this point the task is probably still valid and still running,
            // so we can only wait on it. In general if the task still exists and is not yet done, then we should wait on it as the
            // task running system should complete eventually by design.
          } else if (expediteInstance) {
            // enqueue the existing notification to be run in the expedite instance
            expediteInstance.enqueue(notificationDocument);
          }
        }
        break;
      }
      case StorageFileProcessingState.FAILED:
        // restart processing on failure
        await beginProcessing(true);
        break;
      case StorageFileProcessingState.DO_NOT_PROCESS:
        throw storageFileProcessingNotQueuedForProcessingError();
      case StorageFileProcessingState.SUCCESS:
        if (forceRestartProcessing || processAgainIfSuccessful) {
          await beginProcessing(true);
        } else {
          throw storageFileAlreadyProcessedError();
        }
        break;
      case StorageFileProcessingState.ARCHIVED:
        throw storageFileProcessingNotQueuedForProcessingError();
    }
  };
}

/**
 * Factory for the `processStorageFile` action.
 *
 * Processes a single {@link StorageFile} by creating a notification task for it
 * and marking it as processing. Validates the file is in a valid state for processing.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that processes a single StorageFile
 */
export function processStorageFileFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, notificationExpediteService, firebaseServerActionTransformFunctionFactory } = context;
  const processStorageFileInTransaction = _processStorageFileInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(processStorageFileParamsType, async (params) => {
    const { runImmediately } = params;

    return async (storageFileDocument: StorageFileDocument) => {
      const expediteInstance = notificationExpediteService.expediteInstance();

      await firestoreContext.runTransaction(async (transaction) => {
        expediteInstance.initialize();

        await processStorageFileInTransaction(
          {
            storageFileDocument,
            params,
            expediteInstance
          },
          transaction
        );
      });

      let expediteResult: Maybe<SendNotificationResult> = null;

      // expedite the task if requested
      if (runImmediately) {
        expediteResult = await expediteInstance.send().then((x) => x[0]);
      }

      const result: ProcessStorageFileResult = {
        runImmediately: runImmediately ?? false,
        expediteResult
      };

      return result;
    };
  });
}

/**
 * Factory for the `deleteAllQueuedStorageFiles` action.
 *
 * Batch-deletes all {@link StorageFile} documents flagged for deletion whose
 * scheduled delete time has passed. Removes both the Firestore document and
 * the associated file in Cloud Storage.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that returns batch deletion results
 */
export function deleteAllQueuedStorageFilesFactory(context: StorageFileServerActionsContext) {
  const { storageFileCollection, firebaseServerActionTransformFunctionFactory } = context;
  const deleteStorageFile = deleteStorageFileFactory(context);

  return firebaseServerActionTransformFunctionFactory(deleteAllQueuedStorageFilesParamsType, async (_params) => {
    return async () => {
      let storageFilesVisited = 0;
      let storageFilesDeleted = 0;
      let storageFilesFailedDeleting = 0;

      const deleteStorageFileInstance = await deleteStorageFile({
        key: firestoreDummyKey()
      });

      await iterateFirestoreDocumentSnapshotPairs({
        documentAccessor: storageFileCollection.documentAccessor(),
        iterateSnapshotPair: async (snapshotPair) => {
          const { document: storageFileDocument } = snapshotPair;
          storageFilesVisited++;

          const deleteStorageFileResult = await deleteStorageFileInstance(storageFileDocument)
            .then(() => true)
            .catch(() => false);

          if (deleteStorageFileResult) {
            storageFilesDeleted++;
          } else {
            storageFilesFailedDeleting++;
          }
        },
        constraintsFactory: () => storageFilesQueuedForDeleteQuery(),
        queryFactory: storageFileCollection,
        batchSize: undefined,
        performTasksConfig: {
          maxParallelTasks: 10
        }
      });

      const result: DeleteAllQueuedStorageFilesResult = {
        storageFilesDeleted,
        storageFilesFailedDeleting,
        storageFilesVisited
      };

      return result;
    };
  });
}

/**
 * Factory for the `deleteStorageFile` action.
 *
 * Deletes a single {@link StorageFile} document and its associated Cloud Storage file.
 * Validates the file is flagged for deletion and the scheduled delete time has passed.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that deletes a StorageFile and its storage object
 */
export function deleteStorageFileFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, storageService, storageFileCollection, firebaseServerActionTransformFunctionFactory } = context;
  const syncStorageFileWithGroupsInTransaction = _syncStorageFileWithGroupsInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(deleteStorageFileParamsType, async (params) => {
    const { force } = params;
    return async (inputStorageFileDocument: StorageFileDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        const storageFileDocument = storageFileCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(inputStorageFileDocument);

        const storageFile = await assertSnapshotData(storageFileDocument);
        const fileAccessor = storageService.file(storageFile);

        if (!force) {
          if (!storageFile.sdat) {
            throw storageFileNotFlaggedForDeletionError();
          } else if (!isPast(storageFile.sdat)) {
            throw storageFileCannotBeDeletedYetError();
          }
        }

        // remove the storage file from any groups
        await syncStorageFileWithGroupsInTransaction({ storageFileDocument, storageFile, force: true, removeAllStorageFileGroups: true }, transaction);

        // delete the file
        await fileAccessor.delete().catch(() => null);

        // delete the document
        await storageFileDocument.accessor.delete();
      });
    };
  });
}

// MARK: Download
/**
 * Per-item input for the internal multiple-download factory.
 *
 * Per-file options override the defaults from {@link DownloadMultipleStorageFilesFactoryInput}.
 * `asAdmin` is not per-file — it is controlled at the batch level only.
 */
export interface DownloadMultipleStorageFilesFactoryInputItem extends Pick<DownloadStorageFileOptions, 'expiresAt' | 'expiresIn' | 'responseDisposition' | 'responseContentType'> {
  readonly key: FirestoreModelKey;
  readonly storageFileDocument?: Maybe<StorageFileDocument>;
}

/**
 * Input configuration for {@link _downloadMultipleStorageFilesFactory}.
 *
 * Top-level options serve as defaults. Per-item options in {@link DownloadMultipleStorageFilesFactoryInputItem}
 * override them when defined.
 *
 * @example
 * ```ts
 * const result = await downloadMultipleStorageFiles({
 *   items: [{ key: 'storageFile/abc' }],
 *   expiresIn: 1800000,
 *   throwOnFirstError: true
 * });
 * ```
 */
export interface DownloadMultipleStorageFilesFactoryInput extends DownloadStorageFileOptions {
  readonly items: DownloadMultipleStorageFilesFactoryInputItem[];
  /**
   * When true, throws on the first download failure instead of collecting errors.
   *
   * Used by the single-download path ({@link downloadStorageFileFactory}).
   */
  readonly throwOnFirstError?: Maybe<boolean>;
  /**
   * Maximum number of concurrent download operations.
   *
   * Defaults to {@link DEFAULT_DOWNLOAD_MULTIPLE_STORAGE_FILES_MAX_PARALLEL_TASKS}.
   */
  readonly maxParallelTasks?: Maybe<number>;
}

/**
 * Default maximum number of concurrent download operations when batch-downloading StorageFiles.
 */
export const DEFAULT_DOWNLOAD_MULTIPLE_STORAGE_FILES_MAX_PARALLEL_TASKS = 5;

/**
 * Internal factory that generates signed download URLs for one or more StorageFiles.
 *
 * Uses {@link performAsyncTasks} with concurrency limiting to avoid overwhelming Cloud Storage.
 * Shared expiration/disposition/content-type options are applied uniformly to all items.
 * When `throwOnFirstError` is true, the first failure throws immediately (single-download behavior).
 * When false, failures are collected in the errors array (batch behavior).
 *
 * @param context - the storage file server actions context
 * @returns an async function that processes a {@link DownloadMultipleStorageFilesFactoryInput} and returns a {@link DownloadMultipleStorageFilesResult}
 */
function _downloadMultipleStorageFilesFactory(context: StorageFileServerActionsContext) {
  const { storageService, storageFileCollection } = context;

  return async (input: DownloadMultipleStorageFilesFactoryInput): Promise<DownloadMultipleStorageFilesResult> => {
    const { items, asAdmin, expiresAt, expiresIn: inputExpiresIn, responseDisposition, responseContentType, throwOnFirstError, maxParallelTasks: inputMaxParallelTasks } = input;

    const taskResult = await performAsyncTasks<DownloadMultipleStorageFilesFactoryInputItem, DownloadMultipleStorageFileSuccessItem>(
      items,
      async (item) => {
        // Load document from key if not provided
        const storageFileDocument = item.storageFileDocument ?? storageFileCollection.documentAccessor().loadDocumentForKey(item.key);
        const storageFile = await assertSnapshotData(storageFileDocument);
        const fileAccessor = storageService.file(storageFile);

        if (!fileAccessor.getSignedUrl) {
          throw internalServerError('Signed url function appears to not be available.');
        }

        // Per-item options override defaults
        const itemResponseDisposition = item.responseDisposition ?? responseDisposition;
        const itemResponseContentType = item.responseContentType ?? responseContentType;
        const expiresIn = item.expiresIn ?? inputExpiresIn ?? MS_IN_MINUTE * 30;
        const expires = expirationDetails({ defaultExpiresFromDateToNow: true, expiresAt: item.expiresAt ?? expiresAt, expiresIn });
        let downloadUrlExpiresAt = expires.getExpirationDate() as Date; // always returns a Date when defaultExpiresFromDateToNow and expiresIn are set

        // if they're not an admin, limit the expiration to a max of 30 days.
        if (!asAdmin) {
          const maxExpirationDate = addDays(new Date(), 30);
          downloadUrlExpiresAt = findMinDate([downloadUrlExpiresAt, maxExpirationDate]) as Date;
        }

        const [downloadUrl, metadata] = await Promise.all([
          fileAccessor.getSignedUrl({
            action: 'read',
            expiresAt: downloadUrlExpiresAt,
            responseDisposition: itemResponseDisposition ?? undefined, // can be set by anyone
            responseType: asAdmin ? (itemResponseContentType ?? undefined) : undefined // can only be set by admins
          }),
          fileAccessor.getMetadata()
        ]);

        return {
          key: item.key,
          url: downloadUrl,
          fileName: metadata.name ? slashPathDetails(metadata.name).end : undefined,
          mimeType: itemResponseContentType ?? metadata.contentType,
          expiresAt: unixDateTimeSecondsNumberFromDate(downloadUrlExpiresAt)
        } as DownloadMultipleStorageFileSuccessItem;
      },
      {
        throwError: throwOnFirstError ?? false,
        maxParallelTasks: inputMaxParallelTasks ?? DEFAULT_DOWNLOAD_MULTIPLE_STORAGE_FILES_MAX_PARALLEL_TASKS
      }
    );

    const success = taskResult.results.map(([, result]) => result);
    const errors: DownloadMultipleStorageFileErrorItem[] = taskResult.errors.map(([item, error]) => ({
      key: item.key,
      error: error instanceof Error ? error.message : 'Download failed'
    }));

    return { success, errors };
  };
}

/**
 * Factory for the `downloadStorageFile` action.
 *
 * Generates a signed download URL for a {@link StorageFile}'s associated Cloud Storage file.
 * Delegates to {@link _downloadMultipleStorageFilesFactory} with a single item and `throwOnFirstError: true`.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that generates a signed download URL
 */
export function downloadStorageFileFactory(context: StorageFileServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory } = context;
  const downloadMultipleStorageFiles = _downloadMultipleStorageFilesFactory(context);

  return firebaseServerActionTransformFunctionFactory(downloadStorageFileParamsType, async (params) => {
    const { key, asAdmin, expiresAt, expiresIn, responseDisposition, responseContentType } = params;

    return async (storageFileDocument?: Maybe<StorageFileDocument>) => {
      const result = await downloadMultipleStorageFiles({
        items: [{ key, storageFileDocument }],
        asAdmin,
        expiresAt,
        expiresIn,
        responseDisposition,
        responseContentType,
        throwOnFirstError: true
      });

      return result.success[0];
    };
  });
}

/**
 * Factory for the `downloadMultipleStorageFiles` action.
 *
 * Generates signed download URLs for multiple {@link StorageFile} documents in a single call.
 * By default, individual failures are collected in the errors array rather than failing the entire batch.
 * Set `throwOnFirstError` in params to throw on the first failure instead.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that generates signed download URLs for multiple files
 */
export function downloadMultipleStorageFilesFactory(context: StorageFileServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory } = context;
  const downloadMultipleStorageFiles = _downloadMultipleStorageFilesFactory(context);

  return firebaseServerActionTransformFunctionFactory(downloadMultipleStorageFilesParamsType, async (params) => {
    const { files, asAdmin, expiresAt, expiresIn, responseDisposition, responseContentType, throwOnFirstError } = params;

    return async (storageFileDocuments?: Maybe<StorageFileDocument[]>) => {
      const items: DownloadMultipleStorageFilesFactoryInputItem[] = files.map((file, i) => ({
        key: file.key,
        storageFileDocument: storageFileDocuments?.[i],
        expiresAt: file.expiresAt,
        expiresIn: file.expiresIn,
        responseDisposition: file.responseDisposition,
        responseContentType: file.responseContentType
      }));

      return downloadMultipleStorageFiles({
        items,
        asAdmin,
        expiresAt,
        expiresIn,
        responseDisposition,
        responseContentType,
        throwOnFirstError: throwOnFirstError ?? false
      });
    };
  });
}

/**
 * Used for creating a new NotificationBox within a transaction.
 *
 * Used for new models.
 */
export interface CreateStorageFileGroupInTransactionInput extends StorageFileGroupDocumentReferencePair {
  /**
   * Now date to use.
   */
  readonly now?: Maybe<Date>;
  /**
   * If true, skips calling create
   */
  readonly skipCreate?: Maybe<boolean>;
  /**
   * Template values to use for the created StorageFileGroup
   */
  readonly template?: Maybe<Pick<StorageFileGroup, 'f' | 're'>>;
}

/**
 * Internal factory that creates a function for creating a {@link StorageFileGroup} document
 * within a Firestore transaction.
 *
 * The created group is flagged for initialization (`s=true`) and uses a dummy owner key
 * that will be set during the initialization step.
 *
 * @param context - the storage file server actions context
 * @returns an async function that creates a StorageFileGroup within a transaction
 */
export function createStorageFileGroupInTransactionFactory(context: StorageFileServerActionsContext) {
  const { storageFileGroupCollection } = context;

  return async (params: CreateStorageFileGroupInTransactionInput, transaction: Transaction) => {
    const { now: inputNow, skipCreate, template } = params;
    const now = inputNow ?? new Date();

    const storageFileGroupDocument: StorageFileGroupDocument = loadStorageFileGroupDocumentForReferencePair(params, storageFileGroupCollection.documentAccessorForTransaction(transaction));

    const storageFileGroupTemplate: StorageFileGroup = {
      o: firestoreDummyKey(), // set during initialization
      cat: now,
      s: true, // requires initialization
      f: [],
      ...template
    };

    if (!skipCreate) {
      await storageFileGroupDocument.create(storageFileGroupTemplate);
    }

    return {
      storageFileGroupTemplate,
      storageFileGroupDocument
    };
  };
}

/**
 * Factory for the `createStorageFileGroup` action.
 *
 * Creates a new {@link StorageFileGroup} document within a Firestore transaction,
 * associating it with a model key or storage file.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that creates a new StorageFileGroup
 */
export function createStorageFileGroupFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const createStorageFileGroupInTransaction = createStorageFileGroupInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(createStorageFileGroupParamsType, async (params) => {
    const { model, storageFileId } = params;

    const storageFileGroupRelatedModelKey = model ?? (storageFileId ? inferKeyFromTwoWayFlatFirestoreModelKey(storageFileId) : undefined);

    if (!storageFileGroupRelatedModelKey) {
      throw createStorageFileGroupInputError();
    }

    return async () => {
      return firestoreContext.runTransaction(async (transaction) => {
        const { storageFileGroupDocument } = await createStorageFileGroupInTransaction({ storageFileGroupRelatedModelKey }, transaction);
        return storageFileGroupDocument;
      });
    };
  });
}

export interface SyncStorageFileWithGroupsInTransactionInput {
  readonly storageFileDocument: StorageFileDocument;
  /**
   * The loaded StorageFile. Must be loaded within the transaction.
   */
  readonly storageFile?: Maybe<StorageFile>;
  /**
   * If true, ignores the StorageFile gs flag and forces the sync to run.
   */
  readonly force?: Maybe<boolean>;
  /**
   * If true, removes all the storage file groups instead of adding them.
   */
  readonly removeAllStorageFileGroups?: Maybe<true | StorageFileGroupId[]>;
  /**
   * If true, will not update the StorageFileDocument.
   *
   * Defaults to false
   */
  readonly skipStorageFileUpdate?: Maybe<boolean>;
}

/**
 * Internal factory that creates a function for syncing a {@link StorageFile} with its
 * associated {@link StorageFileGroup} documents within a Firestore transaction.
 *
 * Adds the storage file to groups it is missing from, removes it from groups when requested,
 * and optionally creates new groups for references that do not yet exist.
 *
 * @param context - the storage file server actions context
 * @returns an async function that syncs a storage file with its groups within a transaction
 */
export function _syncStorageFileWithGroupsInTransactionFactory(context: StorageFileServerActionsContext) {
  const { storageFileCollection, storageFileGroupCollection } = context;
  const createStorageFileGroupInTransaction = createStorageFileGroupInTransactionFactory(context);

  return async (input: SyncStorageFileWithGroupsInTransactionInput, transaction: Transaction) => {
    const { storageFileDocument, storageFile: inputStorageFile, force, removeAllStorageFileGroups, skipStorageFileUpdate } = input;

    const storageFileDocumentInTransaction = storageFileCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(storageFileDocument);
    const storageFileGroupDocumentAccessor = storageFileGroupCollection.documentAccessorForTransaction(transaction);

    const storageFile = inputStorageFile ?? (await assertSnapshotData(storageFileDocumentInTransaction));

    if (!storageFile.gs && !force) {
      throw storageFileNotFlaggedForGroupsSyncError();
    }

    const g = storageFile.g;
    const storageFileGroupDocuments = loadDocumentsForIds(storageFileGroupDocumentAccessor, g);
    const storageFileGroupPairs = await getDocumentSnapshotDataPairs(storageFileGroupDocuments);

    let storageFilesGroupsCreated = 0;
    let storageFilesGroupsUpdated = 0;

    await performAsyncTasks(storageFileGroupPairs, async (storageFileGroupPair) => {
      const { data: storageFileGroup, document: storageFileGroupDocument } = storageFileGroupPair;
      const existsInStorageFileGroup = storageFileGroup?.f.some((x) => x.s === storageFileDocument.id);
      const change: Maybe<'add' | 'remove'> = removeAllStorageFileGroups ? (existsInStorageFileGroup ? 'remove' : undefined) : !existsInStorageFileGroup ? 'add' : undefined;

      switch (change) {
        case 'add': {
          // add it if it doesn't exist
          const createTemplate = calculateStorageFileGroupEmbeddedFileUpdate({
            storageFileGroup: storageFileGroup ?? { f: [] },
            insert: [
              {
                s: storageFileDocument.id
              }
            ],
            allowRecalculateRegenerateFlag: false
          });

          if (!storageFileGroup) {
            // if the group does not exist, then create it
            await createStorageFileGroupInTransaction({ storageFileGroupDocument, template: createTemplate }, transaction);
            storageFilesGroupsCreated += 1;
          } else {
            // if the group exists, then update it
            await storageFileGroupDocument.update(createTemplate);
            storageFilesGroupsUpdated += 1;
          }

          break;
        }
        case 'remove': {
          // remove it
          const removeTemplate = calculateStorageFileGroupEmbeddedFileUpdate({
            storageFileGroup: storageFileGroup ?? { f: [] },
            remove: [storageFileDocument.id]
          });

          await storageFileGroupDocument.update(removeTemplate);
          storageFilesGroupsUpdated += 1;

          break;
        }
        case undefined:
          // no change needed
          break;
      }
    });

    const result: SyncStorageFileWithGroupsResult = {
      storageFilesGroupsCreated,
      storageFilesGroupsUpdated
    };

    // update the storage file to no longer be flagged for sync
    if (!skipStorageFileUpdate) {
      await storageFileDocumentInTransaction.update({
        gs: false
      });
    }

    return result;
  };
}

/**
 * Factory for the `syncStorageFileWithGroups` action.
 *
 * Syncs a single {@link StorageFile}'s embedded data into its associated {@link StorageFileGroup}
 * documents and clears the sync flag on completion.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that syncs a StorageFile with its groups
 */
export function syncStorageFileWithGroupsFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const syncStorageFileWithGroupsInTransaction = _syncStorageFileWithGroupsInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(syncStorageFileWithGroupsParamsType, async (params) => {
    const { force } = params;

    return async (storageFileDocument: StorageFileDocument) => {
      return firestoreContext.runTransaction(async (transaction) => syncStorageFileWithGroupsInTransaction({ storageFileDocument, force }, transaction));
    };
  });
}

/**
 * Factory for the `syncAllFlaggedStorageFilesWithGroups` action.
 *
 * Batch-processes all {@link StorageFile} documents flagged for group sync,
 * updating their associated {@link StorageFileGroup} documents and flagging
 * groups for content regeneration when changes occur.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that returns batch sync results
 */
export function syncAllFlaggedStorageFilesWithGroupsFactory(context: StorageFileServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, storageFileCollection } = context;
  const syncStorageFileWithGroups = syncStorageFileWithGroupsFactory(context);

  return firebaseServerActionTransformFunctionFactory(syncAllFlaggedStorageFilesWithGroupsParamsType, async (_params) => {
    return async () => {
      const syncStorageFileWithGroupsInstance = await syncStorageFileWithGroups({
        key: firestoreDummyKey(),
        force: true // force anyways; they should all be flagged for sync when the query hits
      } as SyncStorageFileWithGroupsParams);

      let storageFilesSynced = 0;
      let storageFilesGroupsCreated = 0;
      let storageFilesGroupsUpdated = 0;

      await iterateFirestoreDocumentSnapshotPairBatches({
        documentAccessor: storageFileCollection.documentAccessor(),
        iterateSnapshotPairsBatch: async (snapshotPairBatch: FirestoreDocumentSnapshotDataPairWithData<StorageFileDocument>[]) => {
          // only sync StorageFiles that are flagged for sync
          await runAsyncTasksForValues(
            snapshotPairBatch.filter((x) => x.data.gs),
            async (snapshotPair) => {
              const { document: storageFileDocument } = snapshotPair;

              const result = await syncStorageFileWithGroupsInstance(storageFileDocument);

              storageFilesSynced += 1;
              storageFilesGroupsCreated += result.storageFilesGroupsCreated;
              storageFilesGroupsUpdated += result.storageFilesGroupsUpdated;
            },
            {
              maxParallelTasks: 10, // can update 10 storageFiles/Groups at the same time
              nonConcurrentTaskKeyFactory: (x) => x.data.g // do not update the same group at the same time
            }
          );
        },
        queryFactory: storageFileCollection,
        constraintsFactory: () => storageFileFlaggedForSyncWithGroupsQuery(),
        performTasksConfig: {
          sequential: true // run batches sequentially to avoid contention in updating a StorageFileGroup
        },
        totalSnapshotsLimit: 1000,
        limitPerCheckpoint: 100
      });

      const result: SyncAllFlaggedStorageFilesWithGroupsResult = {
        storageFilesSynced,
        storageFilesGroupsCreated,
        storageFilesGroupsUpdated
      };

      return result;
    };
  });
}

/**
 * Factory for the `regenerateStorageFileGroupContent` action.
 *
 * Regenerates the content of a single {@link StorageFileGroup}, including building a ZIP
 * archive from the group's embedded files and updating the group's content metadata.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that regenerates a StorageFileGroup's content
 */
export function regenerateStorageFileGroupContentFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, storageService, storageFileCollection, storageFileGroupCollection, firebaseServerActionTransformFunctionFactory } = context;
  const processStorageFileInTransaction = _processStorageFileInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(regenerateStorageFileGroupContentParamsType, async (params) => {
    const { force } = params;

    const createStorageFileDocumentPair = createStorageFileDocumentPairFactory({
      defaultCreationType: StorageFileCreationType.FOR_STORAGE_FILE_GROUP
    });

    return async (storageFileGroupDocument: StorageFileGroupDocument) => {
      return firestoreContext.runTransaction(async (transaction) => {
        const storageFileGroupDocumentInTransaction = storageFileGroupCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(storageFileGroupDocument);
        const storageFileGroup = await assertSnapshotData(storageFileGroupDocumentInTransaction);

        const storageFileDocumentAccessor = storageFileCollection.documentAccessorForTransaction(transaction);

        const { o, zsf, s } = storageFileGroup;

        // must not be queued for initialization
        if (s) {
          throw storageFileGroupQueuedForInitializationError();
        }

        const existingZipStorageFileDocument = zsf ? storageFileDocumentAccessor.loadDocumentForId(zsf) : undefined;

        const [existingZipStorageFilePair] = await Promise.all([existingZipStorageFileDocument ? getDocumentSnapshotDataPair(existingZipStorageFileDocument) : undefined]);

        let contentStorageFilesFlaggedForProcessing = 0;

        const updateTemplate: Partial<StorageFileGroup> = {
          re: false // clear the regeneration flag
        };

        // For each content type, create/update/flag the StorageFile for processing that type
        const { regenerateZip } = calculateStorageFileGroupRegeneration({ storageFileGroup, force });

        if (regenerateZip) {
          // check that the storageFile exists, and if it doesn't, create a new one
          if (!existingZipStorageFilePair?.data) {
            const zipStorageFile = storageService.file(storageFileGroupZipFileStoragePath(storageFileGroupDocument.id));

            // create a new StorageFile
            const { storageFileDocument } = await createStorageFileDocumentPair<StorageFileGroupZipStorageFileMetadata>({
              storagePathRef: zipStorageFile,
              accessor: storageFileDocumentAccessor,
              parentStorageFileGroup: storageFileGroupDocument,
              purpose: STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE,
              shouldBeProcessed: true,
              ownershipKey: o,
              metadata: {
                sfg: storageFileGroupDocument.id
              }
            });

            updateTemplate.zsf = storageFileDocument.id;
          } else {
            // flag it for processing again
            await processStorageFileInTransaction({ params: { processAgainIfSuccessful: true }, storageFileDocument: existingZipStorageFilePair.document, storageFile: existingZipStorageFilePair.data }, transaction);
          }

          contentStorageFilesFlaggedForProcessing += 1;
        }

        // update the StorageFileGroup
        await storageFileGroupDocumentInTransaction.update(updateTemplate);

        const result: RegenerateStorageFileGroupContentResult = {
          contentStorageFilesFlaggedForProcessing
        };

        return result;
      });
    };
  });
}

/**
 * Factory for the `regenerateAllFlaggedStorageFileGroupsContent` action.
 *
 * Batch-processes all {@link StorageFileGroup} documents flagged for content regeneration,
 * rebuilding their ZIP archives and updating content metadata.
 *
 * @param context - the storage file server actions context
 * @returns an async transform-and-validate function that returns batch regeneration results
 */
export function regenerateAllFlaggedStorageFileGroupsContentFactory(context: StorageFileServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, storageFileGroupCollection } = context;
  const regenerateStorageFileGroupContent = regenerateStorageFileGroupContentFactory(context);

  return firebaseServerActionTransformFunctionFactory(regenerateAllFlaggedStorageFileGroupsContentParamsType, async (_params) => {
    return async () => {
      const regenerateStorageFileGroupContentInstance = await regenerateStorageFileGroupContent({
        key: firestoreDummyKey()
      } as RegenerateStorageFileGroupContentParams);

      let storageFileGroupsUpdated = 0;
      let contentStorageFilesFlaggedForProcessing = 0;

      await iterateFirestoreDocumentSnapshotPairs({
        documentAccessor: storageFileGroupCollection.documentAccessor(),
        iterateSnapshotPair: async (snapshotPair: FirestoreDocumentSnapshotDataPairWithData<StorageFileGroupDocument>) => {
          const { data: storageFileGroup } = snapshotPair;

          if (!storageFileGroup.s) {
            const result = await regenerateStorageFileGroupContentInstance(snapshotPair.document);

            storageFileGroupsUpdated += 1;
            contentStorageFilesFlaggedForProcessing += result.contentStorageFilesFlaggedForProcessing;
          }
        },
        queryFactory: storageFileGroupCollection,
        constraintsFactory: () => storageFileGroupsFlaggedForContentRegenerationQuery(),
        performTasksConfig: {
          maxParallelTasks: 10
        },
        totalSnapshotsLimit: 1000,
        limitPerCheckpoint: 100
      });

      const result: RegenerateAllFlaggedStorageFileGroupsContentResult = {
        storageFileGroupsUpdated,
        contentStorageFilesFlaggedForProcessing
      };

      return result;
    };
  });
}
