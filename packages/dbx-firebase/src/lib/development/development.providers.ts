import { APP_INITIALIZER, type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxFirebaseDevelopmentWidgetService, DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN } from './development.widget.service';
import { DbxFirebaseDevelopmentService, DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN } from './development.service';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { type DbxFirebaseDevelopmentWidgetEntry } from './development.widget';
import { developmentFirebaseServerSchedulerWidgetEntry } from './development.scheduler.widget.component';

/**
 * Configuration for provideDbxFirebaseDevelopment().
 */
export interface ProvideDbxFirebaseDevelopmentConfig {
  /**
   * Whether or not to automatically add the developmentFirebaseServerSchedulerWidgetEntry() to the developmentWidgetEntries.
   *
   * Defaults to true.
   */
  readonly addDevelopmentSchedulerWidget?: boolean;
  /**
   * Widgets to add to the DbxFirebaseDevelopmentWidgetService module.
   *
   * Configured via the DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN.
   */
  readonly developmentWidgetEntries?: DbxFirebaseDevelopmentWidgetEntry[];
  /**
   * Whether or not the development module is currently enabled.
   *
   * Corresponds to DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN.
   */
  readonly enabled?: boolean;
}

/**
 * Creates providers for DbxFirebaseDevelopmentSchedulerService, DbxFirebaseDevelopmentWidgetService, and DbxFirebaseDevelopmentService.
 *
 * @param config
 * @returns
 */
export function provideDbxFirebaseDevelopment(config: ProvideDbxFirebaseDevelopmentConfig): EnvironmentProviders {
  const { developmentWidgetEntries: inputEntries, enabled, addDevelopmentSchedulerWidget } = config;
  const entries = [...(inputEntries ?? [])];

  if (addDevelopmentSchedulerWidget !== false) {
    entries.push(developmentFirebaseServerSchedulerWidgetEntry());
  }

  const providers: Provider[] = [
    // config
    {
      provide: DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN,
      useValue: entries
    },
    {
      provide: DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN,
      useValue: enabled
    },
    // services
    DbxFirebaseDevelopmentService,
    DbxFirebaseDevelopmentSchedulerService,
    DbxFirebaseDevelopmentWidgetService,
    // service initialization
    {
      provide: APP_INITIALIZER,
      useFactory: (scheduler: DbxFirebaseDevelopmentSchedulerService) => {
        return () => {
          // initialize the scheduler
          scheduler.init();
        };
      },
      deps: [DbxFirebaseDevelopmentSchedulerService],
      multi: true
    }
  ];

  return makeEnvironmentProviders(providers);
}
