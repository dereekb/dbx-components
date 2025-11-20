import { Expose, Type } from 'class-transformer';
import { TargetModelParams, OnCallCreateModelResult } from '../../common';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, ModelFirebaseCreateFunction } from '../../client';
import { IsString, IsBoolean, IsOptional, IsNumber, IsDate, Min, IsMimeType } from 'class-validator';
import { StorageFileSignedDownloadUrl, StorageFileTypes } from './storagefile';
import { type StorageBucketId, type StoragePath, type StorageSignedDownloadUrl, type StorageSlashPath } from '../../common/storage';
import { ContentDispositionString, ContentTypeMimeType, Maybe, Milliseconds } from '@dereekb/util';

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
   * Used with retryProcessing.
   *
   * If set, will forcibly create a new processing task even if the existing processing task appears to be ok.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  forceRestartProcessing?: Maybe<boolean>;
}

export interface ProcessStorageFileResult {}

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

export interface DownloadStorageFileResult {
  /**
   * The download URL.
   */
  readonly url: StorageFileSignedDownloadUrl;
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
    };
    read: {
      download: [DownloadStorageFileParams, DownloadStorageFileResult];
    };
    delete: {
      _: DeleteStorageFileParams;
    };
  };
};

export const storageFileModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<StorageFileModelCrudFunctionsConfig, StorageFileTypes> = {
  storageFile: ['create:_,fromUpload,allFromUpload', 'update:_,process', 'delete:_', 'read:download']
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
    };
    readStorageFile: {
      download: ModelFirebaseCrudFunction<DownloadStorageFileParams, DownloadStorageFileResult>;
    };
    deleteStorageFile: {
      delete: ModelFirebaseCrudFunction<DeleteStorageFileParams>;
    };
  };
}

export const storageFileFunctionMap = callModelFirebaseFunctionMapFactory(storageFileFunctionTypeConfigMap, storageFileModelCrudFunctionsConfig);
