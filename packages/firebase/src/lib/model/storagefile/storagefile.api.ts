import { Expose, Type } from 'class-transformer';
import { TargetModelParams, OnCallCreateModelResult, FirestoreModelKey, IsFirestoreModelKey, IsFirestoreModelId } from '../../common';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, ModelFirebaseCreateFunction } from '../../client';
import { IsString, IsBoolean, IsOptional, IsNumber, IsDate, Min, IsMimeType, IsNotEmpty } from 'class-validator';
import { StorageFileSignedDownloadUrl, StorageFileTypes } from './storagefile';
import { type StorageBucketId, type StoragePath, type StorageSlashPath } from '../../common/storage';
import { ContentDispositionString, ContentTypeMimeType, Maybe, Milliseconds, UnixDateTimeSecondsNumber } from '@dereekb/util';
import { StorageFileId } from './storagefile.id';
import { SendNotificationResult } from '../notification/notification.api';

/**
 * Used for directly create a new StorageFile.
 */
export class CreateStorageFileParams {}

/**
 * Initializes all StorageFiles in the uploads folder.
 */
export class InitializeAllStorageFilesFromUploadsParams {
  /**
   * The maximum number of files to initialize at once.
   */
  @Expose()
  @IsNumber()
  @IsOptional()
  maxFilesToInitialize?: Maybe<number>;

  /**
   * The specific folder under the uploads folder to search for files and initialize
   */
  @Expose()
  @IsString()
  @IsOptional()
  folderPath?: Maybe<StorageSlashPath>;

  /**
   * Overrides the default uploads folder path.
   */
  @Expose()
  @IsString()
  @IsOptional()
  overrideUploadsFolderPath?: Maybe<StorageSlashPath>;
}

export interface InitializeAllStorageFilesFromUploadsResult extends OnCallCreateModelResult {
  readonly filesVisited: number;
  readonly initializationsSuccessCount: number;
  readonly initializationsFailureCount: number;
}

/**
 * Initializes a StorageFile from the document at the given path.
 */
export class InitializeStorageFileFromUploadParams implements Pick<StoragePath, 'pathString'> {
  /**
   * Specific bucketId to use.
   *
   * If not defined, the default bucket will be used.
   */
  @Expose()
  @IsOptional()
  @IsString()
  bucketId?: Maybe<StorageBucketId>;

  @Expose()
  @IsString()
  pathString!: StorageSlashPath;

  /**
   * Whether or not to attempt to expedite the processing of the created StorageFile, if it is queued for processing.
   *
   * If it cannot be processed, this argument will have no effect.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  expediteProcessing?: boolean;
}

export class ProcessStorageFileParams extends TargetModelParams {
  /**
   * If set, will start/run the processing immediately instead of waiting for the next scheduled run.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  runImmediately?: Maybe<boolean>;

  /**
   * If set, will check and retry processing if the StorageFile is in a failed processing state.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  checkRetryProcessing?: Maybe<boolean>;

  /**
   * Used with checkRetryProcessing.
   *
   * If set, will forcibly create a new processing task even if the existing processing task appears to be ok, or if processing was already marked complete.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  forceRestartProcessing?: Maybe<boolean>;

  /**
   * If set, will start the processing again if the StorageFile is in a successful processing state.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  processAgainIfSuccessful?: Maybe<boolean>;
}

export interface ProcessStorageFileResult {
  /**
   * Whether or not the StorageFile was run immediately.
   */
  readonly runImmediately: boolean;
  /**
   * The expedite result, if runImmediately returned true.
   */
  readonly expediteResult: Maybe<SendNotificationResult>;
}

/**
 * Processes all StorageFiles that are queued for processing.
 */
export class ProcessAllQueuedStorageFilesParams {}

export interface ProcessAllQueuedStorageFilesResult {
  /**
   * The total number of StorageFiles visited.
   */
  readonly storageFilesVisited: number;
  /**
   * The total number of StorageFiles that started processing.
   */
  readonly storageFilesProcessStarted: number;
  /**
   * The total number of StorageFiles that failed to start processing.
   */
  readonly storageFilesFailedStarting: number;
}

export class UpdateStorageFileParams extends TargetModelParams {
  /**
   * Sets the delete at time for the given StorageFileDocument, and queues the file for deletion.
   */
  @Expose()
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  sdat?: Maybe<Date>;
}

export class DeleteStorageFileParams extends TargetModelParams {
  /**
   * If true, will force the deletion of the StorageFile even if it is not queued for deletion.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  force?: Maybe<boolean>;
}

/**
 * Processes all StorageFiles that are queued for processing.
 */
export class DeleteAllQueuedStorageFilesParams {}

export interface DeleteAllQueuedStorageFilesResult {
  /**
   * The total number of StorageFiles visited.
   */
  readonly storageFilesVisited: number;
  /**
   * The total number of StorageFiles that were deleted.
   */
  readonly storageFilesDeleted: number;
  /**
   * The total number of StorageFiles that failed to delete.
   */
  readonly storageFilesFailedDeleting: number;
}

export class DownloadStorageFileParams extends TargetModelParams {
  /**
   * Date to expire the download URL.
   */
  @Expose()
  @IsDate()
  @IsOptional()
  @Type(() => Date)
  expiresAt?: Maybe<Date>;

  /**
   * Duration in milliseconds to expire the download URL from now.
   */
  @Expose()
  @Min(0)
  @IsNumber()
  @IsOptional()
  expiresIn?: Maybe<Milliseconds>;

  /**
   * The content disposition for the response to use.
   */
  @Expose()
  @IsOptional()
  @IsString()
  responseDisposition?: Maybe<ContentDispositionString>;

  /**
   * The content type for the response to use.
   *
   * Only available to admins.
   */
  @Expose()
  @IsOptional()
  @IsString()
  @IsMimeType()
  responseContentType?: Maybe<ContentTypeMimeType>;

  /**
   * Whether or not an admin is creating the link.
   *
   * Allows a longer expiration.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  asAdmin?: Maybe<boolean>;
}

/**
 * Result of downloading a StorageFile.
 */
export interface DownloadStorageFileResult {
  /**
   * The download URL.
   */
  readonly url: StorageFileSignedDownloadUrl;
  /**
   * The name of the StorageFile, if available.
   */
  readonly fileName?: Maybe<string>;
  /**
   * The mime type of the StorageFile, if available.
   */
  readonly mimeType?: Maybe<ContentTypeMimeType>;
  /**
   * Expiration time as a UnixDateTimeSecondsNumber value.
   */
  readonly expiresAt?: Maybe<UnixDateTimeSecondsNumber>;
}

/**
 * Used for creating or initializing a new StorageFileGroup for a StorageFile.
 *
 * Mainly used for testing. Not exposed to the API.
 *
 * The preferred way is to create a StorageFileGroup through a StorageFile.
 */
export class CreateStorageFileGroupParams {
  /**
   * ModelKey to use for creating the StorageFileGroup.
   */
  @Expose()
  @IsOptional()
  @IsNotEmpty()
  @IsFirestoreModelKey()
  model?: Maybe<FirestoreModelKey>;

  /**
   * StorageFileId to use for creating the StorageFileGroup.
   */
  @Expose()
  @IsNotEmpty()
  @IsFirestoreModelId()
  storageFileId?: Maybe<StorageFileId>;
}

export class SyncStorageFileWithGroupsParams extends TargetModelParams {
  /**
   * If true, will force syncing even if the StorageFile is not flagged for a resync.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}

export interface SyncStorageFileWithGroupsResult {
  /**
   * The number of StorageFileGroups that were created.
   */
  readonly storageFilesGroupsCreated: number;
  /**
   * The number of StorageFileGroups that were updated.
   */
  readonly storageFilesGroupsUpdated: number;
}

export class SyncAllFlaggedStorageFilesWithGroupsParams {}

export interface SyncAllFlaggedStorageFilesWithGroupsResult {
  /**
   * The total number of StorageFiles that were synced.
   */
  readonly storageFilesSynced: number;
  /**
   * The total number of StorageFileGroups that were created.
   */
  readonly storageFilesGroupsCreated: number;
  /**
   * The total number of StorageFileGroups that were updated.
   */
  readonly storageFilesGroupsUpdated: number;
}

export class RegenerateStorageFileGroupContentParams extends TargetModelParams {
  /**
   * If true, will force syncing even if the StorageFile is not flagged for a resync.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}

export interface RegenerateStorageFileGroupContentResult {
  /**
   * The total number of "content" StorageFiles that were flagged for processing again.
   */
  readonly contentStorageFilesFlaggedForProcessing: number;
}

export class RegenerateAllFlaggedStorageFileGroupsContentParams {}

export interface RegenerateAllFlaggedStorageFileGroupsContentResult {
  /**
   * The number of StorageFileGroups that were updated.
   */
  readonly storageFileGroupsUpdated: number;
  /**
   * The number of "content" StorageFiles that were flagged for processing again.
   */
  readonly contentStorageFilesFlaggedForProcessing: number;
}

/**
 * Used for initializing an uninitialized model like NotificationBox or NotificationSummary.
 */
export class InitializeStorageFileModelParams extends TargetModelParams {
  /**
   * Whether or not to throw an error if the notification has already been sent or is being sent.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  throwErrorIfAlreadyInitialized?: boolean;
}

export class InitializeAllApplicableStorageFileGroupsParams {}

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
      regenerateContent: [RegenerateStorageFileGroupContentParams, RegenerateStorageFileGroupContentResult];
    };
  };
};

export const storageFileModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<StorageFileModelCrudFunctionsConfig, StorageFileTypes> = {
  storageFile: ['create:_,fromUpload,allFromUpload', 'update:_,process,syncWithGroups' as any, 'delete:_', 'read:download'],
  storageFileGroup: ['update:regenerateContent']
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
      // TODO: add a function to update the storage file group's embedded file display name
      regenerateContent: ModelFirebaseCrudFunction<RegenerateStorageFileGroupContentParams, RegenerateStorageFileGroupContentResult>;
    };
  };
}

export const storageFileFunctionMap = callModelFirebaseFunctionMapFactory(storageFileFunctionTypeConfigMap, storageFileModelCrudFunctionsConfig);
