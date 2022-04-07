import { AppFirestoreModule } from './firestore.module';
import { DemoFirestoreCollections } from "@dereekb/demo-firebase";
import { firebaseServerActionsContext } from '@dereekb/firebase-server';
import { Module } from "@nestjs/common";
import { DemoFirebaseServerActionsContext } from './action.context';

const demoFirebaseServerActionsContextFactory = (collections: DemoFirestoreCollections): DemoFirebaseServerActionsContext => {
  return {
    ...collections,
    ...firebaseServerActionsContext()
  };
}

@Module({
  imports: [AppFirestoreModule],
  controllers: [],
  providers: [{
    provide: DemoFirebaseServerActionsContext,
    useFactory: demoFirebaseServerActionsContextFactory,
    inject: [DemoFirestoreCollections]
  }]
})
export class AppActionModule { }
