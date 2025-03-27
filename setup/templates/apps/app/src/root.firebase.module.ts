import { FirestoreContext } from '@dereekb/firebase';
import { DbxFirebaseFirestoreCollectionModule, DbxFirebaseEmulatorModule, provideDbxFirebaseApp, DbxFirebaseAuthModule, DbxFirebaseStorageModule, DbxFirebaseFunctionsModule, defaultDbxFirebaseAuthServiceDelegateWithClaimsService, DbxFirebaseAuthServiceDelegate, DbxFirebaseDevelopmentModule } from '@dereekb/dbx-firebase';
import { NgModule } from '@angular/core';
import { environment } from './environments/environment';
import { APP_CODE_PREFIXFirebaseFunctionsGetter, APP_CODE_PREFIXFirestoreCollections, APP_CODE_PREFIX_UPPER_FIREBASE_FUNCTIONS_CONFIG, makeAPP_CODE_PREFIXFirebaseFunctions, makeAPP_CODE_PREFIXFirestoreCollections, APP_CODE_PREFIX_UPPER_AUTH_CLAIMS_SERVICE } from 'FIREBASE_COMPONENTS_NAME';

export function APP_CODE_PREFIX_LOWERAuthDelegateFactory(): DbxFirebaseAuthServiceDelegate {
  return defaultDbxFirebaseAuthServiceDelegateWithClaimsService({
    claimsService: APP_CODE_PREFIX_UPPER_AUTH_CLAIMS_SERVICE,
    addAuthUserStateToRoles: true
  });
}

@NgModule({
  imports: [
    // dbx-firebase
    DbxFirebaseEmulatorModule.forRoot(environment.firebase.emulators),
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
      delegateFactory: APP_CODE_PREFIX_LOWERAuthDelegateFactory
    }),
    DbxFirebaseStorageModule.forRoot(),
    DbxFirebaseDevelopmentModule.forRoot({
      enabled: !environment.production,
      entries: []
    })
  ],
  providers: [
    provideDbxFirebaseApp({
      dbxFirebaseOptions: environment.firebase
    }),
  ]
})
export class RootFirebaseModule { }
