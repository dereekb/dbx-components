import { FirestoreContext } from '@dereekb/firebase';
import { DbxFirebaseFirestoreCollectionModule, DbxFirebaseEmulatorModule, DbxFirebaseDefaultFirebaseProvidersModule, DbxFirebaseAuthModule, DbxFirebaseFunctionsModule, defaultDbxFirebaseAuthServiceDelegateWithClaimsService, DbxFirebaseAuthServiceDelegate, DbxFirebaseStorageModule } from '@dereekb/dbx-firebase';
import { NgModule } from '@angular/core';
import { environment } from './environments/environment';
import { DemoFirebaseFunctionsGetter, DemoFirestoreCollections, DEMO_API_AUTH_CLAIMS_ONBOARDED_TOKEN, DEMO_AUTH_CLAIMS_SERVICE, DEMO_FIREBASE_FUNCTIONS_CONFIG, makeDemoFirebaseFunctions, makeDemoFirestoreCollections } from '@dereekb/demo-firebase';

export function demoAuthDelegateFactory(): DbxFirebaseAuthServiceDelegate {
  return defaultDbxFirebaseAuthServiceDelegateWithClaimsService({
    claimsService: DEMO_AUTH_CLAIMS_SERVICE,
    addAuthUserStateToRoles: true,
    stateForLoggedInUserToken: (token) => {
      const y = token.claims[DEMO_API_AUTH_CLAIMS_ONBOARDED_TOKEN];
      return y ? 'user' : 'new';
    }
  });
}

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
      delegateFactory: demoAuthDelegateFactory
    }),
    DbxFirebaseStorageModule.forRoot()
  ],
  providers: []
})
export class RootFirebaseModule {}
