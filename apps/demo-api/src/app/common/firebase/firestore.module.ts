import { DemoFirestoreCollections, makeDemoFirestoreCollections } from "@dereekb/demo-firebase";
import { Firestore, FirestoreContext } from "@dereekb/firebase";
import { FirebaseServerFirestoreModule, FIRESTORE_CONTEXT_TOKEN, FIRESTORE_TOKEN, googleCloudFirestoreContextFactory } from "@dereekb/firebase-server";
import { Module } from "@nestjs/common";

const demoFirestoreContextFactory = (firestore: Firestore) => googleCloudFirestoreContextFactory(firestore);
const demoFirestoreCollectionsFactory = (context: FirestoreContext) => makeDemoFirestoreCollections(context);

@Module({
  imports: [FirebaseServerFirestoreModule],
  exports: [FirebaseServerFirestoreModule, DemoFirestoreCollections, FIRESTORE_CONTEXT_TOKEN],
  providers: [{
    provide: FIRESTORE_CONTEXT_TOKEN,
    useFactory: demoFirestoreContextFactory,
    inject: [FIRESTORE_TOKEN]
  }, {
    provide: DemoFirestoreCollections,
    useFactory: demoFirestoreCollectionsFactory,
    inject: [FIRESTORE_CONTEXT_TOKEN]
  }]
})
export class AppFirestoreModule { }
