import { EnvironmentProviders, Injector, ModuleWithProviders, NgModule, Provider, makeEnvironmentProviders } from '@angular/core';
import { DbxAuthService } from '@dereekb/dbx-core';
import { DbxFirebaseAuthService, DbxFirebaseAuthServiceDelegate } from './service/firebase.auth.service';

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
  delegateFactory?: (injector: Injector) => DbxFirebaseAuthServiceDelegate;
}

/**
 * Creates EnvironmentProviders for the DbxFirebaseAuthService, and configures the DbxFirebaseAuthService to provide DbxAuthService.
 *
 * @param config
 * @returns
 */
export function provideDbxFirebaseAuth(config?: ProvideDbxFirebaseAuthConfig): EnvironmentProviders {
  const providers: Provider[] = [
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

  return makeEnvironmentProviders(providers);
}
