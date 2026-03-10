import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxRouterWebProviderConfig } from '../router.provider.config';
import { DbxAngularRouterSegueAnchorComponent } from './anchor.component';

/**
 * Provides a {@link DbxRouterWebProviderConfig} that configures the application to use Angular Router for rendering segue-ref anchor links.
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [provideDbxRouterWebAngularRouterProviderConfig()]
 * });
 * ```
 */
export function provideDbxRouterWebAngularRouterProviderConfig(): EnvironmentProviders {
  const config: DbxRouterWebProviderConfig = {
    anchorSegueRefComponent: {
      componentClass: DbxAngularRouterSegueAnchorComponent
    }
  };

  const providers: Provider[] = [
    {
      provide: DbxRouterWebProviderConfig,
      useValue: config
    }
  ];

  return makeEnvironmentProviders(providers);
}
