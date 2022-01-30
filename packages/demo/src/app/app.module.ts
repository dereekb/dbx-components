import { DbNgxAnalyticsModule, DbNgxAnalyticsService, SegmentModule } from '@dereekb/dbx-analytics';
import { AppLayoutComponent } from './container/layout.component';
import { Injector, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { Category, StatesModule, UIRouter, UIRouterModule, UIView } from '@uirouter/angular';
import { AppSharedModule } from '@/shared/app.shared.module';
import { ROOT_STATES } from './app.router';
import { environment } from '../environments/environment';
import { DbNgxWebRootModule, DbNgxWebUIRouterModule } from '@dereekb/dbx-web';
import { DbNgxAnalyticsServiceConfiguration, SegmentAnalyticsListenerService, SegmentApiService, SegmentApiServiceConfig } from '@dereekb/dbx-analytics';

export function routerConfigFn(router: UIRouter, injector: Injector, module: StatesModule): any {
  const transitionService = router.transitionService;
  const service: DbNgxAnalyticsService = injector.get<DbNgxAnalyticsService>(DbNgxAnalyticsService);

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

export function analyticsServiceConfigurationFactory(segmentApi: SegmentApiService): DbNgxAnalyticsServiceConfiguration {
  const segmentListener = new SegmentAnalyticsListenerService(segmentApi);

  const config: DbNgxAnalyticsServiceConfiguration = {
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
    AppSharedModule,
    DbNgxWebRootModule,
    DbNgxAnalyticsModule.forRoot({
      analyticsConfigurationProvider: {
        provide: DbNgxAnalyticsServiceConfiguration,
        useFactory: analyticsServiceConfigurationFactory,
        deps: [SegmentApiService]
      }
    }),
    SegmentModule.forRoot(),
    DbNgxWebUIRouterModule.forRoot(),
    UIRouterModule.forRoot({
      states: ROOT_STATES,
      useHash: false,
      initial: { state: 'public.landing' },
      otherwise: { state: 'public.landing' },
      config: routerConfigFn
    }),
  ],
  providers: [{
    provide: SegmentApiServiceConfig,
    useFactory: makeSegmentConfig
  }],
  declarations: [AppLayoutComponent],
  bootstrap: [UIView]
})
export class AppModule { }
