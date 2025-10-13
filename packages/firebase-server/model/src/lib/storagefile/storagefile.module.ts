import { type ModuleMetadata } from '@nestjs/common';
import { type Maybe } from '@dereekb/util';
import { ConfigModule } from '@nestjs/config';
import { BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, BaseStorageFileServerActionsContext, STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, storageFileServerActions, StorageFileServerActions, StorageFileServerActionsContext } from './storagefile.action.server';
import { StorageFileInitializeFromUploadService } from './storagefile.upload.service';

// MARK: Provider Factories
export function storageFileServerActionsContextFactory(context: BaseStorageFileServerActionsContext, storageFileInitializeFromUploadService: StorageFileInitializeFromUploadService): StorageFileServerActionsContext {
  return { ...context, storageFileInitializeFromUploadService };
}

export function storageFileServerActionsFactory(context: StorageFileServerActionsContext) {
  return storageFileServerActions(context);
}

// MARK: App StorageFile Model Module
export interface ProvideAppStorageFileMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * The AppStorageFileModule requires the following dependencies in order to initialze properly:
   * - StorageFileInitializeFromUploadService
   * - BaseStorageFileServerActionsContext (BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN)
   *
   * This module declaration makes it easier to import a module that exports those depenendencies.
   */
  readonly dependencyModule?: Maybe<Required<ModuleMetadata>['imports']['0']>;
}

/**
 * Convenience function used to generate ModuleMetadata for an app's StorageFileModule.
 *
 * By default this module exports:
 * - StorageFileServerActionContext (STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN)
 * - StorageFileServerActions
 *
 * Be sure the class that delares the module using this function also extends AbstractAppStorageFileModule.
 *
 * @param provide
 * @param useFactory
 * @returns
 */
export function appStorageFileModuleMetadata(config: ProvideAppStorageFileMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = config;
  const dependencyModuleImport = dependencyModule ? [dependencyModule] : [];

  return {
    imports: [ConfigModule, ...dependencyModuleImport, ...(imports ?? [])],
    exports: [STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, StorageFileServerActions, ...(exports ?? [])],
    providers: [
      {
        provide: StorageFileServerActions,
        useFactory: storageFileServerActionsFactory,
        inject: [STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN]
      },
      {
        provide: STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN,
        useFactory: storageFileServerActionsContextFactory,
        inject: [BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, StorageFileInitializeFromUploadService]
      },
      ...(providers ?? [])
    ]
  };
}
