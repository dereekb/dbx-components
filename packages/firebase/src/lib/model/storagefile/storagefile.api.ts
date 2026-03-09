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
import { clearable } from '@dereekb/model';

/**
 * Used for directly create a new StorageFile.
 */
export interface CreateStorageFileParams {}

export const createStorageFileParamsType = type({}) as Type<CreateStorageFileParams>;

/**
 * Initializes all StorageFiles in the uploads folder.
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

export interface InitializeAllStorageFilesFromUploadsResult extends OnCallCreateModelResult {
  readonly filesVisited: number;
  readonly initializationsSuccessCount: number;
  readonly initializationsFailureCount: number;
}

/**
 * Initializes a StorageFile from the document at the given path.
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
  'sdat?': clearable('string.date.parse')
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

export interface DownloadStorageFileParams extends TargetModelParams {
  readonly expiresAt?: Maybe<Date>;
  readonly expiresIn?: Maybe<Milliseconds>;
  readonly responseDisposition?: Maybe<ContentDispositionString>;
  readonly responseContentType?: Maybe<ContentTypeMimeType>;
  readonly asAdmin?: Maybe<boolean>;
}

export const downloadStorageFileParamsType = targetModelParamsType.merge({
  'expiresAt?': clearable('string.date.parse'),
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

export interface InitializeAllApplicableStorageFileGroupsParams {}

export const initializeAllApplicableStorageFileGroupsParamsType = type({}) as Type<InitializeAllApplicableStorageFileGroupsParams>;

export interface InitializeAllApplicableStorageFileGroupsResult {
  readonly storageFileGroupsVisited: number;
  readonly storageFileGroupsSucceeded: number;
  readonly storageFileGroupsFailed: number;
  readonly storageFileGroupsAlreadyInitialized: number;
}

// MARK: Functions
export type StorageFileFunctionTypeMap = {};

export const storageFileFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<StorageFileFunctionTypeMap> = {};

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
  storageFileGroup: {
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

export const storageFileFunctionMap = callModelFirebaseFunctionMapFactory(storageFileFunctionTypeConfigMap, storageFileModelCrudFunctionsConfig);
