import { APP_INITIALIZER, makeEnvironmentProviders, Provider } from '@angular/core';
import { DbxFirebaseAnalyticsUserEventsListenerService } from './analytics.user.events.service';

/**
 * Creates a EnvironmentProviders that provides a DbxFirebaseAnalyticsUserEventsListenerService and initialize it when the app is initialized.
 *
 * @returns EnvironmentProviders
 */
export function provideDbxFirebaseAnalyticsUserEventsListenerService() {
  const providers: Provider[] = [
    DbxFirebaseAnalyticsUserEventsListenerService,
    // service initialization
    {
      provide: APP_INITIALIZER,
      useFactory: (dbxFirebaseAnalyticsUserEventsListenerService: DbxFirebaseAnalyticsUserEventsListenerService) => {
        return () => {
          dbxFirebaseAnalyticsUserEventsListenerService.init();
        };
      },
      deps: [DbxFirebaseAnalyticsUserEventsListenerService],
      multi: true
    }
  ];

  return makeEnvironmentProviders(providers);
}
