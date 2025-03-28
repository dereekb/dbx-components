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

@NgModule({
  providers: [
    provideDbxFirebase({
      app: {
        dbxFirebaseAppOptions: environment.firebase
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
      },
      modelContextService: {
        dbxFirebaseModelContextServiceClass: DemoFirebaseContextService
      }
    }),
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
