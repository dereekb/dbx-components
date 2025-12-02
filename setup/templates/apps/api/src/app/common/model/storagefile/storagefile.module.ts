import { Module } from '@nestjs/common';
import { BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, StorageFileInitializeFromUploadService, appStorageFileModuleMetadata } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { APP_CODE_PREFIXApiActionModule } from '../../firebase/action.module';
import { APP_CODE_PREFIX_CAMELStorageFileUploadServiceFactory } from './storagefile.upload.service';
import { APP_CODE_PREFIX_CAMELStorageFileInitServerActionsContextConfig } from './storagefile.init';

/**
 * Dependencies for the NotificationModule
 */
@Module({
  imports: [APP_CODE_PREFIXApiActionModule],
  providers: [
    {
      provide: StorageFileInitializeFromUploadService,
      useFactory: APP_CODE_PREFIX_CAMELStorageFileUploadServiceFactory,
      inject: [APP_CODE_PREFIXFirebaseServerActionsContext]
    },
    {
      provide: STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN,
      useFactory: APP_CODE_PREFIX_CAMELStorageFileInitServerActionsContextConfig,
      inject: [APP_CODE_PREFIXFirebaseServerActionsContext]
    },
    {
      provide: BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN,
      useExisting: APP_CODE_PREFIXFirebaseServerActionsContext
    }
  ],
  exports: [APP_CODE_PREFIXApiActionModule, STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, StorageFileInitializeFromUploadService]
})
export class StorageFileDependencyModule { }

/**
 * StorageFile model module
 */
@Module(
  appStorageFileModuleMetadata({
    dependencyModule: StorageFileDependencyModule
  })
)
export class StorageFileModule { }
