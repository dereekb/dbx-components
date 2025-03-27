import { appNotificationTemplateTypeInfoRecordService, FirestoreContext, firestoreModelId, FirestoreModelKey } from '@dereekb/firebase';
import {
  DbxFirebaseFirestoreCollectionModule,
  DbxFirebaseEmulatorModule,
  DbxFirebaseFunctionsModule,
  defaultDbxFirebaseAuthServiceDelegateWithClaimsService,
  DbxFirebaseAuthServiceDelegate,
  DbxFirebaseDevelopmentModule,
  DbxFirebaseModelContextService,
  DbxFirebaseModelTypesServiceConfig,
  DbxFirebaseModelTypesServiceEntry,
  DbxFirebaseNotificationModule,
  DbxFirebaseNotificationItemDefaultViewComponent,
  DbxFirebaseNotificationItemWidgetService,
  provideDbxFirebaseApp,
  providedDbxFirebaseStorage,
  provideDbxFirebaseAuth,
  provideDbxFirebaseFunctions,
  provideDbxFirestoreCollection,
  provideDbxFirebaseEmulator,
  provideDbxFirebase
} from '@dereekb/dbx-firebase';
import { inject, Injector, NgModule } from '@angular/core';
import { environment } from './environments/environment';
import { Guestbook, DemoFirebaseFunctionsGetter, DemoFirestoreCollections, DEMO_API_AUTH_CLAIMS_ONBOARDED_TOKEN, DEMO_AUTH_CLAIMS_SERVICE, DEMO_FIREBASE_FUNCTIONS_CONFIG, guestbookIdentity, makeDemoFirebaseFunctions, makeDemoFirestoreCollections, DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD } from '@dereekb/demo-firebase';
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
    icon: 'list',
    displayInfoFactory: (data) => {
      return {
        title: data.name
      };
    },
    srefBuilder: (injector: Injector) => (key: FirestoreModelKey) => {
      const id = firestoreModelId(key);

      return {
        ref: 'demo.app.guestbook.list.guestbook',
        refParams: { id }
      };
    }
  };

  const entries: DbxFirebaseModelTypesServiceEntry<any>[] = [guestbook];

  const config: DbxFirebaseModelTypesServiceConfig = {
    entries
  };

  return config;
}

@NgModule({
  imports: [
    // dbx-firebase
    DbxFirebaseDevelopmentModule.forRoot({
      enabled: !environment.production,
      entries: [demoSetupDevelopmentWidget()]
    }),
    DbxFirebaseNotificationModule.forRoot({
      appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)
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
        delegateFactory: demoAuthDelegateFactory
      },
      functions: {
        functionsGetterToken: DemoFirebaseFunctionsGetter,
        functionsGetterFactory: makeDemoFirebaseFunctions,
        functionsConfigMap: DEMO_FIREBASE_FUNCTIONS_CONFIG
      },
      firestores: {
        appCollectionClass: DemoFirestoreCollections,
        collectionFactory: (firestoreContext: FirestoreContext) => makeDemoFirestoreCollections(firestoreContext),
        provideSystemStateFirestoreCollections: true,
        provideNotificationFirestoreCollections: true
      }
    }),
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
export class RootFirebaseModule {
  readonly dbxFirebaseNotificationItemWidgetService = inject(DbxFirebaseNotificationItemWidgetService);

  constructor() {
    this.dbxFirebaseNotificationItemWidgetService.registerDefaultWidget({
      componentClass: DbxFirebaseNotificationItemDefaultViewComponent
    });
  }
}
