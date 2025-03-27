import { FirestoreContext } from '@dereekb/firebase';
import { provideDbxFirebase, defaultDbxFirebaseAuthServiceDelegateWithClaimsService, DbxFirebaseAuthServiceDelegate, DbxFirebaseDevelopmentModule } from '@dereekb/dbx-firebase';
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
    DbxFirebaseDevelopmentModule.forRoot({
      enabled: !environment.production,
      entries: []
    })
  ],
  providers: [
    provideDbxFirebase({
      app: {
        dbxFirebaseOptions: environment.firebase
      },
      emulator: environment.firebase.emulators,
      storage: {},
      auth: {
        delegateFactory: APP_CODE_PREFIX_LOWERAuthDelegateFactory
      },
      functions: {
        functionsGetterToken: APP_CODE_PREFIXFirebaseFunctionsGetter,
        functionsGetterFactory: makeAPP_CODE_PREFIXFirebaseFunctions,
        functionsConfigMap: APP_CODE_PREFIX_UPPER_FIREBASE_FUNCTIONS_CONFIG
      },
      firestores: {
        appCollectionClass: APP_CODE_PREFIXFirestoreCollections,
        collectionFactory: (firestoreContext: FirestoreContext) => makeAPP_CODE_PREFIXFirestoreCollections(firestoreContext),
        provideSystemStateFirestoreCollections: true,
        provideNotificationFirestoreCollections: true
      }
    }),
  ]
})
export class RootFirebaseModule { }
