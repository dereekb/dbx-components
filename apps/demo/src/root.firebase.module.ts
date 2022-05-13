import { FirestoreContext } from '@dereekb/firebase';
import { DbxFirebaseFirestoreCollectionModule, DbxFirebaseEmulatorModule, DbxFirebaseDefaultFirebaseProvidersModule, DbxFirebaseAuthModule, DbxFirebaseFunctionsModule } from '@dereekb/dbx-firebase';
import { NgModule } from '@angular/core';
import { environment } from './environments/environment';
import { DemoFirebaseFunctionsGetter, DemoFirestoreCollections, DEMO_FIREBASE_FUNCTIONS_CONFIG, makeDemoFirebaseFunctions, makeDemoFirestoreCollections } from '@dereekb/demo-firebase';

@NgModule({
  imports: [
    // dbx-firebase
    DbxFirebaseEmulatorModule.forRoot(environment.firebase.emulators),
    DbxFirebaseDefaultFirebaseProvidersModule.forRoot(environment.firebase),
    DbxFirebaseFirestoreCollectionModule.forRoot({
      appCollectionClass: DemoFirestoreCollections,
      collectionFactory: (firestoreContext: FirestoreContext) => makeDemoFirestoreCollections(firestoreContext)
    }),
    DbxFirebaseFunctionsModule.forRoot({
      functionsGetterToken: DemoFirebaseFunctionsGetter,
      functionsGetterFactory: makeDemoFirebaseFunctions,
      functionsConfigMap: DEMO_FIREBASE_FUNCTIONS_CONFIG
    }),
    DbxFirebaseAuthModule.forRoot({
      delegateFactory: undefined  // todo
    })
  ],
  providers: []
})
export class RootFirebaseModule { }
