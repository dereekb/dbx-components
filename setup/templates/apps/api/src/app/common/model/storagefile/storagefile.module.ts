import { Module } from '@nestjs/common';
import { BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, StorageFileInitializeFromUploadService, appStorageFileModuleMetadata } from '@dereekb/firebase-server/model';
import { APP_CODE_PREFIXFirebaseServerActionsContext } from '../../firebase/action.context';
import { APP_CODE_PREFIXApiActionModule } from '../../firebase/action.module';
import { APP_CODE_PREFIX_CAMELStorageFileUploadServiceFactory } from './storagefile.upload.service';

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
      provide: BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN,
      useExisting: APP_CODE_PREFIXFirebaseServerActionsContext
    }
  ],
  exports: [APP_CODE_PREFIXApiActionModule, BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, StorageFileInitializeFromUploadService]
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
