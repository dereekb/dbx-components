import { NgModule, ModuleWithProviders, Provider } from '@angular/core';
import { DbNgxAnalyticsService } from './analytics.service';


export interface DbNgxAnalyticsModuleOptions {

  /**
   * Provides a AnalyticsServiceConfiguration value.
   */
  analyticsConfigurationProvider: Provider;

}

@NgModule()
export class DbNgxAnalyticsModule {

  static forRoot(options: DbNgxAnalyticsModuleOptions): ModuleWithProviders<DbNgxAnalyticsModule> {
    return {
      ngModule: DbNgxAnalyticsModule,
      providers: [
        // Configuration
        options.analyticsConfigurationProvider,
        // Service
        DbNgxAnalyticsService
      ]
    };
  }

}
