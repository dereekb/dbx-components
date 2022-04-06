import { DemoFirestoreCollections, makeDemoFirestoreCollections } from "@dereekb/demo-firebase";
import { FirestoreContext } from "@dereekb/firebase";
import { googleCloudFirestoreContextFactory } from "@dereekb/firebase-server";
import { Module, InjectionToken } from "@nestjs/common";

import * as admin from 'firebase-admin';

export const FIRESTORE_CONTEXT_TOKEN: InjectionToken = 'FIRESTORE_CONTEXT_TOKEN';

const demoFirestoreContextFactory = () => googleCloudFirestoreContextFactory(admin.firestore());
const demoFirestoreCollectionsFactory = (context: FirestoreContext) => makeDemoFirestoreCollections(context);

@Module({
  imports: [],
  controllers: [],
  providers: [{
    provide: FIRESTORE_CONTEXT_TOKEN,
    useFactory: demoFirestoreContextFactory
  }, {
    provide: DemoFirestoreCollections,
    useFactory: demoFirestoreCollectionsFactory,
    inject: [FIRESTORE_CONTEXT_TOKEN]
  }]
})
export class AppFirestoreModule { }
