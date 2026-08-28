import { Module } from '@nestjs/common';
import { BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, StorageFileInitializeFromUploadService, appStorageFileModuleMetadata } from '@dereekb/firebase-server/model';
import { DEMO_FORM_SPACE_TYPE_CONFIGS, STORAGE_FILE_PURPOSE_UPLOAD_POLICIES } from 'demo-firebase';
import { AppFormSpaceTypeConfigService, appFormSpaceTypeConfigService, formSpaceTypeConfigRecord } from '@dereekb/firebase';
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
    // Provided HERE rather than imported from FormSpaceModule: FormSpaceModule imports StorageFileModule
    // (a FormSpace's whole file story is the StorageFile system's), so importing it back would be a cycle.
    // The registry is derived pure data, so a second identical instance costs nothing.
    {
      provide: AppFormSpaceTypeConfigService,
      useFactory: () => appFormSpaceTypeConfigService(formSpaceTypeConfigRecord(DEMO_FORM_SPACE_TYPE_CONFIGS))
    },
    {
      provide: StorageFileInitializeFromUploadService,
      useFactory: demoStorageFileUploadServiceFactory,
      inject: [DemoFirebaseServerActionsContext, AppFormSpaceTypeConfigService]
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
  exports: [DemoApiActionModule, STORAGE_FILE_INIT_SERVER_ACTIONS_CONTEXT_CONFIG_TOKEN, BASE_STORAGE_FILE_SERVER_ACTION_CONTEXT_TOKEN, StorageFileInitializeFromUploadService]
})
export class StorageFileDependencyModule {}

/**
 * StorageFile model module
 */
@Module(
  appStorageFileModuleMetadata({
    dependencyModule: StorageFileDependencyModule,
    storageFileSignedUploadPolicies: STORAGE_FILE_PURPOSE_UPLOAD_POLICIES
  })
)
export class StorageFileModule {}
