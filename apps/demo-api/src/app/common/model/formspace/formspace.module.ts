import { Module } from '@nestjs/common';
import { appFormSpaceModuleMetadata, BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN } from '@dereekb/firebase-server/model';
import { DEMO_FORM_SPACE_TYPE_CONFIGS } from 'demo-firebase';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { DemoApiActionModule } from '../../firebase/action.module';
import { StorageFileModule } from '../storagefile/storagefile.module';

/**
 * Dependencies for the FormSpaceModule.
 *
 * StorageFileModule is imported because a FormSpace's whole file story — the group, the supersede, the
 * delete sweep — is the StorageFile system's, not a parallel one.
 */
@Module({
  imports: [DemoApiActionModule, StorageFileModule],
  providers: [
    {
      provide: BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN,
      useExisting: DemoFirebaseServerActionsContext
    }
  ],
  exports: [DemoApiActionModule, StorageFileModule, BASE_FORM_SPACE_SERVER_ACTION_CONTEXT_TOKEN]
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
