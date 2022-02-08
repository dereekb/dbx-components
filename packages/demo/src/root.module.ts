import { DbxAnalyticsModule, AnalyticsService, SegmentModule } from '@dereekb/dbx-analytics';
import { Injector, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Category, StatesModule, UIRouter, UIRouterModule, UIView } from '@uirouter/angular';
import { AppSharedModule } from '@/shared/app.shared.module';
import { environment } from './environments/environment';
import { DbxPopupInteractionModule, DbxPopoverInteractionModule, DbxScreenModule, DbxWebRootModule, DbxWebUIRouterModule, DEFAULT_SCREEN_MEDIA_SERVICE_CONFIG } from '@dereekb/dbx-web';
import { AnalyticsServiceConfiguration, SegmentAnalyticsListenerService, SegmentApiService, SegmentApiServiceConfig } from '@dereekb/dbx-analytics';
import { AppModule } from './app/app.module';
import { DbxCoreUIRouterSegueModule } from '@dereekb/dbx-core';

export function routerConfigFn(router: UIRouter, injector: Injector, module: StatesModule): any {
  const transitionService = router.transitionService;
  const service: AnalyticsService = injector.get<AnalyticsService>(AnalyticsService);

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

export function analyticsServiceConfigurationFactory(segmentApi: SegmentApiService): AnalyticsServiceConfiguration {
  const segmentListener = new SegmentAnalyticsListenerService(segmentApi);

  const config: AnalyticsServiceConfiguration = {
    isProduction: environment.production,
    logEvents: environment.testing,
    listeners: [
      segmentListener
    ]
  };

  return config;
}

export function makeSegmentConfig(): SegmentApiServiceConfig {
  const config = new SegmentApiServiceConfig(environment.analytics.segment);
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
        provide: AnalyticsServiceConfiguration,
        useFactory: analyticsServiceConfigurationFactory,
        deps: [SegmentApiService]
      }
    }),
    SegmentModule.forRoot(),
    DbxCoreUIRouterSegueModule.forRoot(),
    DbxWebUIRouterModule.forRoot(),
    DbxPopupInteractionModule.forRoot(),
    DbxPopoverInteractionModule.forRoot(),
    UIRouterModule.forRoot({
      useHash: false,
      initial: { state: 'app' },
      otherwise: { state: 'app' },
      config: routerConfigFn
    }),
  ],
  providers: [{
    provide: SegmentApiServiceConfig,
    useFactory: makeSegmentConfig
  }],
  bootstrap: [UIView]
})
export class RootModule { }
