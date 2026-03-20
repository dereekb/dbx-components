import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxRouterWebProviderConfig } from '../router.provider.config';
import { DbxUIRouterSegueAnchorComponent } from './anchor.component';

/**
 * Provides a {@link DbxRouterWebProviderConfig} that configures the application to use UIRouter for rendering segue-ref anchor links.
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [provideDbxRouterWebUiRouterProviderConfig()]
 * });
 * ```
 *
 * @returns environment providers that configure the UIRouter-based segue anchor component
 */
export function provideDbxRouterWebUiRouterProviderConfig(): EnvironmentProviders {
  const config: DbxRouterWebProviderConfig = {
    anchorSegueRefComponent: {
      componentClass: DbxUIRouterSegueAnchorComponent
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
