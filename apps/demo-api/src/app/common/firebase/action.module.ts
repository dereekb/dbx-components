import { DemoApiAuthModule } from './auth.module';
import { DemoApiFirestoreModule } from './firestore.module';
import { DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { firebaseServerActionsContext } from '@dereekb/firebase-server';
import { Module } from '@nestjs/common';
import { DemoFirebaseServerActionsContext } from './action.context';
import { DemoApiAuthService } from './auth.service';

const demoFirebaseServerActionsContextFactory = (collections: DemoFirestoreCollections, authService: DemoApiAuthService): DemoFirebaseServerActionsContext => {
  return {
    ...collections,
    ...firebaseServerActionsContext(),
    authService
  };
};

@Module({
  imports: [DemoApiFirestoreModule, DemoApiAuthModule],
  providers: [
    {
      provide: DemoFirebaseServerActionsContext,
      useFactory: demoFirebaseServerActionsContextFactory,
      inject: [DemoFirestoreCollections, DemoApiAuthService]
    }
  ],
  exports: [DemoFirebaseServerActionsContext]
})
export class DemoApiActionModule {}
