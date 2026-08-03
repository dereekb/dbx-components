import { Module } from '@nestjs/common';
import { DemoFirestoreCollections } from 'demo-firebase';
import { appUserExternalConnectionModuleMetadata } from '@dereekb/firebase-server/model';
import { DemoApiFirestoreModule } from '../../firebase';

/**
 * UserExternalConnection model module.
 *
 * NOTE: the private half of the connection pair is provided ONLY here. It is deliberately absent
 * from `DemoFirestoreCollections` and `DemoFirebaseServerActionsContext`, so app code cannot reach
 * the credentials collection except through `UserExternalConnectionServerActions`.
 */
@Module(
  appUserExternalConnectionModuleMetadata({
    dependencyModule: DemoApiFirestoreModule,
    appCollectionsToken: DemoFirestoreCollections
  })
)
export class UserExternalConnectionModule {}
