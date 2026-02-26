import { type EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer, type Provider } from '@angular/core';
import { DbxFirebaseAnalyticsUserEventsListenerService } from './analytics.user.events.service';

/**
 * Creates a EnvironmentProviders that provides a DbxFirebaseAnalyticsUserEventsListenerService and initialize it when the app is initialized.
 *
 * @returns EnvironmentProviders
 */
export function provideDbxFirebaseAnalyticsUserEventsListenerService() {
  const providers: (EnvironmentProviders | Provider)[] = [
    DbxFirebaseAnalyticsUserEventsListenerService,
    // service initialization
    provideAppInitializer(() => {
      const service = inject(DbxFirebaseAnalyticsUserEventsListenerService);
      service.init();
    })
  ];

  return makeEnvironmentProviders(providers);
}
