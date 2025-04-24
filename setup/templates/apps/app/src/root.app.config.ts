import { DbxAnalyticsService, DbxAnalyticsServiceConfiguration, DbxAnalyticsSegmentServiceListener, DbxAnalyticsSegmentApiServiceConfig, provideDbxAnalyticsService, provideDbxAnalyticsSegmentApiService } from '@dereekb/dbx-analytics';
import { ApplicationConfig, importProvidersFrom, Injector } from '@angular/core';
import { Category, provideUIRouter, StatesModule, UIRouter } from '@uirouter/angular';
import { environment } from './environments/environment';
import { AuthTransitionHookOptions, DBX_KNOWN_APP_CONTEXT_STATES, enableHasAuthRoleHook, enableHasAuthStateHook, enableIsLoggedInHook, provideDbxAppAuth, provideDbxAppContextState, provideDbxAppEnviroment, provideDbxStorage, provideDbxUIRouterService } from '@dereekb/dbx-core';
import { DbxFirebaseAnalyticsUserSource, DbxFirebaseAuthServiceDelegate, DbxFirebaseModelTypesServiceConfig, DbxFirebaseModelTypesServiceEntry, defaultDbxFirebaseAuthServiceDelegateWithClaimsService, provideDbxFirebase, provideDbxFirebaseLogin } from '@dereekb/dbx-firebase';
import { provideDbxModelService, provideDbxRouterWebUiRouterProviderConfig, provideDbxScreenMediaService, provideDbxStyleService } from '@dereekb/dbx-web';
import { FirestoreContext, FirestoreModelKey, appNotificationTemplateTypeInfoRecordService, firestoreModelId } from '@dereekb/firebase';
import { APP_CODE_PREFIXFirebaseContextService } from 'APP_COMPONENTS_NAME';
import { defaultValidationMessages, provideDbxFormConfiguration } from '@dereekb/dbx-form';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideAnimations } from '@angular/platform-browser/animations';
import { STATES } from './app/app.router';
import { FormlyModule } from '@ngx-formly/core';
import { provideDbxCalendar } from '@dereekb/dbx-web/calendar';
import { APP_CODE_PREFIX_UPPER_AUTH_CLAIMS_SERVICE, APP_CODE_PREFIX_UPPER_API_AUTH_CLAIMS_ONBOARDED_TOKEN, APP_CODE_PREFIX_UPPER_FIREBASE_FUNCTIONS_CONFIG, APP_CODE_PREFIXFirebaseFunctionsGetter, APP_CODE_PREFIXFirestoreCollections, makeAPP_CODE_PREFIXFirebaseFunctions, makeAPP_CODE_PREFIXFirestoreCollections, APP_CODE_PREFIX_UPPER_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD } from 'FIREBASE_COMPONENTS_NAME';

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
    defaultRedirectTarget: 'auth.login'
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
export function APP_CODE_PREFIX_LOWERAuthDelegateFactory(): DbxFirebaseAuthServiceDelegate {
  return defaultDbxFirebaseAuthServiceDelegateWithClaimsService({
    claimsService: APP_CODE_PREFIX_UPPER_AUTH_CLAIMS_SERVICE,
    addAuthUserStateToRoles: true,
    stateForLoggedInUserToken: (token) => {
      const y = token.claims[APP_CODE_PREFIX_UPPER_API_AUTH_CLAIMS_ONBOARDED_TOKEN];
      return y ? 'user' : 'new';
    }
  });
}

export function dbxFirebaseModelTypesServiceConfigFactory(): DbxFirebaseModelTypesServiceConfig {
  const entries: DbxFirebaseModelTypesServiceEntry<any>[] = [];

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
    provideStore(),
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
        loginRef: { ref: 'auth.login' },
        loggedOutRef: { ref: 'auth.loggedout' },
        appRef: { ref: 'home' }
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
    /*
    provideDbxMapbox({
      dbxMapboxConfig: environment.mapbox,
      ngxMapboxGLModuleConfig: {
        accessToken: environment.mapbox.token
      }
    }),
    */
    // dbx-web extensions
    // provideDbxCalendar(),
    provideDbxModelService(),
    // dbx-form, form related
    provideDbxFormConfiguration(),
    // dbx-firebase
    provideDbxFirebase({
      app: {
        dbxFirebaseAppOptions: environment.firebase
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
      },
      modelContextService: {
        dbxFirebaseModelContextServiceClass: APP_CODE_PREFIXFirebaseContextService
      },
      modelTypesService: {
        dbxFirebaseModelTypesServiceConfigFactory
      },
      development: {
        enabled: !environment.production
      },
      notifications: {
        appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(APP_CODE_PREFIX_UPPER_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)
      },
      provideAnalyticsUserEventsListener: true
    }),
    provideDbxFirebaseLogin({
      enabledLoginMethods: environment.firebase.enabledLoginMethods,
      termsOfServiceUrls: {
        tosUrl: '/tos/terms',
        privacyUrl: '/tos/privacy'
      }
    })

    // provideZoneChangeDetection({ eventCoalescing: true })
  ]
};
