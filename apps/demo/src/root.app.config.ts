import { DbxAnalyticsService, DbxAnalyticsServiceConfiguration, DbxAnalyticsSegmentServiceListener, DbxAnalyticsSegmentApiServiceConfig, provideDbxAnalyticsService, provideDbxAnalyticsSegmentApiService } from '@dereekb/dbx-analytics';
import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, Injector } from '@angular/core';
import { Category, provideUIRouter, StatesModule, UIRouter } from '@uirouter/angular';
import { environment } from './environments/environment';
import { AuthTransitionHookOptions, DBX_KNOWN_APP_CONTEXT_STATES, enableHasAuthRoleHook, enableHasAuthStateHook, enableIsLoggedInHook, provideDbxAppAuth, provideDbxAppContextState, provideDbxAppEnviroment, provideDbxStorage, provideDbxUIRouterService } from '@dereekb/dbx-core';
import { DbxFirebaseAnalyticsUserSource, DbxFirebaseAuthServiceDelegate, DbxFirebaseModelTypesServiceConfig, DbxFirebaseModelTypesServiceEntry, defaultDbxFirebaseAuthServiceDelegateWithClaimsService, provideDbxFirebase, provideDbxFirebaseLogin } from '@dereekb/dbx-firebase';
import { provideDbxModelService, provideDbxRouterWebUiRouterProviderConfig, provideDbxScreenMediaService, provideDbxStyleService } from '@dereekb/dbx-web';
import { DEMO_AUTH_CLAIMS_SERVICE, DEMO_API_AUTH_CLAIMS_ONBOARDED_TOKEN, Guestbook, guestbookIdentity, DEMO_FIREBASE_FUNCTIONS_CONFIG, DemoFirebaseFunctionsGetter, DemoFirestoreCollections, makeDemoFirebaseFunctions, makeDemoFirestoreCollections, DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD } from 'demo-firebase';
import { FirestoreContext, FirestoreModelKey, appNotificationTemplateTypeInfoRecordService, firestoreModelId } from '@dereekb/firebase';
import { DemoFirebaseContextService, demoSetupDevelopmentWidget } from 'demo-components';
import { defaultValidationMessages, provideDbxFormConfiguration, provideDbxFormFormlyFieldDeclarations } from '@dereekb/dbx-form';
import { provideDbxMapbox } from '@dereekb/dbx-web/mapbox';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideAnimations } from '@angular/platform-browser/animations';
import { STATES } from './app/app.router';
import { FormlyModule } from '@ngx-formly/core';
import { provideDbxCalendar } from '@dereekb/dbx-web/calendar';
import { metaReducers, ROOT_REDUCER } from './app/state/app.state';

// MARK: DbxAnalytics
export function dbxAnalyticsSegmentApiServiceConfigFactory(injector: Injector): DbxAnalyticsSegmentApiServiceConfig {
  const config = new DbxAnalyticsSegmentApiServiceConfig(environment.analytics.segment);
  config.active = environment.production;
  config.logging = false; // environment.testing;
  return config;
}

export function dbxAnalyticsServiceConfigurationFactory(injector: Injector): DbxAnalyticsServiceConfiguration {
  const segmentListener: DbxAnalyticsSegmentServiceListener = injector.get(DbxAnalyticsSegmentServiceListener);
  const dbxFirebaseAnalyticsUserSource: DbxFirebaseAnalyticsUserSource = injector.get(DbxFirebaseAnalyticsUserSource);

  const config: DbxAnalyticsServiceConfiguration = {
    isProduction: environment.production,
    logEvents: environment.testing,
    listeners: [segmentListener],
    userSource: dbxFirebaseAnalyticsUserSource
  };

  return config;
}

// MARK: Router Configs
export function routerConfigFn(router: UIRouter, injector: Injector, module: StatesModule): any {
  const transitionService = router.transitionService;
  const service: DbxAnalyticsService = injector.get<DbxAnalyticsService>(DbxAnalyticsService);

  transitionService.onSuccess({}, () => {
    // Send a page view on each successful transition.
    service.sendPageView();
  });

  const options: AuthTransitionHookOptions = {
    defaultRedirectTarget: 'demo.login'
  };

  enableHasAuthStateHook(transitionService, { options });
  enableHasAuthRoleHook(transitionService, { options });
  enableIsLoggedInHook(transitionService, { options });

  // In testing, print transitions.
  if (!environment.production) {
    // router.trace.enable(Category.RESOLVE);
    // router.trace.enable(Category.HOOK);
    router.trace.enable(Category.TRANSITION);
    // router.trace.enable(Category.UIVIEW);
    // router.trace.enable(Category.VIEWCONFIG);
  }

  return undefined;
}

// MARK: DbxFirebase
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

export const appConfig: ApplicationConfig = {
  providers: [
    // formly
    importProvidersFrom(
      FormlyModule.forRoot({
        validationMessages: defaultValidationMessages()
      })
    ),
    // ui-router
    provideUIRouter({
      useHash: false,
      initial: { state: 'root' },
      otherwise: { state: 'root' },
      states: STATES,
      config: routerConfigFn
    }),
    // browser
    provideAnimations(),
    // ngRx
    provideEffects(),
    provideStore(ROOT_REDUCER, {
      metaReducers,
      runtimeChecks: {
        strictStateSerializability: true,
        strictActionSerializability: true,
        strictActionWithinNgZone: true,
        strictActionTypeUniqueness: true
      }
    }),
    !environment.production ? provideStoreDevtools({ maxAge: 25, logOnly: environment.production, connectInZone: true }) : [],
    // dbx-analytics
    provideDbxAnalyticsSegmentApiService({
      dbxAnalyticsSegmentApiServiceConfigFactory
    }),
    provideDbxAnalyticsService({
      dbxAnalyticsServiceConfigurationFactory
    }),
    // dbx-core
    provideDbxAppEnviroment(environment),
    provideDbxScreenMediaService(),
    provideDbxAppContextState(),
    provideDbxUIRouterService(),
    provideDbxStorage(),
    provideDbxAppAuth({
      dbxAppAuthRoutes: {
        loginRef: { ref: 'demo.auth' },
        loggedOutRef: { ref: 'demo.auth.loggedout' },
        appRef: { ref: 'demo.app' }
      },
      activeRoutesToApplyEffects: DBX_KNOWN_APP_CONTEXT_STATES
    }),
    // dbx-web
    provideDbxRouterWebUiRouterProviderConfig(),
    provideDbxStyleService({
      dbxStyleConfig: {
        style: 'doc-app',
        suffixes: new Set(['dark'])
      }
    }),
    provideDbxMapbox({
      dbxMapboxConfig: environment.mapbox,
      ngxMapboxGLModuleConfig: {
        accessToken: environment.mapbox.token
      }
    }),
    // dbx-web extensions
    provideDbxCalendar(),
    provideDbxModelService(),
    // dbx-form, form related
    provideDbxFormConfiguration(),
    provideDbxFormFormlyFieldDeclarations(),
    // dbx-firebase
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
      },
      modelTypesService: {
        dbxFirebaseModelTypesServiceConfigFactory
      },
      development: {
        enabled: !environment.production,
        developmentWidgetEntries: [demoSetupDevelopmentWidget()]
      },
      notifications: {
        appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)
      },
      provideAnalyticsUserEventsListener: true
    }),
    provideDbxFirebaseLogin({
      enabledLoginMethods: environment.firebase.enabledLoginMethods,
      termsOfServiceUrls: {
        tosUrl: '/tos/terms',
        privacyUrl: '/tos/privacy'
      }
    }),

    // App initializers
    [
      {
        provide: APP_INITIALIZER,
        useFactory: (injector: Injector) => {
          return () => {
            // add any initialization here
          };
        },
        deps: [Injector],
        multi: true
      }
    ]

    // provideZoneChangeDetection({ eventCoalescing: true })
  ]
};
