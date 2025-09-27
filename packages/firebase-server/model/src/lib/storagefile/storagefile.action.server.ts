import {
  type FirestoreContextReference,
  InitializeStorageFileFromUploadParams,
  AsyncStorageFileCreateAction,
  StorageFileFirestoreCollections,
  ProcessStorageFileParams,
  StorageFileDocument,
  ProcessStorageFileResult,
  CreateStorageFileParams,
  AsyncStorageFileUpdateAction,
  UpdateStorageFileParams,
  NotificationFirestoreCollections,
  UPLOADS_FOLDER_PATH,
  iterateStorageListFilesByEachFile,
  StorageListFileResult,
  FirebaseStorageAccessorFile,
  InitializeAllStorageFilesFromUploadsResult,
  InitializeAllStorageFilesFromUploadsParams,
  StorageFileKey
} from '@dereekb/firebase';
import { FirebaseServerStorageServiceRef, type FirebaseServerActionsContext, type FirebaseServerAuthServiceRef } from '@dereekb/firebase-server';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { type InjectionToken } from '@nestjs/common';
import { NotificationExpediteServiceRef } from '../notification';
import { StorageFileInitializeFromUploadResult, StorageFileInitializeFromUploadServiceRef } from './storagefile.upload.service';
import { uploadedFileIsNotAllowedToBeInitializedError, uploadedFileDoesNotExistError, uploadedFileInitializationFailedError, uploadedFileInitializationDiscardedError } from './storagefile.error';
import { Maybe, mergeSlashPaths } from '@dereekb/util';
import { HttpsError } from 'firebase-functions/https';

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
  abstract processStorageFile(params: ProcessStorageFileParams): Promise<TransformAndValidateFunctionResult<ProcessStorageFileParams, (storageFileDocument: StorageFileDocument) => Promise<ProcessStorageFileResult>>>;
}

export function storageFileServerActions(context: StorageFileServerActionsContext): StorageFileServerActions {
  return {
    createStorageFile: createStorageFileFactory(context),
    initializeAllStorageFilesFromUploads: initializeAllStorageFilesFromUploadsFactory(context),
    initializeStorageFileFromUpload: initializeStorageFileFromUploadFactory(context),
    updateStorageFile: updateStorageFileFactory(context),
    processStorageFile: processStorageFileFactory(context)
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

      let modelKeys: StorageFileKey[] = [];
      let filesVisited = 0;
      let initializationsSuccessCount = 0;
      let initializationsFailureCount = 0;

      await iterateStorageListFilesByEachFile({
        folder,
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

      switch (initializationResult.resultType) {
        case 'success':
          try {
            // can now delete the uploaded file
            await file.delete();
          } catch (e) {
            // log errors here, but do nothing.
            console.error(`initializeStorageFileFromUpload(): Error deleting successfully processed uploaded file (${bucketId}/${pathString})`, e);
          }

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
        case 'no_determiner_match':
        case 'no_initializer_configured':
        default:
          httpsError = uploadedFileInitializationFailedError({
            resultType: initializationResult.resultType
          });
          break;
      }
    } catch (e) {
      console.error(`initializeStorageFileFromUpload(): Error initializing storage file (${bucketId}/${pathString}) from upload`, e);
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
      const file = storageService.file({ bucketId, pathString });
      return _initializeStorageFileFromUploadFile({ file });
    };
  });
}

export function updateStorageFileFactory(context: BaseStorageFileServerActionsContext) {
  const { storageFileCollection, firestoreContext, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(UpdateStorageFileParams, async (params) => {
    const {} = params;

    return async (storageFileDocument: StorageFileDocument) => {
      // todo: ...

      return storageFileDocument;
    };
  });
}

export function processStorageFileFactory(context: StorageFileServerActionsContext) {
  const { storageFileCollection, firestoreContext, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(ProcessStorageFileParams, async (params) => {
    const {} = params;

    return async (storageFileDocument: StorageFileDocument) => {
      // todo: ...

      const result: ProcessStorageFileResult = {};

      return result;
    };
  });
}
