import { type EnvironmentProviders, Injector, type Provider, makeEnvironmentProviders, provideAppInitializer, inject } from '@angular/core';
import { DbxAuthService } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService, DbxFirebaseAuthServiceDelegate } from './service/firebase.auth.service';
import { DBX_FIREBASE_AUTH_FLOW_TOKEN, type DbxFirebaseAuthFlow } from './service/firebase.auth.flow';

/**
 * Configuration for provideDbxFirebaseAuth().
 */
export interface ProvideDbxFirebaseAuthConfig {
  /**
   * Optional custom delegate factory for the configured DbxFirebaseAuthService.
   *
   * @param injector
   * @returns
   */
  readonly delegateFactory?: (injector: Injector) => DbxFirebaseAuthServiceDelegate;
  /**
   * Optional auth flow (popup vs redirect) used by the service's `*WithDefaultFlow` methods.
   *
   * Defaults to `popup` when unset. Use `redirect` (or `auto`, which picks redirect for standalone
   * PWAs) to support iOS home-screen web apps, where popup sign-in does not work. When set to
   * anything other than `popup`, an app initializer is registered to complete pending redirect
   * results (`getRedirectResult`) on startup.
   */
  readonly authFlow?: DbxFirebaseAuthFlow;
}

/**
 * Creates EnvironmentProviders for the DbxFirebaseAuthService, and configures the DbxFirebaseAuthService to provide DbxAuthService.
 *
 * @param config
 * @returns
 */
export function provideDbxFirebaseAuth(config?: ProvideDbxFirebaseAuthConfig): EnvironmentProviders {
  const providers: (Provider | EnvironmentProviders)[] = [
    DbxFirebaseAuthService,
    {
      provide: DbxAuthService,
      useExisting: DbxFirebaseAuthService
    }
  ];

  if (config?.delegateFactory) {
    providers.push({
      provide: DbxFirebaseAuthServiceDelegate,
      useFactory: config.delegateFactory,
      deps: [Injector]
    });
  }

  if (config?.authFlow) {
    providers.push({
      provide: DBX_FIREBASE_AUTH_FLOW_TOKEN,
      useValue: config.authFlow
    });

    // A redirect-capable flow may return from a full-page redirect on startup; complete it via getRedirectResult().
    if (config.authFlow !== 'popup') {
      providers.push(
        provideAppInitializer(() => {
          inject(DbxFirebaseAuthService)
            .handleRedirectResult()
            .catch((e) => console.error('DbxFirebaseAuthService: failed to complete redirect sign-in.', e));
        })
      );
    }
  }

  return makeEnvironmentProviders(providers);
}
