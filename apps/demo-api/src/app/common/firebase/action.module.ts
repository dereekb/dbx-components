import { DemoApiAuthModule } from './auth.module';
import { DemoApiFirestoreModule } from './firestore.module';
import { DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { firebaseServerActionsContext, FirebaseServerStorageService } from '@dereekb/firebase-server';
import { Module } from '@nestjs/common';
import { DemoFirebaseServerActionsContext } from './action.context';
import { DemoApiAuthService } from './auth.service';
import { DemoApiStorageModule } from './storage.module';

const demoFirebaseServerActionsContextFactory = (collections: DemoFirestoreCollections, authService: DemoApiAuthService, storageService: FirebaseServerStorageService): DemoFirebaseServerActionsContext => {
  return {
    ...collections,
    ...firebaseServerActionsContext(),
    storageService,
    authService
  };
};

@Module({
  imports: [DemoApiFirestoreModule, DemoApiAuthModule, DemoApiStorageModule],
  providers: [
    {
      provide: DemoFirebaseServerActionsContext,
      useFactory: demoFirebaseServerActionsContextFactory,
      inject: [DemoFirestoreCollections, DemoApiAuthService, FirebaseServerStorageService]
    }
  ],
  exports: [DemoFirebaseServerActionsContext]
})
export class DemoApiActionModule {}
