import { type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { DBX_WEB_PAGE_TITLE_SERVICE_CONFIG, DbxWebPageTitleService, type DbxWebPageTitleServiceConfig } from './title.service';

/**
 * Configuration for {@link provideDbxWebPageTitleService}.
 */
export interface ProvideDbxWebPageTitleServiceConfig extends DbxWebPageTitleServiceConfig {}

/**
 * Creates {@link EnvironmentProviders} that wire up {@link DbxWebPageTitleService} (and an optional
 * {@link DbxWebPageTitleServiceConfig}) for an app or feature scope.
 *
 * @param config - Optional service configuration.
 * @returns Environment providers ready to pass to `bootstrapApplication` or another `provide*` factory.
 *
 * @example
 * ```ts
 * provideDbxWebPageTitleService({ defaultTitle: 'MyApp' })
 * ```
 */
export function provideDbxWebPageTitleService(config?: ProvideDbxWebPageTitleServiceConfig): EnvironmentProviders {
  const providers: Provider[] = [DbxWebPageTitleService];

  if (config) {
    providers.push({ provide: DBX_WEB_PAGE_TITLE_SERVICE_CONFIG, useValue: config });
  }

  return makeEnvironmentProviders(providers);
}
