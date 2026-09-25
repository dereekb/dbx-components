import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DBX_FILTER_STORAGE_SERVICE_CONFIG_TOKEN, DbxFilterStorageService, type DbxFilterStorageServiceConfig } from './filter.storage.service';

/**
 * Registers {@link DbxFilterStorageService} as an environment-level provider.
 *
 * Requires {@link provideDbxStorage} to also be provided.
 *
 * @param config - Optional service configuration.
 * @returns The environment providers for filter storage.
 *
 * @example
 * ```typescript
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideDbxStorage(), provideDbxFilterStorage()],
 * };
 * ```
 */
export function provideDbxFilterStorage(config?: Maybe<DbxFilterStorageServiceConfig>): EnvironmentProviders {
  const providers: Provider[] = [DbxFilterStorageService];

  if (config) {
    providers.push({
      provide: DBX_FILTER_STORAGE_SERVICE_CONFIG_TOKEN,
      useValue: config
    });
  }

  return makeEnvironmentProviders(providers);
}
