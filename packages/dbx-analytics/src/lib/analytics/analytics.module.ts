import { NgModule, ModuleWithProviders, Provider } from '@angular/core';
import { DbxAnalyticsService } from './analytics.service';

export interface DbxAnalyticsModuleOptions {
  /**
   * Provides a AnalyticsServiceConfiguration value.
   */
  analyticsConfigurationProvider: Provider;
}

@NgModule()
export class DbxAnalyticsModule {
  static forRoot(options: DbxAnalyticsModuleOptions): ModuleWithProviders<DbxAnalyticsModule> {
    return {
      ngModule: DbxAnalyticsModule,
      providers: [
        // Configuration
        options.analyticsConfigurationProvider,
        // Service
        DbxAnalyticsService
      ]
    };
  }
}
