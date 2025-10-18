import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { DbxRouterWebProviderConfig } from '../router.provider.config';
import { DbxAngularRouterSegueAnchorComponent } from './anchor.component';

/**
 * Provides a DbxRouterWebProviderConfig that configures the app to use Angular Router for anchors.
 *
 * @returns EnvironmentProviders
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
