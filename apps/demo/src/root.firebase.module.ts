import { FirestoreContext } from '@dereekb/firebase';
import { DbxFirebaseFirestoreCollectionModule, DbxFirebaseEmulatorModule, DbxFirebaseDefaultFirebaseProvidersModule, DbxFirebaseAuthModule, DbxFirebaseFunctionsModule, defaultDbxFirebaseAuthServiceDelegateWithClaimsService, DbxFirebaseAuthServiceDelegate, DbxFirebaseStorageModule, DbxFirebaseDevelopmentModule, DbxFirebaseModelContextService, DbxFirebaseModelTypesServiceConfig, DbxFirebaseModelTypesServiceEntry } from '@dereekb/dbx-firebase';
import { NgModule } from '@angular/core';
import { environment } from './environments/environment';
import { Guestbook, DemoFirebaseFunctionsGetter, DemoFirestoreCollections, DEMO_API_AUTH_CLAIMS_ONBOARDED_TOKEN, DEMO_AUTH_CLAIMS_SERVICE, DEMO_FIREBASE_FUNCTIONS_CONFIG, guestbookIdentity, makeDemoFirebaseFunctions, makeDemoFirestoreCollections } from '@dereekb/demo-firebase';
import { DemoFirebaseContextService, demoSetupDevelopmentWidget } from '@dereekb/demo-components';

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

export function dbxFirebaseModelTypesServiceConfigFactory(): DbxFirebaseModelTypesServiceConfig {
  const guestbook: DbxFirebaseModelTypesServiceEntry<Guestbook> = {
    identity: guestbookIdentity,
    displayInfoFactory: (data) => {
      return {
        title: data.name
      };
    },
    sref: () => {
      return {
        ref: ''
      };
    }
  };

  const entries: DbxFirebaseModelTypesServiceEntry<any>[] = [guestbook];

  let config: DbxFirebaseModelTypesServiceConfig = {
    entries
  };

  return config;
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
    DbxFirebaseStorageModule.forRoot(),
    DbxFirebaseDevelopmentModule.forRoot({
      enabled: !environment.production,
      entries: [demoSetupDevelopmentWidget()]
    })
  ],
  providers: [
    {
      provide: DemoFirebaseContextService
    },
    {
      provide: DbxFirebaseModelContextService,
      useExisting: DemoFirebaseContextService
    },
    {
      provide: DbxFirebaseModelTypesServiceConfig,
      useFactory: dbxFirebaseModelTypesServiceConfigFactory
    }
  ]
})
export class RootFirebaseModule {}
