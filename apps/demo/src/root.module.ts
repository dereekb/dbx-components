import { DbxAnalyticsModule, DbxAnalyticsService, DbxAnalyticsSegmentModule } from '@dereekb/dbx-analytics';
import { Injector, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Category, StatesModule, UIRouter, UIRouterModule, UIView } from '@uirouter/angular';
import { AppSharedModule } from '@/shared/app.shared.module';
import { environment } from './environments/environment';
import { DbxPopupInteractionModule, DbxPopoverInteractionModule, DbxScreenModule, DbxWebRootModule, DbxWebUIRouterModule, DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG, DBX_STYLE_DEFAULT_CONFIG_TOKEN } from '@dereekb/dbx-web';
import { DbxAnalyticsServiceConfiguration, DbxAnalyticsSegmentServiceListener, DbxAnalyticsSegmentApiService, DbxAnalyticsSegmentApiServiceConfig } from '@dereekb/dbx-analytics';
import { AppModule } from './app/app.module';
import { DbxCoreUIRouterSegueModule } from '@dereekb/dbx-core';
import { FormlyModule } from '@ngx-formly/core';
import { defaultValidationMessages } from '@dereekb/dbx-form';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

export function routerConfigFn(router: UIRouter, injector: Injector, module: StatesModule): any {
  const transitionService = router.transitionService;
  const service: DbxAnalyticsService = injector.get<DbxAnalyticsService>(DbxAnalyticsService);

  transitionService.onSuccess({}, () => {
    // Send a page view on each successful transition.
    service.sendPageView();
  });

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

export function analyticsServiceConfigurationFactory(segmentApi: DbxAnalyticsSegmentApiService): DbxAnalyticsServiceConfiguration {
  const segmentListener = new DbxAnalyticsSegmentServiceListener(segmentApi);

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
    AppModule,
    AppSharedModule,
    DbxWebRootModule,
    DbxScreenModule.forRoot(DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG),
    DbxAnalyticsModule.forRoot({
      analyticsConfigurationProvider: {
        provide: DbxAnalyticsServiceConfiguration,
        useFactory: analyticsServiceConfigurationFactory,
        deps: [DbxAnalyticsSegmentApiService]
      }
    }),
    DbxAnalyticsSegmentModule.forRoot(),
    DbxCoreUIRouterSegueModule.forRoot(),
    DbxWebUIRouterModule.forRoot(),
    DbxPopupInteractionModule.forRoot(),
    DbxPopoverInteractionModule.forRoot(),
    FormlyModule.forRoot({
      validationMessages: defaultValidationMessages()
    }),
    UIRouterModule.forRoot({
      useHash: false,
      initial: { state: 'app' },
      otherwise: { state: 'app' },
      config: routerConfigFn
    }),
  ],
  providers: [{
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
      
    }
  }],
  bootstrap: [UIView]
})
export class RootModule { }
