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
  type DownloadStorageFileResult
} from '@dereekb/firebase';
import { assertSnapshotData, type FirebaseServerStorageServiceRef, type FirebaseServerActionsContext, type FirebaseServerAuthServiceRef, internalServerError } from '@dereekb/firebase-server';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { type InjectionToken } from '@nestjs/common';
import { type NotificationExpediteServiceRef } from '../notification';
import { type StorageFileInitializeFromUploadResult, type StorageFileInitializeFromUploadServiceRef } from './storagefile.upload.service';
import { uploadedFileIsNotAllowedToBeInitializedError, uploadedFileDoesNotExistError, uploadedFileInitializationFailedError, uploadedFileInitializationDiscardedError, storageFileProcessingNotAvailableForTypeError, storageFileAlreadySuccessfullyProcessedError, storageFileProcessingNotAllowedForInvalidStateError, storageFileProcessingNotQueuedForProcessingError, storageFileNotFlaggedForDeletionError, storageFileCannotBeDeletedYetError } from './storagefile.error';
import { expirationDetails, isPast, isThrottled, type Maybe, mergeSlashPaths } from '@dereekb/util';
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
  abstract downloadStorageFile(params: DownloadStorageFileParams): Promise<TransformAndValidateFunctionResult<DownloadStorageFileParams, (storageFileDocument: StorageFileDocument) => Promise<DownloadStorageFileResult>>>;
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
    downloadStorageFile: downloadStorageFileFactory(context)
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

      await iterateFirestoreDocumentSnapshotPairs({
        documentAccessor: storageFileCollection.documentAccessor(),
        iterateSnapshotPair: async (snapshotPair) => {
          storageFilesVisited++;

          const processStorageFileResult = await processStorageFile(snapshotPair.document).catch(() => null);

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

export function processStorageFileFactory(context: StorageFileServerActionsContext) {
  const { storageFileCollection, notificationCollectionGroup, firestoreContext, notificationExpediteService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(ProcessStorageFileParams, async (params) => {
    const { runImmediately, checkRetryProcessing, forceRestartProcessing } = params;

    return async (storageFileDocument: StorageFileDocument) => {
      const result: ProcessStorageFileResult = {};

      const expediteInstance = notificationExpediteService.expediteInstance();

      await firestoreContext.runTransaction(async (transaction) => {
        expediteInstance.initialize();

        const storageFileDocumentInTransaction = await storageFileCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(storageFileDocument);
        const storageFile = await assertSnapshotData(storageFileDocumentInTransaction);

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

          expediteInstance.enqueueCreateResult(createNotificationTaskResult);
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
            } else if (checkRetryProcessing || shouldCheckProcessing) {
              const { pn } = storageFile;
              const notificationDocument = notificationCollectionGroup.documentAccessorForTransaction(transaction).loadDocumentForKey(pn);
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
            }
            break;
          case StorageFileProcessingState.DO_NOT_PROCESS:
            throw storageFileProcessingNotQueuedForProcessingError();
          case StorageFileProcessingState.SUCCESS:
            throw storageFileAlreadySuccessfullyProcessedError();
        }
      });

      // expedite the task if requested
      if (runImmediately) {
        await expediteInstance.send();
      }

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
  const { storageService, storageFileCollection, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(DeleteStorageFileParams, async (params) => {
    const { force } = params;
    return async (inputStorageFileDocument: StorageFileDocument) => {
      const storageFileDocument = await storageFileCollection.documentAccessor().loadDocumentFrom(inputStorageFileDocument);

      const storageFile = await assertSnapshotData(storageFileDocument);
      const fileAccessor = storageService.file(storageFile);

      if (!force) {
        if (!storageFile.sdat) {
          throw storageFileNotFlaggedForDeletionError();
        } else if (!isPast(storageFile.sdat)) {
          throw storageFileCannotBeDeletedYetError();
        }
      }

      // delete the file
      await fileAccessor.delete().catch(() => null);

      // delete the document
      await storageFileDocument.accessor.delete();
    };
  });
}

export function downloadStorageFileFactory(context: StorageFileServerActionsContext) {
  const { storageService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(DownloadStorageFileParams, async (params) => {
    const { asAdmin, expiresAt, expiresIn, responseDisposition, responseContentType } = params;

    return async (storageFileDocument: StorageFileDocument) => {
      const storageFile = await assertSnapshotData(storageFileDocument);
      const fileAccessor = storageService.file(storageFile);

      let result: DownloadStorageFileResult;

      if (fileAccessor.getSignedUrl) {
        const expires = expirationDetails({ expiresAt, expiresIn });
        let downloadUrlExpiresAt = expires.getExpirationDate();

        // if they're not an admin, limit the expiration to a max of 30 days.
        if (downloadUrlExpiresAt && !asAdmin) {
          const maxExpirationDate = addDays(new Date(), 30);
          downloadUrlExpiresAt = findMinDate([downloadUrlExpiresAt, maxExpirationDate]);
        }

        const downloadUrl = await fileAccessor.getSignedUrl({
          action: 'read',
          expiresAt: downloadUrlExpiresAt ?? undefined,
          responseDisposition: responseDisposition ?? undefined, // can be set by anyone
          responseType: asAdmin ? (responseContentType ?? undefined) : undefined // can only be set by admins
        });

        result = {
          url: downloadUrl
        };
      } else {
        throw internalServerError('Signed url function appears to not be avalable.');
      }

      return result;
    };
  });
}
