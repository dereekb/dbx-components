import { Module } from '@nestjs/common';
import { appFormSpaceModuleMetadata, BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN } from '@dereekb/firebase-server/model';
import { DEMO_FORM_SPACE_TYPE_CONFIGS } from 'demo-firebase';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { DemoApiActionModule } from '../../firebase/action.module';

/**
 * Dependencies for the FormSpaceModule.
 *
 * No StorageFileModule import. A FormSpace's whole file story IS the StorageFile system's — the group, the
 * supersede, the delete sweep — but every one of those is reached through `storageFileCollection` on the
 * shared actions context and the `queryAndFlagStorageFilesForDelete` helper, never through a StorageFile
 * provider, so there is nothing here to inject.
 */
@Module({
  imports: [DemoApiActionModule],
  providers: [
    {
      provide: BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN,
      useExisting: DemoFirebaseServerActionsContext
    }
  ],
  exports: [DemoApiActionModule, BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN]
})
export class FormSpaceDependencyModule {}

/**
 * FormSpace model module.
 */
@Module(
  appFormSpaceModuleMetadata({
    dependencyModule: FormSpaceDependencyModule,
    formSpaceTypeConfigs: DEMO_FORM_SPACE_TYPE_CONFIGS
  })
)
export class FormSpaceModule {}
