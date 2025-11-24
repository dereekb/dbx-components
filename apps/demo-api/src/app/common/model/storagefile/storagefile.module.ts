import { Module } from '@nestjs/common';
import { BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, StorageFileInitializeFromUploadService, appStorageFileModuleMetadata } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { DemoApiActionModule } from '../../firebase/action.module';
import { demoStorageFileUploadServiceFactory } from './storagefile.upload.service';
import { demoStorageFileInitServerActionsContextConfig } from './storagefile.init';

/**
 * Dependencies for the NotificationModule
 */
@Module({
  imports: [DemoApiActionModule],
  providers: [
    {
      provide: StorageFileInitializeFromUploadService,
      useFactory: demoStorageFileUploadServiceFactory,
      inject: [DemoFirebaseServerActionsContext]
    },
    {
      provide: STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN,
      useFactory: demoStorageFileInitServerActionsContextConfig,
      inject: [DemoFirebaseServerActionsContext]
    },
    {
      provide: BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN,
      useExisting: DemoFirebaseServerActionsContext
    }
  ],
  exports: [DemoApiActionModule, BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, StorageFileInitializeFromUploadService]
})
export class StorageFileDependencyModule {}

/**
 * StorageFile model module
 */
@Module(
  appStorageFileModuleMetadata({
    dependencyModule: StorageFileDependencyModule
  })
)
export class StorageFileModule {}
