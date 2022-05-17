import { APP_CODE_PREFIXApiFirestoreModule } from './firestore.module';
import { APP_CODE_PREFIXFirestoreCollections } from 'FIREBASE_COMPONENTS_NAME';
import { firebaseServerActionsContext } from '@dereekb/firebase-server';
import { Module } from "@nestjs/common";
import { APP_CODE_PREFIXFirebaseServerActionsContext } from './action.context';

const APP_CODE_PREFIX_LOWERFirebaseServerActionsContextFactory = (collections: APP_CODE_PREFIXFirestoreCollections): APP_CODE_PREFIXFirebaseServerActionsContext => {
  return {
    ...collections,
    ...firebaseServerActionsContext()
  };
}

@Module({
  imports: [APP_CODE_PREFIXApiFirestoreModule],
  providers: [{
    provide: APP_CODE_PREFIXFirebaseServerActionsContext,
    useFactory: APP_CODE_PREFIX_LOWERFirebaseServerActionsContextFactory,
    inject: [APP_CODE_PREFIXFirestoreCollections]
  }],
  exports: [APP_CODE_PREFIXFirebaseServerActionsContext]
})
export class APP_CODE_PREFIXApiActionModule { }
