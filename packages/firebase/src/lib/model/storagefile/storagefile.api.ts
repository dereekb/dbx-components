import { Expose } from 'class-transformer';
import { TargetModelParams, OnCallCreateModelResult } from '../../common';
import { callModelFirebaseFunctionMapFactory, type ModelFirebaseCrudFunction, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, ModelFirebaseCreateFunction } from '../../client';
import { IsString, IsBoolean } from 'class-validator';
import { StorageFileTypes } from './storagefile';
import { StorageBucketId, StoragePath, StorageSlashPath } from '../../common/storage';
import { Maybe } from '@dereekb/util';

export const STORAGE_FILE_NAME_MIN_LENGTH = 0;
export const STORAGE_FILE_NAME_MAX_LENGTH = 42;

/**
 * Used for directly create a new StorageFile.
 */
export class CreateStorageFileParams {}

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

export class ProcessStorageFileParams extends TargetModelParams {}

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
  storageFile: ['create:_,fromUpload', 'update:_,process', 'delete:_']
};

export abstract class StorageFileFunctions implements ModelFirebaseFunctionMap<StorageFileFunctionTypeMap, StorageFileModelCrudFunctionsConfig> {
  abstract storageFile: {
    createStorageFile: {
      create: ModelFirebaseCreateFunction<CreateStorageFileParams, OnCallCreateModelResult>;
      fromUpload: ModelFirebaseCreateFunction<InitializeStorageFileFromUploadParams, OnCallCreateModelResult>;
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
