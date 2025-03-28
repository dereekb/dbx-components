import { EnvironmentProviders, makeEnvironmentProviders, Provider } from '@angular/core';
import { DbxRouterWebProviderConfig } from '../router.provider.config';
import { DbxUIRouterSegueAnchorComponent } from './anchor.component';

/**
 * Provides a DbxRouterWebProviderConfig that configures the app to use UIRouter for anchors.
 
 * @returns EnvironmentProviders
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
