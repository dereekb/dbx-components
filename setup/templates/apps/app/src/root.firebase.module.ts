import { FirestoreContext } from '@dereekb/firebase';
import { DbxFirebaseFirestoreCollectionModule, DbxFirebaseEmulatorModule, DbxFirebaseDefaultFirebaseProvidersModule, DbxFirebaseAuthModule, DbxFirebaseFunctionsModule } from '@dereekb/dbx-firebase';
import { NgModule } from '@angular/core';
import { environment } from './environments/environment';
import { APP_CODE_PREFIXFirebaseFunctionsGetter, APP_CODE_PREFIXFirestoreCollections, APP_CODE_PREFIX_UPPER_FIREBASE_FUNCTIONS_CONFIG, makeAPP_CODE_PREFIXFirebaseFunctions, makeAPP_CODE_PREFIXFirestoreCollections } from 'FIREBASE_COMPONENTS_NAME';

@NgModule({
  imports: [
    // dbx-firebase
    DbxFirebaseEmulatorModule.forRoot(environment.firebase.emulators),
    DbxFirebaseDefaultFirebaseProvidersModule.forRoot(environment.firebase),
    DbxFirebaseFirestoreCollectionModule.forRoot({
      appCollectionClass: APP_CODE_PREFIXFirestoreCollections,
      collectionFactory: (firestoreContext: FirestoreContext) => makeAPP_CODE_PREFIXFirestoreCollections(firestoreContext)
    }),
    DbxFirebaseFunctionsModule.forRoot({
      functionsGetterToken: APP_CODE_PREFIXFirebaseFunctionsGetter,
      functionsGetterFactory: makeAPP_CODE_PREFIXFirebaseFunctions,
      functionsConfigMap: APP_CODE_PREFIX_UPPER_FIREBASE_FUNCTIONS_CONFIG
    }),
    DbxFirebaseAuthModule.forRoot({
      delegateFactory: undefined  // todo
    })
  ],
  providers: []
})
export class RootFirebaseModule { }
