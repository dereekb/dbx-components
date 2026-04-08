import { type, type Type } from 'arktype';
import { type TargetModelParams, type OnCallCreateModelResult, type FirestoreModelKey } from '../../common';
import { firestoreModelKeyType, firestoreModelIdType } from '../../common/model/model/model.validator';
import { targetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseCreateFunction } from '../../client';
import { type StorageFileSignedDownloadUrl, type StorageFileTypes } from './storagefile';
import { type StorageFileKey, type StorageFileId } from './storagefile.id';
import { type StorageBucketId, type StoragePath, type StorageSlashPath } from '../../common/storage';
import { type ContentDispositionString, type ContentTypeMimeType, type Maybe, type Milliseconds, type UnixDateTimeSecondsNumber } from '@dereekb/util';
import { type SendNotificationResult } from '../notification/notification.api';
import { clearable, ARKTYPE_DATE_DTO_TYPE } from '@dereekb/model';

export const DOWNLOAD_MULTIPLE_STORAGE_FILES_MIN_FILES = 1;
export const DOWNLOAD_MULTIPLE_STORAGE_FILES_MAX_FILES = 50;

/**
 * Parameters for directly creating a new StorageFile document (no upload initialization).
 *
 * Typically used server-side or for testing. Validated with {@link createStorageFileParamsType}.
 */
export interface CreateStorageFileParams {}

export const createStorageFileParamsType = type({}) as Type<CreateStorageFileParams>;

/**
 * Parameters for batch-initializing all files found in the uploads folder.
 *
 * Scans the uploads folder (or a custom path) and runs the upload determination/initialization
 * pipeline for each file found. Validated with {@link initializeAllStorageFilesFromUploadsParamsType}.
 */
export interface InitializeAllStorageFilesFromUploadsParams {
  readonly maxFilesToInitialize?: Maybe<number>;
  readonly folderPath?: Maybe<StorageSlashPath>;
  readonly overrideUploadsFolderPath?: Maybe<StorageSlashPath>;
}

export const initializeAllStorageFilesFromUploadsParamsType = type({
  'maxFilesToInitialize?': clearable('number'),
  'folderPath?': clearable('string'),
  'overrideUploadsFolderPath?': clearable('string')
}) as Type<InitializeAllStorageFilesFromUploadsParams>;

/**
 * Result of batch upload initialization, reporting visit and success/failure counts.
 */
export interface InitializeAllStorageFilesFromUploadsResult extends OnCallCreateModelResult {
  readonly filesVisited: number;
  readonly initializationsSuccessCount: number;
  readonly initializationsFailureCount: number;
}

/**
 * Parameters for initializing a single StorageFile from an uploaded file at a specific storage path.
 *
 * The file is run through the upload type determination pipeline and, if matched,
 * creates a corresponding StorageFile document. Validated with {@link initializeStorageFileFromUploadParamsType}.
 */
export interface InitializeStorageFileFromUploadParams extends Pick<StoragePath, 'pathString'> {
  readonly bucketId?: Maybe<StorageBucketId>;
  readonly pathString: StorageSlashPath;
  readonly expediteProcessing?: Maybe<boolean>;
}

export const initializeStorageFileFromUploadParamsType = type({
  'bucketId?': clearable('string'),
  pathString: 'string > 0',
  'expediteProcessing?': clearable('boolean')
}) as Type<InitializeStorageFileFromUploadParams>;

/**
 * Parameters for triggering processing of a specific StorageFile.
 *
 * Supports various modes: immediate processing, retry checking, force restart,
 * and reprocessing already-successful files. Validated with {@link processStorageFileParamsType}.
 */
export interface ProcessStorageFileParams extends TargetModelParams {
  readonly runImmediately?: Maybe<boolean>;
  readonly checkRetryProcessing?: Maybe<boolean>;
  readonly forceRestartProcessing?: Maybe<boolean>;
  readonly processAgainIfSuccessful?: Maybe<boolean>;
}

export const processStorageFileParamsType = targetModelParamsType.merge({
  'runImmediately?': clearable('boolean'),
  'checkRetryProcessing?': clearable('boolean'),
  'forceRestartProcessing?': clearable('boolean'),
  'processAgainIfSuccessful?': clearable('boolean')
}) as Type<ProcessStorageFileParams>;

export interface ProcessStorageFileResult {
  readonly runImmediately: boolean;
  readonly expediteResult: Maybe<SendNotificationResult>;
}

/**
 * Processes all StorageFiles that are queued for processing.
 */
export interface ProcessAllQueuedStorageFilesParams {}

export const processAllQueuedStorageFilesParamsType = type({}) as Type<ProcessAllQueuedStorageFilesParams>;

export interface ProcessAllQueuedStorageFilesResult {
  readonly storageFilesVisited: number;
  readonly storageFilesProcessStarted: number;
  readonly storageFilesFailedStarting: number;
}

export interface UpdateStorageFileParams extends TargetModelParams {
  readonly sdat?: Maybe<Date>;
}

export const updateStorageFileParamsType = targetModelParamsType.merge({
  'sdat?': clearable(ARKTYPE_DATE_DTO_TYPE)
}) as Type<UpdateStorageFileParams>;

export interface DeleteStorageFileParams extends TargetModelParams {
  readonly force?: Maybe<boolean>;
}

export const deleteStorageFileParamsType = targetModelParamsType.merge({
  'force?': clearable('boolean')
}) as Type<DeleteStorageFileParams>;

/**
 * Processes all StorageFiles that are queued for processing.
 */
export interface DeleteAllQueuedStorageFilesParams {}

export const deleteAllQueuedStorageFilesParamsType = type({}) as Type<DeleteAllQueuedStorageFilesParams>;

export interface DeleteAllQueuedStorageFilesResult {
  readonly storageFilesVisited: number;
  readonly storageFilesDeleted: number;
  readonly storageFilesFailedDeleting: number;
}

/**
 * Shared download options for StorageFile downloads.
 *
 * Supports custom expiration, content disposition, and content type overrides.
 * Admin downloads (`asAdmin`) allow longer expiration times.
 */
export interface DownloadStorageFileOptions {
  readonly expiresAt?: Maybe<Date>;
  readonly expiresIn?: Maybe<Milliseconds>;
  readonly responseDisposition?: Maybe<ContentDispositionString>;
  readonly responseContentType?: Maybe<ContentTypeMimeType>;
  readonly asAdmin?: Maybe<boolean>;
}

/**
 * Parameters for generating a signed download URL for a single StorageFile.
 *
 * Extends {@link DownloadStorageFileOptions} with target model key.
 * Validated with {@link downloadStorageFileParamsType}.
 */
export interface DownloadStorageFileParams extends TargetModelParams, DownloadStorageFileOptions {}

export const downloadStorageFileParamsType = targetModelParamsType.merge({
  'expiresAt?': clearable(ARKTYPE_DATE_DTO_TYPE),
  'expiresIn?': clearable('number >= 0'),
  'responseDisposition?': clearable('string'),
  'responseContentType?': clearable('string'),
  'asAdmin?': clearable('boolean')
}) as Type<DownloadStorageFileParams>;

/**
 * Result of downloading a StorageFile.
 */
export interface DownloadStorageFileResult {
  readonly url: StorageFileSignedDownloadUrl;
  readonly fileName?: Maybe<string>;
  readonly mimeType?: Maybe<ContentTypeMimeType>;
  readonly expiresAt?: Maybe<UnixDateTimeSecondsNumber>;
}

// MARK: Download Multiple
/**
 * Per-file download options, excluding `asAdmin` which is controlled at the batch level.
 *
 * Each per-file option overrides the corresponding default from the parent {@link DownloadMultipleStorageFilesParams}.
 */
export interface DownloadMultipleStorageFilesFileParams extends TargetModelParams, Omit<DownloadStorageFileOptions, 'asAdmin'> {}

export const downloadMultipleStorageFilesFileParamsType = targetModelParamsType.merge({
  'expiresAt?': clearable(ARKTYPE_DATE_DTO_TYPE),
  'expiresIn?': clearable('number >= 0'),
  'responseDisposition?': clearable('string'),
  'responseContentType?': clearable('string')
}) as Type<DownloadMultipleStorageFilesFileParams>;

/**
 * Success item in a batch download result.
 *
 * Extends the single-file {@link DownloadStorageFileResult} with the document key for correlation.
 */
export interface DownloadMultipleStorageFileSuccessItem extends DownloadStorageFileResult {
  readonly key: StorageFileKey;
}

/**
 * Error item in a batch download result.
 *
 * Includes the document key and a human-readable error message.
 */
export interface DownloadMultipleStorageFileErrorItem {
  readonly key: StorageFileKey;
  readonly error: string;
}

/**
 * Parameters for batch-downloading multiple StorageFiles.
 *
 * Top-level {@link DownloadStorageFileOptions} serve as defaults for all files.
 * Each item in `files` can override per-file options (except `asAdmin`, which is root-level only).
 * Validated with {@link downloadMultipleStorageFilesParamsType}.
 *
 * @example
 * ```ts
 * const params: DownloadMultipleStorageFilesParams = {
 *   expiresIn: 1800000,
 *   files: [
 *     { key: 'storageFile/abc' },
 *     { key: 'storageFile/def', expiresIn: 60000 }
 *   ]
 * };
 * ```
 */
export interface DownloadMultipleStorageFilesParams extends DownloadStorageFileOptions {
  readonly files: DownloadMultipleStorageFilesFileParams[];
  /**
   * When true, throws on the first download failure instead of collecting it in the errors array.
   */
  readonly throwOnFirstError?: Maybe<boolean>;
}

export const downloadMultipleStorageFilesParamsType = type({
  files: downloadMultipleStorageFilesFileParamsType.array().atLeastLength(DOWNLOAD_MULTIPLE_STORAGE_FILES_MIN_FILES).atMostLength(DOWNLOAD_MULTIPLE_STORAGE_FILES_MAX_FILES),
  'expiresAt?': clearable(ARKTYPE_DATE_DTO_TYPE),
  'expiresIn?': clearable('number >= 0'),
  'responseDisposition?': clearable('string'),
  'responseContentType?': clearable('string'),
  'asAdmin?': clearable('boolean'),
  'throwOnFirstError?': clearable('boolean')
}) as Type<DownloadMultipleStorageFilesParams>;

/**
 * Result of a batch StorageFile download.
 *
 * Contains separate arrays for successful downloads and failures.
 * Individual download errors do not fail the entire batch.
 */
export interface DownloadMultipleStorageFilesResult {
  readonly success: DownloadMultipleStorageFileSuccessItem[];
  readonly errors: DownloadMultipleStorageFileErrorItem[];
}

/**
 * Used for creating or initializing a new StorageFileGroup for a StorageFile.
 *
 * Mainly used for testing. Not exposed to the API.
 *
 * The preferred way is to create a StorageFileGroup through a StorageFile.
 */
export interface CreateStorageFileGroupParams {
  readonly model?: Maybe<FirestoreModelKey>;
  readonly storageFileId?: Maybe<StorageFileId>;
}

export const createStorageFileGroupParamsType = type({
  'model?': clearable(firestoreModelKeyType),
  'storageFileId?': clearable(firestoreModelIdType)
}) as Type<CreateStorageFileGroupParams>;

export interface SyncStorageFileWithGroupsParams extends TargetModelParams {
  readonly force?: Maybe<boolean>;
}

export const syncStorageFileWithGroupsParamsType = targetModelParamsType.merge({
  'force?': clearable('boolean')
}) as Type<SyncStorageFileWithGroupsParams>;

export interface SyncStorageFileWithGroupsResult {
  readonly storageFilesGroupsCreated: number;
  readonly storageFilesGroupsUpdated: number;
}

export interface SyncAllFlaggedStorageFilesWithGroupsParams {}

export const syncAllFlaggedStorageFilesWithGroupsParamsType = type({}) as Type<SyncAllFlaggedStorageFilesWithGroupsParams>;

export interface SyncAllFlaggedStorageFilesWithGroupsResult {
  readonly storageFilesSynced: number;
  readonly storageFilesGroupsCreated: number;
  readonly storageFilesGroupsUpdated: number;
}

export interface UpdateStorageFileGroupEntryParams {
  readonly s: StorageFileId;
  readonly n?: Maybe<string>;
}

export const updateStorageFileGroupEntryParamsType = type({
  s: firestoreModelIdType,
  'n?': clearable('string > 0')
}) as Type<UpdateStorageFileGroupEntryParams>;

export interface UpdateStorageFileGroupParams extends TargetModelParams {
  readonly entries?: Maybe<UpdateStorageFileGroupEntryParams[]>;
}

export const updateStorageFileGroupParamsType = targetModelParamsType.merge({
  'entries?': clearable(updateStorageFileGroupEntryParamsType.array())
}) as Type<UpdateStorageFileGroupParams>;

export interface RegenerateStorageFileGroupContentParams extends TargetModelParams {
  readonly force?: Maybe<boolean>;
}

export const regenerateStorageFileGroupContentParamsType = targetModelParamsType.merge({
  'force?': clearable('boolean')
}) as Type<RegenerateStorageFileGroupContentParams>;

export interface RegenerateStorageFileGroupContentResult {
  readonly contentStorageFilesFlaggedForProcessing: number;
}

export interface RegenerateAllFlaggedStorageFileGroupsContentParams {}

export const regenerateAllFlaggedStorageFileGroupsContentParamsType = type({}) as Type<RegenerateAllFlaggedStorageFileGroupsContentParams>;

export interface RegenerateAllFlaggedStorageFileGroupsContentResult {
  readonly storageFileGroupsUpdated: number;
  readonly contentStorageFilesFlaggedForProcessing: number;
}

/**
 * Used for initializing an uninitialized model like NotificationBox or NotificationSummary.
 */
export interface InitializeStorageFileModelParams extends TargetModelParams {
  readonly throwErrorIfAlreadyInitialized?: Maybe<boolean>;
}

export const initializeStorageFileModelParamsType = targetModelParamsType.merge({
  'throwErrorIfAlreadyInitialized?': clearable('boolean')
}) as Type<InitializeStorageFileModelParams>;

export interface InitializeAllApplicableStorageFileGroupsParams {}

export const initializeAllApplicableStorageFileGroupsParamsType = type({}) as Type<InitializeAllApplicableStorageFileGroupsParams>;

export interface InitializeAllApplicableStorageFileGroupsResult {
  readonly storageFileGroupsVisited: number;
  readonly storageFileGroupsSucceeded: number;
  readonly storageFileGroupsFailed: number;
  readonly storageFileGroupsAlreadyInitialized: number;
}

// MARK: Functions
/**
 * Custom (non-CRUD) function type map for StorageFile. Currently empty — all operations use CRUD functions.
 */
export type StorageFileFunctionTypeMap = {};

export const storageFileFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<StorageFileFunctionTypeMap> = {};

/**
 * CRUD function configuration map for the StorageFile model family.
 *
 * Defines all callable cloud function endpoints for StorageFile and StorageFileGroup,
 * including creation (direct, from upload, batch), processing, sync, download, and deletion.
 *
 * Used by {@link StorageFileFunctions} and {@link storageFileFunctionMap} to generate
 * typed callable function references.
 */
export type StorageFileModelCrudFunctionsConfig = {
  readonly storageFile: {
    create: {
      _: CreateStorageFileParams;
      fromUpload: InitializeStorageFileFromUploadParams;
      allFromUpload: [InitializeAllStorageFilesFromUploadsParams, InitializeAllStorageFilesFromUploadsResult];
    };
    update: {
      _: UpdateStorageFileParams;
      process: [ProcessStorageFileParams, ProcessStorageFileResult];
      syncWithGroups: [SyncStorageFileWithGroupsParams, SyncStorageFileWithGroupsResult];
    };
    read: {
      download: [DownloadStorageFileParams, DownloadStorageFileResult];
      downloadMultiple: [DownloadMultipleStorageFilesParams, DownloadMultipleStorageFilesResult];
    };
    delete: {
      _: DeleteStorageFileParams;
    };
  };
  readonly storageFileGroup: {
    update: {
      _: UpdateStorageFileGroupParams;
      regenerateContent: [RegenerateStorageFileGroupContentParams, RegenerateStorageFileGroupContentResult];
    };
  };
};

export const storageFileModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<StorageFileModelCrudFunctionsConfig, StorageFileTypes> = {
  storageFile: ['create:_,fromUpload,allFromUpload', 'update:_,process,syncWithGroups' as any, 'delete:_', 'read:download,downloadMultiple'],
  storageFileGroup: ['update:_,regenerateContent']
};

/**
 * Abstract class defining all callable StorageFile cloud functions.
 *
 * Implement this in your app module to wire up the function endpoints.
 * Use {@link storageFileFunctionMap} to create a client-side callable map.
 */
export abstract class StorageFileFunctions implements ModelFirebaseFunctionMap<StorageFileFunctionTypeMap, StorageFileModelCrudFunctionsConfig> {
  abstract storageFile: {
    createStorageFile: {
      create: ModelFirebaseCreateFunction<CreateStorageFileParams, OnCallCreateModelResult>;
      fromUpload: ModelFirebaseCreateFunction<InitializeStorageFileFromUploadParams, OnCallCreateModelResult>;
      allFromUpload: ModelFirebaseCrudFunction<InitializeAllStorageFilesFromUploadsParams, InitializeAllStorageFilesFromUploadsResult>;
    };
    updateStorageFile: {
      update: ModelFirebaseCrudFunction<UpdateStorageFileParams>;
      process: ModelFirebaseCrudFunction<ProcessStorageFileParams, ProcessStorageFileResult>;
      syncWithGroups: ModelFirebaseCrudFunction<SyncStorageFileWithGroupsParams, SyncStorageFileWithGroupsResult>;
    };
    readStorageFile: {
      download: ModelFirebaseCrudFunction<DownloadStorageFileParams, DownloadStorageFileResult>;
      downloadMultiple: ModelFirebaseCrudFunction<DownloadMultipleStorageFilesParams, DownloadMultipleStorageFilesResult>;
    };
    deleteStorageFile: {
      delete: ModelFirebaseCrudFunction<DeleteStorageFileParams>;
    };
  };
  abstract storageFileGroup: {
    updateStorageFileGroup: {
      update: ModelFirebaseCrudFunction<UpdateStorageFileGroupParams>;
      regenerateContent: ModelFirebaseCrudFunction<RegenerateStorageFileGroupContentParams, RegenerateStorageFileGroupContentResult>;
    };
  };
}

/**
 * Client-side callable function map factory for all StorageFile and StorageFileGroup CRUD operations.
 *
 * @example
 * ```ts
 * const functions = storageFileFunctionMap(callableFactory);
 * const result = await functions.storageFile.createStorageFile.fromUpload({ pathString: 'uploads/u/123/avatar.png' });
 * ```
 */
export const storageFileFunctionMap = callModelFirebaseFunctionMapFactory(storageFileFunctionTypeConfigMap, storageFileModelCrudFunctionsConfig);
