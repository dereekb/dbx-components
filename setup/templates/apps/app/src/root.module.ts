import { DbxAnalyticsModule, DbxAnalyticsService, DbxAnalyticsSegmentModule } from '@dereekb/dbx-analytics';
import { Injector, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Category, StatesModule, UIRouter, UIRouterModule, UIView } from '@uirouter/angular';
import { APP_CODE_PREFIXRootSharedModule } from 'ANGULAR_COMPONENTS_NAME';
import { environment } from './environments/environment';
import { DbxScreenModule, DbxWebUIRouterModule, DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG, DBX_STYLE_DEFAULT_CONFIG_TOKEN } from '@dereekb/dbx-web';
import { DbxAnalyticsServiceConfiguration, DbxAnalyticsSegmentServiceListener, DbxAnalyticsSegmentApiService, DbxAnalyticsSegmentApiServiceConfig } from '@dereekb/dbx-analytics';
import { RootAppModule } from './app/app.module';
import { DbxAppAuthRouterStateModule, DbxAppAuthRouterModule, AuthTransitionHookOptions, DbxAppAuthStateModule, DbxAppContextStateModule, DbxCoreUIRouterSegueModule, DBX_KNOWN_APP_CONTEXT_STATES, enableHasAuthRoleHook, enableHasAuthStateHook, enableIsLoggedInHook, DbxAppEnviroment } from '@dereekb/dbx-core';
import { FormlyModule } from '@ngx-formly/core';
import { defaultValidationMessages } from '@dereekb/dbx-form';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { RootFirebaseModule } from './root.firebase.module';
import { DbxFirebaseLoginModule } from '@dereekb/dbx-firebase';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { metaReducers, ROOT_REDUCER } from './app/state/app.state';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import { DbxMapboxModule } from '@dereekb/dbx-web/mapbox';

export function routerConfigFn(router: UIRouter, injector: Injector, module: StatesModule): any {
  const transitionService = router.transitionService;
  const service: DbxAnalyticsService = injector.get<DbxAnalyticsService>(DbxAnalyticsService);

  transitionService.onSuccess({}, () => {
    // Send a page view on each successful transition.
    service.sendPageView();
  });

  const options: AuthTransitionHookOptions = {
    defaultRedirectTarget: 'app.login'
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

export function analyticsServiceConfigurationFactory(segmentListener: DbxAnalyticsSegmentServiceListener): DbxAnalyticsServiceConfiguration {
  const config: DbxAnalyticsServiceConfiguration = {
    isProduction: environment.production,
    logEvents: environment.testing,
    listeners: [
      segmentListener
    ]
  };

  return config;
}

export function makeSegmentConfig(): DbxAnalyticsSegmentApiServiceConfig {
  const config = new DbxAnalyticsSegmentApiServiceConfig(environment.analytics.segment);
  config.active = environment.production;
  config.logging = false; // environment.testing;
  return config;
}

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RootAppModule,
    APP_CODE_PREFIXRootSharedModule,
    DbxFirebaseLoginModule.forRoot({
      enabledLoginMethods: environment.firebase.enabledLoginMethods,
      tosUrl: '/tos/terms',
      privacyUrl: '/tos/privacy'
    }),
    DbxScreenModule.forRoot(DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG),
    DbxAnalyticsModule.forRoot({
      analyticsConfigurationProvider: {
        provide: DbxAnalyticsServiceConfiguration,
        useFactory: analyticsServiceConfigurationFactory,
        deps: [DbxAnalyticsSegmentServiceListener]
      }
    }),
    DbxAppContextStateModule,
    DbxAppAuthStateModule,
    DbxAppAuthRouterModule.forRoot({
      loginRef: { ref: 'demo.auth' },
      loggedOutRef: { ref: 'demo.auth.loggedout' },
      appRef: { ref: 'demo.app' }
    }),
    DbxAppAuthRouterStateModule.forRoot({
      activeRoutesToApplyEffects: DBX_KNOWN_APP_CONTEXT_STATES
    }),
    DbxAnalyticsSegmentModule.forRoot(),
    DbxCoreUIRouterSegueModule.forRoot(),
    DbxWebUIRouterModule.forRoot(),
    // dbx-firebase
    RootFirebaseModule,
    // Store
    StoreModule.forRoot(ROOT_REDUCER, {
      metaReducers,
      runtimeChecks: {
        strictStateSerializability: true,
        strictActionSerializability: true,
        strictActionWithinNgZone: true,
        strictActionTypeUniqueness: true,
      },
    }),
    EffectsModule.forRoot(),
    (!environment.production ? StoreDevtoolsModule.instrument({ maxAge: 25, logOnly: environment.production , connectInZone: true}) : []),
    // other modules
    FormlyModule.forRoot({
      validationMessages: defaultValidationMessages()
    }),
    UIRouterModule.forRoot({
      useHash: false,
      initial: { state: 'root' },
      otherwise: { state: 'root' },
      config: routerConfigFn
    }),
    NgxMapboxGLModule.withConfig({
      accessToken: environment.mapbox.token
    })
  ],
  providers: [
    {
      provide: DbxAppEnviroment,
      useValue: environment
    },
    {
      provide: DbxAnalyticsSegmentApiServiceConfig,
      useFactory: makeSegmentConfig
    }, {
      provide: DBX_STYLE_DEFAULT_CONFIG_TOKEN,
      useValue: {
        style: 'doc-app',
        suffixes: new Set(['dark'])
      }
    }, {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        floatLabel: 'always',
        appearance: 'outline'
      }
    }],
  bootstrap: [UIView]
})
export class RootModule { }
