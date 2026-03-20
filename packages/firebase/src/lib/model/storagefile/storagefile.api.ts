import { type, type Type } from 'arktype';
import { type TargetModelParams, type OnCallCreateModelResult, type FirestoreModelKey } from '../../common';
import { firestoreModelKeyType, firestoreModelIdType } from '../../common/model/model/model.validator';
import { targetModelParamsType } from '../../common/model/model/model.param';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseCreateFunction } from '../../client';
import { type StorageFileSignedDownloadUrl, type StorageFileTypes } from './storagefile';
import { type StorageBucketId, type StoragePath, type StorageSlashPath } from '../../common/storage';
import { type ContentDispositionString, type ContentTypeMimeType, type Maybe, type Milliseconds, type UnixDateTimeSecondsNumber } from '@dereekb/util';
import { type StorageFileId } from './storagefile.id';
import { type SendNotificationResult } from '../notification/notification.api';
import { clearable, ARKTYPE_DATE_DTO_TYPE } from '@dereekb/model';

/**
 * Parameters for directly creating a new StorageFile document (no upload initialization).
 *
 * Typically used server-side or for testing. Validated with {@link createStorageFileParamsType}.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
  readonly expediteProcessing?: boolean;
}

export const initializeStorageFileFromUploadParamsType = type({
  'bucketId?': clearable('string'),
  pathString: 'string > 0',
  'expediteProcessing?': 'boolean'
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
// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeleteAllQueuedStorageFilesParams {}

export const deleteAllQueuedStorageFilesParamsType = type({}) as Type<DeleteAllQueuedStorageFilesParams>;

export interface DeleteAllQueuedStorageFilesResult {
  readonly storageFilesVisited: number;
  readonly storageFilesDeleted: number;
  readonly storageFilesFailedDeleting: number;
}

/**
 * Parameters for generating a signed download URL for a StorageFile.
 *
 * Supports custom expiration, content disposition, and content type overrides.
 * Admin downloads (`asAdmin`) allow longer expiration times. Validated with {@link downloadStorageFileParamsType}.
 */
export interface DownloadStorageFileParams extends TargetModelParams {
  readonly expiresAt?: Maybe<Date>;
  readonly expiresIn?: Maybe<Milliseconds>;
  readonly responseDisposition?: Maybe<ContentDispositionString>;
  readonly responseContentType?: Maybe<ContentTypeMimeType>;
  readonly asAdmin?: Maybe<boolean>;
}

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
  readonly force?: boolean;
}

export const syncStorageFileWithGroupsParamsType = targetModelParamsType.merge({
  'force?': 'boolean'
}) as Type<SyncStorageFileWithGroupsParams>;

export interface SyncStorageFileWithGroupsResult {
  readonly storageFilesGroupsCreated: number;
  readonly storageFilesGroupsUpdated: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
  readonly force?: boolean;
}

export const regenerateStorageFileGroupContentParamsType = targetModelParamsType.merge({
  'force?': 'boolean'
}) as Type<RegenerateStorageFileGroupContentParams>;

export interface RegenerateStorageFileGroupContentResult {
  readonly contentStorageFilesFlaggedForProcessing: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
  readonly throwErrorIfAlreadyInitialized?: boolean;
}

export const initializeStorageFileModelParamsType = targetModelParamsType.merge({
  'throwErrorIfAlreadyInitialized?': 'boolean'
}) as Type<InitializeStorageFileModelParams>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
  storageFile: ['create:_,fromUpload,allFromUpload', 'update:_,process,syncWithGroups' as any, 'delete:_', 'read:download'],
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
