import { Expose } from 'class-transformer';
import { TargetModelParams, OnCallCreateModelResult } from '../../common';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, ModelFirebaseCreateFunction } from '../../client';
import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';
import { StorageFileTypes } from './storagefile';
import { StorageBucketId, StoragePath, StorageSlashPath } from '../../common/storage';
import { Maybe } from '@dereekb/util';

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
export class InitializeStorageFileFromUploadParams implements StoragePath {
  @Expose()
  @IsString()
  bucketId!: StorageBucketId;

  @Expose()
  @IsString()
  pathString!: StorageSlashPath;
}

export class ProcessStorageFileParams extends TargetModelParams {
  /**
   * If set, will run the processing immediately instead of waiting for the next scheduled run.
   */
  @Expose()
  @IsBoolean()
  @IsOptional()
  runImmediately?: Maybe<boolean>;
}

export interface ProcessStorageFileResult {}

export class UpdateStorageFileParams extends TargetModelParams {}

export class DeleteStorageFileParams extends TargetModelParams {}

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
    delete: {
      _: DeleteStorageFileParams;
    };
  };
};

export const storageFileModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<StorageFileModelCrudFunctionsConfig, StorageFileTypes> = {
  storageFile: ['create:_,fromUpload,allFromUpload', 'update:_,process', 'delete:_']
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
    deleteStorageFile: {
      delete: ModelFirebaseCrudFunction<DeleteStorageFileParams>;
    };
  };
}

export const storageFileFunctionMap = callModelFirebaseFunctionMapFactory(storageFileFunctionTypeConfigMap, storageFileModelCrudFunctionsConfig);
