import {
  type FirestoreContextReference,
  InitializeStorageFileFromUploadParams,
  type AsyncStorageFileCreateAction,
  type StorageFileFirestoreCollections,
  ProcessStorageFileParams,
  type StorageFileDocument,
  type ProcessStorageFileResult,
  CreateStorageFileParams,
  type AsyncStorageFileUpdateAction,
  UpdateStorageFileParams,
  type NotificationFirestoreCollections,
  UPLOADS_FOLDER_PATH,
  iterateStorageListFilesByEachFile,
  type FirebaseStorageAccessorFile,
  type InitializeAllStorageFilesFromUploadsResult,
  InitializeAllStorageFilesFromUploadsParams,
  type StorageFileKey,
  StorageFileProcessingState,
  StorageFileState,
  storageFileProcessingNotificationTaskTemplate,
  createNotificationDocument,
  ProcessAllQueuedStorageFilesParams,
  type ProcessAllQueuedStorageFilesResult,
  iterateFirestoreDocumentSnapshotPairs,
  DeleteAllQueuedStorageFilesParams,
  type DeleteAllQueuedStorageFilesResult,
  DeleteStorageFileParams,
  storageFilesQueuedForProcessingQuery,
  type AsyncStorageFileDeleteAction,
  type StorageFile,
  STORAGE_FILE_PROCESSING_STUCK_THROTTLE_CHECK_MS,
  storageFilesQueuedForDeleteQuery,
  firestoreDummyKey,
  DownloadStorageFileParams,
  type DownloadStorageFileResult,
  SyncStorageFileWithGroupsParams,
  SyncAllFlaggedStorageFilesWithGroupsParams,
  type SyncAllFlaggedStorageFilesWithGroupsResult,
  type SyncStorageFileWithGroupsResult,
  type FirestoreDocumentSnapshotDataPairWithData,
  RegenerateAllFlaggedStorageFileGroupsContentParams,
  type RegenerateAllFlaggedStorageFileGroupsContentResult,
  RegenerateStorageFileGroupContentParams,
  type RegenerateStorageFileGroupContentResult,
  type StorageFileGroupDocument,
  storageFileFlaggedForSyncWithGroupsQuery,
  iterateFirestoreDocumentSnapshotPairBatches,
  loadDocumentsForIds,
  getDocumentSnapshotDataPairs,
  storageFileGroupsFlaggedForContentRegenerationQuery,
  type AsyncStorageFileGroupCreateAction,
  CreateStorageFileGroupParams,
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
  type StorageFileGroupId
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
import { expirationDetails, isPast, isThrottled, type Maybe, mergeSlashPaths, MS_IN_MINUTE, performAsyncTasks, runAsyncTasksForValues, slashPathDetails, unixDateTimeSecondsNumberFromDate } from '@dereekb/util';
import { type HttpsError } from 'firebase-functions/https';
import { findMinDate } from '@dereekb/date';
import { addDays } from 'date-fns';

/**
 * Injection token for the BaseStorageFileServerActionsContext
 */
export const BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT';

/**
 * Injection token for the StorageFileServerActionsContext
 */
export const STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN: InjectionToken = 'STORAGE_FILE_SERVER_ACTION_CONTEXT';

export interface BaseStorageFileServerActionsContext extends FirebaseServerActionsContext, NotificationFirestoreCollections, NotificationExpediteServiceRef, StorageFileFirestoreCollections, FirebaseServerAuthServiceRef, FirebaseServerStorageServiceRef, FirestoreContextReference {}
export interface StorageFileServerActionsContext extends BaseStorageFileServerActionsContext, StorageFileInitializeFromUploadServiceRef {}

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
  abstract createStorageFileGroup(params: CreateStorageFileGroupParams): AsyncStorageFileGroupCreateAction<CreateStorageFileGroupParams>;
  abstract syncStorageFileWithGroups(params: SyncStorageFileWithGroupsParams): Promise<TransformAndValidateFunctionResult<SyncStorageFileWithGroupsParams, (storageFileDocument: StorageFileDocument) => Promise<SyncStorageFileWithGroupsResult>>>;
  abstract syncAllFlaggedStorageFilesWithGroups(params: SyncAllFlaggedStorageFilesWithGroupsParams): Promise<TransformAndValidateFunctionResult<SyncAllFlaggedStorageFilesWithGroupsParams, () => Promise<SyncAllFlaggedStorageFilesWithGroupsResult>>>;
  abstract regenerateStorageFileGroupContent(params: RegenerateStorageFileGroupContentParams): Promise<TransformAndValidateFunctionResult<RegenerateStorageFileGroupContentParams, (storageFileGroupDocument: StorageFileGroupDocument) => Promise<RegenerateStorageFileGroupContentResult>>>;
  abstract regenerateAllFlaggedStorageFileGroupsContent(params: RegenerateAllFlaggedStorageFileGroupsContentParams): Promise<TransformAndValidateFunctionResult<RegenerateAllFlaggedStorageFileGroupsContentParams, () => Promise<RegenerateAllFlaggedStorageFileGroupsContentResult>>>;
}

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
    createStorageFileGroup: createStorageFileGroupFactory(context),
    syncStorageFileWithGroups: syncStorageFileWithGroupsFactory(context),
    syncAllFlaggedStorageFilesWithGroups: syncAllFlaggedStorageFilesWithGroupsFactory(context),
    regenerateStorageFileGroupContent: regenerateStorageFileGroupContentFactory(context),
    regenerateAllFlaggedStorageFileGroupsContent: regenerateAllFlaggedStorageFileGroupsContentFactory(context)
  };
}

// MARK: Actions
export function createStorageFileFactory(context: BaseStorageFileServerActionsContext) {
  const { storageFileCollection, firestoreContext, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(CreateStorageFileParams, async (params) => {
    const {} = params;

    return async () => {
      const storageFileDocument = null as any;

      // TODO: check the file exists, and pull the metadata, and create the document

      return storageFileDocument;
    };
  });
}

export function initializeAllStorageFilesFromUploadsFactory(context: StorageFileServerActionsContext) {
  const { storageService, firebaseServerActionTransformFunctionFactory } = context;
  const _initializeStorageFileFromUploadFile = _initializeStorageFileFromUploadFileFactory(context);

  return firebaseServerActionTransformFunctionFactory(InitializeAllStorageFilesFromUploadsParams, async (params) => {
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
}

export function _initializeStorageFileFromUploadFileFactory(context: StorageFileServerActionsContext) {
  const { storageFileInitializeFromUploadService } = context;

  return async (input: InitializeStorageFileFromUploadFileInput) => {
    const { file } = input;
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

export function initializeStorageFileFromUploadFactory(context: StorageFileServerActionsContext) {
  const { storageService, firebaseServerActionTransformFunctionFactory } = context;
  const _initializeStorageFileFromUploadFile = _initializeStorageFileFromUploadFileFactory(context);

  return firebaseServerActionTransformFunctionFactory(InitializeStorageFileFromUploadParams, async (params) => {
    const { bucketId, pathString } = params;

    return async () => {
      const file = storageService.file(bucketId == null ? pathString : { bucketId, pathString });
      return _initializeStorageFileFromUploadFile({ file });
    };
  });
}

export function updateStorageFileFactory(context: BaseStorageFileServerActionsContext) {
  const { storageFileCollection, firestoreContext, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(UpdateStorageFileParams, async (params) => {
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

export function processAllQueuedStorageFilesFactory(context: StorageFileServerActionsContext) {
  const { storageFileCollection, firebaseServerActionTransformFunctionFactory } = context;
  const processStorageFile = processStorageFileFactory(context);

  return firebaseServerActionTransformFunctionFactory(ProcessAllQueuedStorageFilesParams, async (params) => {
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
      case StorageFileProcessingState.PROCESSING:
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
      case StorageFileProcessingState.DO_NOT_PROCESS:
        throw storageFileProcessingNotQueuedForProcessingError();
      case StorageFileProcessingState.SUCCESS:
        if (forceRestartProcessing || processAgainIfSuccessful) {
          await beginProcessing(true);
        } else {
          throw storageFileAlreadyProcessedError();
        }
        break;
    }
  };
}

export function processStorageFileFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, notificationExpediteService, firebaseServerActionTransformFunctionFactory } = context;
  const processStorageFileInTransaction = _processStorageFileInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(ProcessStorageFileParams, async (params) => {
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

export function deleteAllQueuedStorageFilesFactory(context: StorageFileServerActionsContext) {
  const { storageFileCollection, firebaseServerActionTransformFunctionFactory } = context;
  const deleteStorageFile = deleteStorageFileFactory(context);

  return firebaseServerActionTransformFunctionFactory(DeleteAllQueuedStorageFilesParams, async (params) => {
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

export function deleteStorageFileFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, storageService, storageFileCollection, firebaseServerActionTransformFunctionFactory } = context;
  const syncStorageFileWithGroupsInTransaction = _syncStorageFileWithGroupsInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(DeleteStorageFileParams, async (params) => {
    const { force } = params;
    return async (inputStorageFileDocument: StorageFileDocument) => {
      await firestoreContext.runTransaction(async (transaction) => {
        const storageFileDocument = await storageFileCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(inputStorageFileDocument);

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

export function downloadStorageFileFactory(context: StorageFileServerActionsContext) {
  const { storageService, firebaseServerActionTransformFunctionFactory, storageFileCollection } = context;

  return firebaseServerActionTransformFunctionFactory(DownloadStorageFileParams, async (params) => {
    const { key: targetStorageFileDocumentKey, asAdmin, expiresAt, expiresIn: inputExpiresIn, responseDisposition, responseContentType } = params;

    return async (storageFileDocument?: Maybe<StorageFileDocument>) => {
      // if the StorageFileDocument was not provided, set it from the target key
      if (!storageFileDocument) {
        storageFileDocument = storageFileCollection.documentAccessor().loadDocumentForKey(targetStorageFileDocumentKey);
      }

      const storageFile = await assertSnapshotData(storageFileDocument);
      const fileAccessor = storageService.file(storageFile);

      let result: DownloadStorageFileResult;

      if (fileAccessor.getSignedUrl) {
        const expiresIn = inputExpiresIn ?? MS_IN_MINUTE * 30;
        const expires = expirationDetails({ defaultExpiresFromDateToNow: true, expiresAt, expiresIn });
        let downloadUrlExpiresAt = expires.getExpirationDate() as Date;

        // if they're not an admin, limit the expiration to a max of 30 days.
        if (downloadUrlExpiresAt && !asAdmin) {
          const maxExpirationDate = addDays(new Date(), 30);
          downloadUrlExpiresAt = findMinDate([downloadUrlExpiresAt, maxExpirationDate]) as Date;
        }

        const [downloadUrl, metadata] = await Promise.all([
          fileAccessor.getSignedUrl({
            action: 'read',
            expiresAt: downloadUrlExpiresAt ?? undefined,
            responseDisposition: responseDisposition ?? undefined, // can be set by anyone
            responseType: asAdmin ? (responseContentType ?? undefined) : undefined // can only be set by admins
          }),
          fileAccessor.getMetadata()
        ]);

        result = {
          url: downloadUrl,
          fileName: metadata.name ? slashPathDetails(metadata.name).end : undefined,
          mimeType: responseContentType ?? metadata.contentType,
          expiresAt: unixDateTimeSecondsNumberFromDate(downloadUrlExpiresAt)
        };
      } else {
        throw internalServerError('Signed url function appears to not be avalable.');
      }

      return result;
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

export function createStorageFileGroupFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, firebaseServerActionTransformFunctionFactory } = context;
  const createStorageFileGroupInTransaction = createStorageFileGroupInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(CreateStorageFileGroupParams, async (params) => {
    const { model, storageFileId } = params;

    const storageFileGroupRelatedModelKey = model ? model : storageFileId ? inferKeyFromTwoWayFlatFirestoreModelKey(storageFileId) : undefined;

    if (!storageFileGroupRelatedModelKey) {
      throw createStorageFileGroupInputError();
    }

    return async () => {
      const result = await firestoreContext.runTransaction(async (transaction) => {
        const { storageFileGroupDocument } = await createStorageFileGroupInTransaction({ storageFileGroupRelatedModelKey }, transaction);
        return storageFileGroupDocument;
      });

      return result;
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

    const g = storageFile.g ?? [];
    const storageFileGroupDocuments = loadDocumentsForIds(storageFileGroupDocumentAccessor, g);
    const storageFileGroupPairs = await getDocumentSnapshotDataPairs(storageFileGroupDocuments);

    let storageFilesGroupsCreated = 0;
    let storageFilesGroupsUpdated = 0;

    await performAsyncTasks(storageFileGroupPairs, async (storageFileGroupPair) => {
      const { data: storageFileGroup, document: storageFileGroupDocument } = storageFileGroupPair;
      const existsInStorageFileGroup = storageFileGroup?.f.some((x) => x.s === storageFileDocument.id);
      const change: Maybe<'add' | 'remove'> = removeAllStorageFileGroups ? (existsInStorageFileGroup ? 'remove' : undefined) : !existsInStorageFileGroup ? 'add' : undefined;

      switch (change) {
        case 'add':
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
        case 'remove':
          // remove it
          const removeTemplate = calculateStorageFileGroupEmbeddedFileUpdate({
            storageFileGroup: storageFileGroup ?? { f: [] },
            remove: [storageFileDocument.id]
          });

          await storageFileGroupDocument.update(removeTemplate);
          storageFilesGroupsUpdated += 1;

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

export function syncStorageFileWithGroupsFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, storageFileCollection, storageFileGroupCollection, firebaseServerActionTransformFunctionFactory } = context;
  const syncStorageFileWithGroupsInTransaction = _syncStorageFileWithGroupsInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(SyncStorageFileWithGroupsParams, async (params) => {
    const { force } = params;

    return async (storageFileDocument: StorageFileDocument) => {
      return firestoreContext.runTransaction(async (transaction) => syncStorageFileWithGroupsInTransaction({ storageFileDocument, force }, transaction));
    };
  });
}

export function syncAllFlaggedStorageFilesWithGroupsFactory(context: StorageFileServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, storageFileCollection } = context;
  const syncStorageFileWithGroups = syncStorageFileWithGroupsFactory(context);

  return firebaseServerActionTransformFunctionFactory(SyncAllFlaggedStorageFilesWithGroupsParams, async (params) => {
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

export function regenerateStorageFileGroupContentFactory(context: StorageFileServerActionsContext) {
  const { firestoreContext, storageService, storageFileCollection, storageFileGroupCollection, firebaseServerActionTransformFunctionFactory } = context;
  const processStorageFileInTransaction = _processStorageFileInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(RegenerateStorageFileGroupContentParams, async (params) => {
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

export function regenerateAllFlaggedStorageFileGroupsContentFactory(context: StorageFileServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, storageFileGroupCollection } = context;
  const regenerateStorageFileGroupContent = regenerateStorageFileGroupContentFactory(context);

  return firebaseServerActionTransformFunctionFactory(RegenerateAllFlaggedStorageFileGroupsContentParams, async (params) => {
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
